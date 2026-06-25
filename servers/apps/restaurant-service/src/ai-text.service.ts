import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * Reusable text/chat LLM client for restaurant-service AI features.
 *
 * Provider: OpenAI only (OPENAI_API_KEY). All text features
 * (menu copywriting, analytics summaries, review replies, …) call chat().
 */
@Injectable()
export class AiTextService {
  private readonly logger = new Logger(AiTextService.name);

  constructor(private readonly config: ConfigService) {}

  /** Whether the OpenAI provider is configured. */
  isConfigured(): boolean {
    return Boolean(this.config.get<string>("OPENAI_API_KEY"));
  }

  /**
   * Single-turn completion: a system instruction + a user message → plain text.
   * Throws ServiceUnavailableException when OpenAI isn't configured or the
   * upstream call fails.
   */
  async chat(opts: {
    system: string;
    user: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<string> {
    const openaiKey = this.config.get<string>("OPENAI_API_KEY");

    if (openaiKey) return this.callOpenAi(opts, openaiKey);

    throw new ServiceUnavailableException(
      "خدمة الذكاء الاصطناعي غير مهيأة. يرجى ضبط OPENAI_API_KEY.",
    );
  }

  private async callOpenAi(
    opts: { system: string; user: string; maxTokens?: number; temperature?: number },
    apiKey: string,
  ): Promise<string> {
    const model = this.config.get<string>("OPENAI_TEXT_MODEL", "gpt-4o-mini");
    const body = {
      model,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 512,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
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
      this.logger.error(`OpenAI chat failed (${resp.status}): ${errText}`);
      throw new ServiceUnavailableException(
        "تعذّر توليد النص عبر مزود الذكاء الاصطناعي.",
      );
    }

    const json = (await resp.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return (json.choices?.[0]?.message?.content ?? "").trim();
  }
}
