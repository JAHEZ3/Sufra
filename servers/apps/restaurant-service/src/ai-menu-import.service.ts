import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Restaurant, RestaurantStatus } from "./entities/restaurant.entity";
import { Menu } from "./entities/menu.entity";
import { MenuSection } from "./entities/menu-section.entity";
import { Meal } from "./entities/meal.entity";
import {
  MealOptionGroup,
  MenuSelectionType,
} from "./entities/meal-option-group.entity";
import { MealOption } from "./entities/meal-option.entity";
import { S3Service } from "./s3.service";
import {
  ApplyMenuImportDto,
  MenuImportResult,
} from "./dto/ai-menu-import.dto";

type Language = "ar" | "en" | "mixed" | "unknown";

interface ExtractedSize {
  label: string;
  price?: number;
}

interface ExtractedItem {
  name: string;
  description?: string;
  price?: number;
  currency?: string;
  sizes?: ExtractedSize[];
}

interface ExtractedCategory {
  name: string;
  items: ExtractedItem[];
}

interface ExtractedOffer {
  name: string;
  description?: string;
  price?: number;
  currency?: string;
  items?: string[];
}

export interface MenuExtraction {
  restaurantName: string | null;
  language: Language;
  currency: string | null;
  categories: ExtractedCategory[];
  offers: ExtractedOffer[];
}

const SYSTEM_PROMPT = `You are a menu OCR + structuring engine for a restaurant SaaS.
You receive a single photo of a printed/digital menu and must return ONLY a strict JSON object — no prose, no markdown, no code fences.

Schema (every key required, use null / empty array if absent):
{
  "restaurantName": string | null,
  "language": "ar" | "en" | "mixed" | "unknown",
  "currency": string | null,         // ISO-like code: SAR, USD, EUR, AED, EGP, ...
  "categories": [
    {
      "name": string,
      "items": [
        {
          "name": string,
          "description": string | null,
          "price": number | null,
          "currency": string | null,
          "sizes": [ { "label": string, "price": number | null } ]
        }
      ]
    }
  ],
  "offers": [
    {
      "name": string,
      "description": string | null,
      "price": number | null,
      "currency": string | null,
      "items": [string]
    }
  ]
}

Rules:
- Preserve the menu's original language for names/descriptions (Arabic stays Arabic).
- Detect prices precisely. Strip currency symbols from numeric fields, but populate "currency".
- Normalize size labels to short forms when possible: "Small", "Medium", "Large", "صغير", "وسط", "كبير".
- Combos / set meals / "offers" go under "offers", not categories.
- If you cannot read something, omit it rather than guessing.
- Output JSON ONLY. No leading/trailing text.`;

@Injectable()
export class AiMenuImportService {
  private readonly logger = new Logger(AiMenuImportService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly s3: S3Service,
    @InjectRepository(Restaurant)
    private readonly restaurantRepo: Repository<Restaurant>,
    @InjectRepository(Menu)
    private readonly menuRepo: Repository<Menu>,
    @InjectRepository(MenuSection)
    private readonly sectionRepo: Repository<MenuSection>,
    @InjectRepository(Meal)
    private readonly mealRepo: Repository<Meal>,
    @InjectRepository(MealOptionGroup)
    private readonly optionGroupRepo: Repository<MealOptionGroup>,
    @InjectRepository(MealOption)
    private readonly optionRepo: Repository<MealOption>,
  ) {}

