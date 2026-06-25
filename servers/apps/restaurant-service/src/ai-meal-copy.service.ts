import { Injectable } from "@nestjs/common";
import { AiTextService } from "./ai-text.service";
import { MealCopyDto } from "./dto/meal-copy.dto";

const SYSTEM_PROMPT = `أنت كاتب محتوى تسويقي لقوائم المطاعم.
اكتب وصفاً عربياً واحداً جذاباً وقصيراً لصنف في قائمة طعام.
القواعد:
- جملة أو جملتان فقط (من ١٠ إلى ٢٥ كلمة).
- لغة عربية فصيحة وبسيطة، بنبرة شهية تفتح الشهية.
- صف المكوّنات أو الطعم أو طريقة التقديم بشكل واقعي حسب اسم الصنف.
- لا تذكر السعر، ولا تستخدم رموزاً تعبيرية، ولا علامات اقتباس.
- أعد الوصف فقط، بدون أي مقدمات أو شرح.`;

@Injectable()
export class AiMealCopyService {
  constructor(private readonly ai: AiTextService) {}

  /** Generate a short Arabic marketing description for a menu item. */
  async generateDescription(dto: MealCopyDto): Promise<{ description: string }> {
    const lines = [`اسم الصنف: ${dto.name.trim()}`];
    if (dto.sectionName?.trim()) lines.push(`القسم: ${dto.sectionName.trim()}`);
    if (typeof dto.price === "number") lines.push(`السعر التقريبي: ${dto.price}`);
    lines.push("اكتب وصفاً تسويقياً عربياً واحداً لهذا الصنف.");

    const text = await this.ai.chat({
      system: SYSTEM_PROMPT,
      user: lines.join("\n"),
      maxTokens: 200,
      temperature: 0.8,
    });

    // Trim stray quotes/whitespace the model may add.
    const description = text.replace(/^["'«»\s]+|["'«»\s]+$/g, "").trim();
    return { description };
  }
}
