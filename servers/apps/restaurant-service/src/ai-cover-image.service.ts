import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Restaurant } from './entities/restaurant.entity';
import { S3Service } from './s3.service';

const HEX_RE = /#([0-9a-f]{6})\b/i;

const COVER_PROMPT_SYSTEM = `You are a brand-aware art director generating a cover banner image for a restaurant SaaS.
Output rules:
- The image must be a wide, photorealistic / editorial banner suitable for the top of a restaurant page.
- Centerpiece: appetizing food matching the cuisine described. Soft natural light, shallow depth of field.
- The brand accent color must be visible in the lighting/props (table linen, plates, garnish, background tint) — but never as solid blocks of color.
- No on-image text, no logos, no watermarks, no people facing the camera.
- Composition leaves a clean horizontal area where text could overlay later (rule-of-thirds, food on one side).`;

@Injectable()
export class AiCoverImageService {
  private readonly logger = new Logger(AiCoverImageService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly s3: S3Service,
    @InjectRepository(Restaurant)
    private readonly restaurantRepo: Repository<Restaurant>,
  ) {}

  /**
   * Generate an AI cover image for a restaurant. The accent color is taken
   * from the request body if provided, otherwise sampled from the logo via
   * a vision LLM call. Saves the result to S3 + restaurant.coverUrl and
   * returns a presigned URL.
   */
  async generateCover(
    restaurantId: string,
    accentColorOverride?: string,
  ): Promise<{
    coverUrl: string;
    accentColor: string;
    coverKey: string;
  }> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'خدمة الذكاء الاصطناعي غير مهيأة. يرجى ضبط OPENAI_API_KEY.',
      );
    }

    const restaurant = await this.restaurantRepo.findOne({
      where: { id: restaurantId },
    });
    if (!restaurant) throw new NotFoundException('المطعم غير موجود.');
    if (!restaurant.name?.trim()) {
      throw new BadRequestException(
        'يجب تحديد اسم المطعم قبل توليد صورة الغلاف.',
      );
    }

    let accentColor = normalizeHex(accentColorOverride);

    if (!accentColor) {
      if (!restaurant.logoUrl) {
        throw new BadRequestException(
          'لا يوجد شعار للمطعم. ارفع شعاراً أو زوّد لوناً مخصصاً.',
        );
      }
      accentColor = await this.extractLogoAccentColor(restaurant.logoUrl, apiKey);
    }

    const prompt = buildCoverPrompt(restaurant, accentColor);
    const { buffer, mimeType } = await this.callImageModel(prompt, apiKey);

    const previousKey = restaurant.coverUrl;

    const fakeFile: Express.Multer.File = {
      fieldname: 'cover',
      originalname: `cover.${mimeType === 'image/png' ? 'png' : 'jpg'}`,
      mimetype: mimeType,
      buffer,
      size: buffer.length,
      encoding: '7bit',
      destination: '',
      filename: '',
      path: '',
      stream: undefined as any,
    };

    const newKey = await this.s3.upload(fakeFile, 'covers');

    await this.restaurantRepo.update(restaurantId, { coverUrl: newKey });

    if (previousKey && !/^https?:\/\//i.test(previousKey) && previousKey !== newKey) {
      this.s3.delete(previousKey).catch((err) =>
        this.logger.warn(
          `Failed to delete previous cover ${previousKey}: ${(err as Error)?.message}`,
        ),
      );
    }

    return {
      coverKey: newKey,
      coverUrl: await this.s3.presignedUrl(newKey),
      accentColor,
    };
  }

  // ─── Logo → accent color (vision) ──────────────────────────────────────────

  private async extractLogoAccentColor(
    logoKey: string,
    apiKey: string,
  ): Promise<string> {
    let logoBuffer: Buffer;
    let logoMime: string;
    try {
      const url = /^https?:\/\//i.test(logoKey)
        ? logoKey
        : await this.s3.presignedUrl(logoKey, 600);
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error(`logo fetch failed: HTTP ${resp.status}`);
      }
      const arr = new Uint8Array(await resp.arrayBuffer());
      logoBuffer = Buffer.from(arr);
      logoMime = resp.headers.get('content-type') || 'image/png';
    } catch (err) {
      this.logger.warn(
        `Could not fetch logo for color extraction (${(err as Error)?.message}); falling back to default accent.`,
      );
      return '#E2552B';
    }

    const visionModel = this.config.get<string>(
      'OPENAI_VISION_MODEL',
      'gpt-4o-mini',
    );
    const dataUrl = `data:${logoMime};base64,${logoBuffer.toString('base64')}`;

    const body = {
      model: visionModel,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content:
            'You inspect a brand logo image and return its dominant non-white, non-black brand color as a single 6-digit hex code. Output ONLY the hex (format #RRGGBB). No prose.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is the dominant brand color hex?' },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
    };

    let resp: Response;
    try {
      resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      this.logger.warn(`Vision color extraction network error: ${(err as Error)?.message}`);
      return '#E2552B';
    }

    if (!resp.ok) {
      const errText = await resp.text();
      this.logger.warn(
        `Vision color extraction failed (${resp.status}): ${errText.slice(0, 200)}`,
      );
      return '#E2552B';
    }

    const json = (await resp.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = json.choices?.[0]?.message?.content ?? '';
    const match = raw.match(HEX_RE);
    return match ? `#${match[1].toUpperCase()}` : '#E2552B';
  }

  // ─── OpenAI image generation ───────────────────────────────────────────────

  private async callImageModel(
    prompt: string,
    apiKey: string,
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const model = this.config.get<string>('OPENAI_IMAGE_MODEL', 'gpt-image-1');
    const body: Record<string, any> = {
      model,
      prompt,
      n: 1,
      size: model === 'dall-e-3' ? '1792x1024' : '1536x1024',
    };
    if (model === 'dall-e-3') {
      body.response_format = 'b64_json';
      body.quality = 'hd';
      body.style = 'natural';
    }

    let resp: Response;
    try {
      resp = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      this.logger.error(`Image generation network error: ${(err as Error)?.message}`);
      throw new ServiceUnavailableException(
        'تعذّر الاتصال بمزود توليد الصور.',
      );
    }

    if (!resp.ok) {
      const errText = await resp.text();
      this.logger.error(
        `Image generation failed (${resp.status}): ${errText.slice(0, 500)}`,
      );
      throw new ServiceUnavailableException(
        `فشل توليد صورة الغلاف عبر الذكاء الاصطناعي. (OpenAI HTTP ${resp.status}: ${extractUpstreamReason(errText)})`,
      );
    }

    const json = (await resp.json()) as {
      data?: { b64_json?: string }[];
    };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) {
      this.logger.error('Image generation returned no b64_json payload.');
      throw new ServiceUnavailableException('استجابة فارغة من مزود الصور.');
    }
    return { buffer: Buffer.from(b64, 'base64'), mimeType: 'image/png' };
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function normalizeHex(input: string | undefined | null): string | undefined {
  if (!input) return undefined;
  const trimmed = input.trim();
  const m = trimmed.match(/^#?([0-9a-f]{6})$/i);
  return m ? `#${m[1].toUpperCase()}` : undefined;
}

/**
 * Pull a short, client-safe reason out of a vendor error body. OpenAI returns
 * `{ error: { message, code, type } }`. Falls back to the raw text. Trimmed to 160 chars.
 */
function extractUpstreamReason(body: string): string {
  const trimmed = (body ?? '').trim();
  if (!trimmed) return 'no body';
  try {
    const parsed = JSON.parse(trimmed) as {
      error?: { message?: string; code?: string; type?: string };
    };
    const msg = parsed.error?.message;
    if (typeof msg === 'string' && msg.trim()) return msg.trim().slice(0, 160);
  } catch {
    /* not JSON — fall through to raw */
  }
  return trimmed.slice(0, 160);
}

function buildCoverPrompt(restaurant: Restaurant, accentColor: string): string {
  const cuisine = restaurant.cuisineType
    ? restaurant.cuisineType.replace(/_/g, ' ')
    : 'restaurant food';
  const description = restaurant.description?.trim()
    ? `\nRestaurant description: "${restaurant.description.trim().slice(0, 400)}"`
    : '';

  return [
    COVER_PROMPT_SYSTEM,
    '',
    `Restaurant name: "${restaurant.name}"`,
    `Cuisine: ${cuisine}`,
    description.trim(),
    '',
    `Brand accent color (hex): ${accentColor}. Use this color as a subtle visual signature throughout the lighting and props. The overall palette should feel coordinated with this color.`,
    '',
    'Aspect: wide landscape (16:9), high resolution, magazine-quality food photography.',
  ]
    .filter(Boolean)
    .join('\n');
}