  // ─── Analyze ─────────────────────────────────────────────────────────────
  // Receives an image, stores it temporarily in S3 (best-effort), forwards it
  // to a Vision LLM, parses the response into our schema and returns it.
  async analyzeMenu(
    file: Express.Multer.File | undefined,
  ): Promise<{ extraction: MenuExtraction; tempKey: string | null }> {
    if (!file) throw new BadRequestException("صورة القائمة مطلوبة.");
    if (!file.mimetype?.startsWith("image/")) {
      throw new BadRequestException("يجب أن يكون الملف صورة.");
    }
    if (!SUPPORTED_VISION_MIMETYPES.has(file.mimetype.toLowerCase())) {
      throw new BadRequestException(
        "صيغة الصورة غير مدعومة. يرجى رفع صورة بصيغة PNG أو JPEG أو GIF أو WEBP.",
      );
    }

    // Best-effort temporary storage. Failure to upload doesn't block analysis;
    // the buffer is still sent inline to the model.
    let tempKey: string | null = null;
    try {
      tempKey = await this.s3.upload(
        { ...file, fieldname: "menu-import" } as Express.Multer.File,
        "temp/ai-menu",
      );
    } catch (err) {
      this.logger.warn(
        `Temp S3 upload failed; proceeding with inline analysis only: ${(err as Error)?.message}`,
      );
    }

    let extraction: MenuExtraction;
    try {
      extraction = await this.callVisionModel(file);
    } catch (err) {
      // Always attempt cleanup on failure.
      if (tempKey) {
        this.s3
          .delete(tempKey)
          .catch((cleanupErr) =>
            this.logger.warn(
              `Failed to delete temp menu image ${tempKey}: ${(cleanupErr as Error)?.message}`,
            ),
          );
      }
      throw err;
    }

    // Success path: temp object is no longer needed.
    if (tempKey) {
      this.s3
        .delete(tempKey)
        .catch((err) =>
          this.logger.warn(
            `Failed to delete temp menu image ${tempKey}: ${(err as Error)?.message}`,
          ),
        );
    }

    return { extraction, tempKey: null };
  }

