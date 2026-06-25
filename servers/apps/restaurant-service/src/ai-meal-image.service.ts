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
import { Meal } from './entities/meal.entity';
import { Restaurant } from './entities/restaurant.entity';
import { S3Service } from './s3.service';

const MEAL_PROMPT_SYSTEM = `You are a food photographer creating a single square dish photo for a restaurant menu / POS card.
Output rules:
- Photorealistic, studio-quality food photography.
- The dish must visually match the dish name and description below. Use authentic ingredients and presentation for the cuisine.
- Centered top-down or three-quarter angle on a single plate / bowl. Plain neutral background (light wood, slate, or marble).
- Soft natural light, shallow depth of field, no harsh shadows.
- No on-image text, no logos, no brand marks, no people, no hands.
- Square framing (1:1) — works as a menu thumbnail at any size.`;

@Injectable()
export class AiMealImageService {
  private readonly logger = new Logger(AiMealImageService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly s3: S3Service,
    @InjectRepository(Meal) private readonly mealRepo: Repository<Meal>,
    @InjectRepository(Restaurant) private readonly restaurantRepo: Repository<Restaurant>,
  ) {}

  /**
   * Generate an AI image for a single meal using its name + description.
   * Saves to S3, updates meal.imageUrl, returns a presigned URL the client
   * can render immediately.
   */
  async generateForMeal(
    ownerId: string,
    mealId: string,
  ): Promise<{ imageUrl: string; imageKey: string }> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'خدمة الذكاء الاصطناعي غير مهيأة. يرجى ضبط OPENAI_API_KEY.',
      );
    }

    const meal = await this.mealRepo.findOne({ where: { id: mealId } });
    if (!meal) throw new NotFoundException('الصنف غير موجود.');

    // Scope: the requester must own the restaurant this meal belongs to.
    const restaurant = await this.restaurantRepo.findOne({
      where: { id: meal.restaurantId },
    });
    if (!restaurant || restaurant.ownerUserId !== ownerId) {
      throw new NotFoundException('الصنف غير موجود.');
    }

    if (!meal.name?.trim()) {
      throw new BadRequestException(
        'اسم الصنف مطلوب لتوليد الصورة بالذكاء الاصطناعي.',
      );
    }

    const prompt = buildMealPrompt(meal, restaurant);
    const { buffer, mimeType } = await this.callImageModel(prompt, apiKey);

    const previousKey = meal.imageUrl;

    const fakeFile: Express.Multer.File = {
      fieldname: 'image',
      originalname: `meal-${meal.id}.${mimeType === 'image/png' ? 'png' : 'jpg'}`,
      mimetype: mimeType,
      buffer,
      size: buffer.length,
      encoding: '7bit',
      destination: '',
      filename: '',
      path: '',
      stream: undefined as any,
    };

    const newKey = await this.s3.upload(fakeFile, 'meals');
    await this.mealRepo.update(mealId, { imageUrl: newKey });

    // Best-effort cleanup of the previous S3 object.
    if (previousKey && !/^https?:\/\//i.test(previousKey) && previousKey !== newKey) {
      this.s3
        .delete(previousKey)
        .catch((err) =>
          this.logger.warn(
            `Failed to delete previous meal image ${previousKey}: ${(err as Error)?.message}`,
          ),
        );
    }

    return {
      imageKey: newKey,
      imageUrl: await this.s3.presignedUrl(newKey),
    };
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
      // Square is ideal for menu / POS thumbnails.
      size: '1024x1024',
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
      this.logger.error(`Meal image generation network error: ${(err as Error)?.message}`);
      throw new ServiceUnavailableException(
        'تعذّر الاتصال بمزود توليد الصور.',
      );
    }

    if (!resp.ok) {
      const errText = await resp.text();
      this.logger.error(
        `Meal image generation failed (${resp.status}): ${errText.slice(0, 500)}`,
      );
      throw new ServiceUnavailableException(
        `فشل توليد صورة الصنف. (OpenAI HTTP ${resp.status}: ${extractUpstreamReason(errText)})`,
      );
    }

    const json = (await resp.json()) as { data?: { b64_json?: string }[] };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) {
      this.logger.error('Meal image generation returned no b64_json payload.');
      throw new ServiceUnavailableException('استجابة فارغة من مزود الصور.');
    }
    return { buffer: Buffer.from(b64, 'base64'), mimeType: 'image/png' };
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

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
    /* not JSON */
  }
  return trimmed.slice(0, 160);
}

function buildMealPrompt(meal: Meal, restaurant: Restaurant): string {
  const description = meal.description?.trim();
  const cuisine = restaurant.cuisineType
    ? restaurant.cuisineType.replace(/_/g, ' ')
    : 'restaurant food';

  return [
    MEAL_PROMPT_SYSTEM,
    '',
    `Dish name: "${meal.name.trim()}"`,
    description ? `Dish description: "${description.slice(0, 500)}"` : '',
    `Cuisine context: ${cuisine}`,
    '',
    'Output: a single appetizing photograph of THIS dish only.',
  ]
    .filter(Boolean)
    .join('\n');
}