  // ─── Apply ───────────────────────────────────────────────────────────────
  // Takes an (optionally edited) extraction and persists it: optionally
  // creates a new menu, then creates sections + meals. Items with multiple
  // sizes get a "Size" option group. Offers become a dedicated section.
  async applyMenuImport(
    ownerId: string,
    dto: ApplyMenuImportDto,
  ): Promise<MenuImportResult> {
    const restaurant = await this.restaurantRepo.findOne({
      where: { ownerUserId: ownerId },
    });
    if (!restaurant) {
      throw new BadRequestException("لم يُعثر على مطعم لهذا الحساب.");
    }
    if (
      restaurant.status !== RestaurantStatus.ACTIVE &&
      restaurant.status !== RestaurantStatus.PENDING_APPROVAL
    ) {
      throw new BadRequestException(
        "لا يمكن استيراد القائمة لحساب غير نشط.",
      );
    }

    const data = dto.extraction;
    if (!data || !Array.isArray(data.categories)) {
      throw new BadRequestException("بيانات الاستيراد غير صالحة.");
    }

    let menuId = dto.targetMenuId ?? null;
    let createdMenu = false;

    if (!menuId) {
      const menu = await this.menuRepo.save(
        this.menuRepo.create({
          restaurantId: restaurant.id,
          name:
            dto.menuName?.trim() ||
            data.restaurantName?.trim() ||
            "Imported Menu",
          isActive: true,
          displayOrder: 0,
        }),
      );
      menuId = menu.id;
      createdMenu = true;
    } else {
      const existing = await this.menuRepo.findOne({ where: { id: menuId } });
      if (!existing || existing.restaurantId !== restaurant.id) {
        throw new BadRequestException("القائمة المحددة غير صالحة.");
      }
    }

    let sectionsCreated = 0;
    let mealsCreated = 0;
    let optionGroupsCreated = 0;
    let optionsCreated = 0;

    await this.menuRepo.manager.transaction(async (em) => {
      let order = 0;
      for (const cat of data.categories) {
        if (!cat?.name?.trim() || !Array.isArray(cat.items)) continue;

        const section = await em.save(
          em.create(MenuSection, {
            menuId: menuId!,
            name: cat.name.trim().slice(0, 100),
            displayOrder: order++,
          }),
        );
        sectionsCreated++;

        let mealOrder = 0;
        for (const item of cat.items) {
          if (!item?.name?.trim()) continue;
          const basePrice = pickBasePrice(item);
          if (basePrice == null) continue; // skip items we can't price

          const meal = await em.save(
            em.create(Meal, {
              restaurantId: restaurant.id,
              sectionId: section.id,
              name: item.name.trim().slice(0, 200),
              description: item.description?.trim() || null,
              basePrice,
              isAvailable: true,
              isFeatured: false,
              displayOrder: mealOrder++,
            }),
          );
          mealsCreated++;

          // Multiple sizes → create a "Size" option group
          if (Array.isArray(item.sizes) && item.sizes.length >= 2) {
            const group = await em.save(
              em.create(MealOptionGroup, {
                mealId: meal.id,
                name:
                  data.language === "ar" ? "الحجم" : "Size",
                selectionType: MenuSelectionType.SINGLE,
                isRequired: true,
                maxSelections: 1,
              }),
            );
            optionGroupsCreated++;

            // Compute extras as size price - basePrice (smallest = 0)
            const minSizePrice =
              item.sizes
                .map((s) => Number(s.price))
                .filter((n) => Number.isFinite(n))
                .reduce((a, b) => Math.min(a, b), Number.POSITIVE_INFINITY);
            for (const sz of item.sizes) {
              if (!sz?.label?.trim()) continue;
              const p = Number(sz.price);
              const extra =
                Number.isFinite(p) && Number.isFinite(minSizePrice)
                  ? Math.max(0, p - minSizePrice)
                  : 0;
              await em.save(
                em.create(MealOption, {
                  groupId: group.id,
                  name: sz.label.trim().slice(0, 100),
                  extraPrice: extra,
                  isAvailable: true,
                }),
              );
              optionsCreated++;
            }
          }
        }
      }

      // Offers → dedicated section
      if (Array.isArray(data.offers) && data.offers.length > 0) {
        const offerSection = await em.save(
          em.create(MenuSection, {
            menuId: menuId!,
            name: data.language === "ar" ? "العروض" : "Offers",
            displayOrder: order++,
          }),
        );
        sectionsCreated++;

        let offerOrder = 0;
        for (const offer of data.offers) {
          if (!offer?.name?.trim()) continue;
          const basePrice = Number(offer.price);
          if (!Number.isFinite(basePrice)) continue;
          const description = [
            offer.description,
            offer.items?.length ? `• ${offer.items.join(" • ")}` : null,
          ]
            .filter(Boolean)
            .join("\n");

          await em.save(
            em.create(Meal, {
              restaurantId: restaurant.id,
              sectionId: offerSection.id,
              name: offer.name.trim().slice(0, 200),
              description: description || null,
              basePrice,
              isAvailable: true,
              isFeatured: true,
              displayOrder: offerOrder++,
            }),
          );
          mealsCreated++;
        }
      }
    });

    return {
      createdMenu,
      menuId: menuId!,
      sectionsCreated,
      mealsCreated,
      optionGroupsCreated,
      optionsCreated,
    };
  }

  // ─── Vision provider ─────────────────────────────────────────────────────
  // OpenAI only (gpt-4o family) via OPENAI_API_KEY.
  private async callVisionModel(
    file: Express.Multer.File,
  ): Promise<MenuExtraction> {
    const openaiKey = this.config.get<string>("OPENAI_API_KEY");

    if (openaiKey) return this.callOpenAi(file, openaiKey);

    throw new ServiceUnavailableException(
      "خدمة الذكاء الاصطناعي غير مهيأة. يرجى ضبط OPENAI_API_KEY.",
    );
  }

  private async callOpenAi(
    file: Express.Multer.File,
    apiKey: string,
  ): Promise<MenuExtraction> {
    const model = this.config.get<string>(
      "OPENAI_VISION_MODEL",
      "gpt-4o-mini",
    );
    const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;

    const body = {
      model,
      response_format: { type: "json_object" },
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract the menu from this image and return ONLY the JSON object described in the system message.",
            },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    };

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      this.logger.error(`OpenAI vision failed (${resp.status}): ${errText}`);
      throw new ServiceUnavailableException(
        `تعذّر تحليل الصورة عبر مزود الذكاء الاصطناعي. (OpenAI HTTP ${resp.status}: ${extractUpstreamReason(errText)})`,
      );
    }

    const json = (await resp.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    return parseAndNormalize(content, this.logger);
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Mime types accepted by OpenAI vision. */
const SUPPORTED_VISION_MIMETYPES = new Set<string>([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
]);

/**
 * Pull a short, client-safe reason out of a vendor error body. OpenAI returns
 * `{ error: { message, code, type } }`. Falls back to the raw text. Trimmed to 160 chars.
 */
function extractUpstreamReason(body: string): string {
  const trimmed = (body ?? "").trim();
  if (!trimmed) return "no body";
  try {
    const parsed = JSON.parse(trimmed) as {
      error?: { message?: string; code?: string; type?: string };
    };
    const msg = parsed.error?.message;
    if (typeof msg === "string" && msg.trim()) return msg.trim().slice(0, 160);
  } catch {
    /* not JSON — fall through to raw */
  }
  return trimmed.slice(0, 160);
}

function pickBasePrice(item: ExtractedItem): number | null {
  const direct = Number(item.price);
  if (Number.isFinite(direct) && direct >= 0) return direct;
  if (Array.isArray(item.sizes) && item.sizes.length > 0) {
    const sizePrices = item.sizes
      .map((s) => Number(s.price))
      .filter((n) => Number.isFinite(n) && n >= 0);
    if (sizePrices.length > 0) return Math.min(...sizePrices);
  }
  return null;
}

function parseAndNormalize(raw: string, logger: Logger): MenuExtraction {
  // Strip code fences if the model ignored the "no markdown" rule.
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    logger.error(`AI returned non-JSON output: ${cleaned.slice(0, 500)}`);
    throw new ServiceUnavailableException(
      "تعذّر فهم استجابة الذكاء الاصطناعي.",
    );
  }

  const language = normalizeLanguage(parsed.language);
  const currency =
    typeof parsed.currency === "string" && parsed.currency.trim()
      ? parsed.currency.trim().toUpperCase()
      : null;

  const categories: ExtractedCategory[] = Array.isArray(parsed.categories)
    ? parsed.categories
        .map((c: any) => ({
          name: typeof c?.name === "string" ? c.name : "",
          items: Array.isArray(c?.items)
            ? c.items.map(normalizeItem).filter((i: ExtractedItem) => i.name)
            : [],
        }))
        .filter((c: ExtractedCategory) => c.name)
    : [];

  const offers: ExtractedOffer[] = Array.isArray(parsed.offers)
    ? parsed.offers
        .map((o: any) => ({
          name: typeof o?.name === "string" ? o.name : "",
          description:
            typeof o?.description === "string" ? o.description : undefined,
          price: numberOrUndef(o?.price),
          currency:
            typeof o?.currency === "string" ? o.currency.toUpperCase() : undefined,
          items: Array.isArray(o?.items)
            ? o.items.filter((s: unknown): s is string => typeof s === "string")
            : [],
        }))
        .filter((o: ExtractedOffer) => o.name)
    : [];

  return {
    restaurantName:
      typeof parsed.restaurantName === "string" && parsed.restaurantName.trim()
        ? parsed.restaurantName.trim()
        : null,
    language,
    currency,
    categories,
    offers,
  };
}

function normalizeItem(raw: any): ExtractedItem {
  const sizes: ExtractedSize[] = Array.isArray(raw?.sizes)
    ? raw.sizes
        .map((s: any) => ({
          label: typeof s?.label === "string" ? s.label : "",
          price: numberOrUndef(s?.price),
        }))
        .filter((s: ExtractedSize) => s.label)
    : [];

  return {
    name: typeof raw?.name === "string" ? raw.name : "",
    description:
      typeof raw?.description === "string" ? raw.description : undefined,
    price: numberOrUndef(raw?.price),
    currency:
      typeof raw?.currency === "string" ? raw.currency.toUpperCase() : undefined,
    sizes,
  };
}

function numberOrUndef(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function normalizeLanguage(v: unknown): Language {
  if (typeof v !== "string") return "unknown";
  const s = v.toLowerCase().trim();
  if (s === "ar" || s === "arabic") return "ar";
  if (s === "en" || s === "english") return "en";
  if (s === "mixed") return "mixed";
  return "unknown";
}
