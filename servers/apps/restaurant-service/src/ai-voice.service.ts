import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { OrderVoiceDto } from "./dto/order-voice.dto";

// Customer-facing spoken phrases per status (warmer than the staff labels).
const CUSTOMER_AR: Record<string, string> = {
  pending: "تم استلام طلبك، بانتظار تأكيد المطعم.",
  open: "طلبك قيد التحضير الآن.",
  preparing: "طلبك قيد التحضير الآن.",
  done: "اكتمل طلبك، شكراً لك ونتمنى لك وجبة شهية.",
  delivered: "اكتمل طلبك، شكراً لك.",
  voided: "نأسف، تم إلغاء طلبك. يرجى التواصل مع طاقم المطعم.",
  cancelled: "نأسف، تم إلغاء طلبك.",
};

// Arabic labels for every order status the gateway may broadcast.
const STATUS_AR: Record<string, string> = {
  pending: "قيد الانتظار",
  confirmed: "مؤكد",
  preparing: "قيد التحضير",
  open: "قيد التحضير",
  ready_for_pickup: "جاهز للاستلام",
  ready: "جاهز",
  out_for_delivery: "قيد التقديم",
  done: "مكتمل",
  delivered: "مكتمل",
  cancelled: "ملغي",
  voided: "ملغي",
  refunded: "مسترجع",
};

@Injectable()
export class AiVoiceService {
  private readonly logger = new Logger(AiVoiceService.name);
  private client: ElevenLabsClient | null = null;

  constructor(private readonly config: ConfigService) {}

  private getClient(): ElevenLabsClient {
    const apiKey = this.config.get<string>("ELEVENLABS_API_KEY");
    if (!apiKey) {
      throw new ServiceUnavailableException(
        "خدمة الصوت غير مهيأة. يرجى ضبط ELEVENLABS_API_KEY.",
      );
    }
    if (!this.client) this.client = new ElevenLabsClient({ apiKey });
    return this.client;
  }

  /** Build the spoken Arabic sentence for an order-status update. */
  private buildMessage(dto: OrderVoiceDto): string {
    const statusAr = STATUS_AR[dto.status] ?? dto.status;
    return dto.orderNumber
      ? `الطلب رقم ${dto.orderNumber}، الحالة: ${statusAr}.`
      : `تحديث حالة الطلب: ${statusAr}.`;
  }

  /** Synthesize an Arabic announcement and return the MP3 bytes. */
  async announceOrderStatus(dto: OrderVoiceDto): Promise<Buffer> {
    return this.synthesize(this.buildMessage(dto));
  }

  // Cache the customer phrases — there are only a handful and they're identical
  // for every customer, so we never re-bill ElevenLabs for the same status.
  private readonly customerCache = new Map<string, Buffer>();

  /** Public, customer-facing voice line for a status change (cached). */
  async announceCustomerStatus(status: string): Promise<Buffer> {
    const text = CUSTOMER_AR[status];
    if (!text) throw new BadRequestException("حالة غير مدعومة.");
    const cached = this.customerCache.get(status);
    if (cached) return cached;
    const audio = await this.synthesize(text);
    this.customerCache.set(status, audio);
    return audio;
  }

  /** Core ElevenLabs call: Arabic text → MP3 bytes. */
  private async synthesize(text: string): Promise<Buffer> {
    const client = this.getClient();
    const voiceId = this.config.get<string>(
      "ELEVENLABS_VOICE_ID",
      "IES4nrmZdUBHByLBde0P",
    );
    const modelId = this.config.get<string>("ELEVENLABS_MODEL_ID", "eleven_v3");

    try {
      const stream = await client.textToSpeech.convert(voiceId, {
        text,
        modelId,
        languageCode: "ar",
        outputFormat: "mp3_44100_128",
      });
      return await collectStream(stream);
    } catch (err) {
      this.logger.error(
        `ElevenLabs TTS failed: ${(err as Error)?.message ?? err}`,
      );
      throw new ServiceUnavailableException("تعذّر توليد الرسالة الصوتية.");
    }
  }
}

/** Collect a web ReadableStream or Node Readable of bytes into a Buffer. */
async function collectStream(
  stream: ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>,
): Promise<Buffer> {
  const chunks: Buffer[] = [];

  // Web ReadableStream (what the SDK returns on Node 18+).
  if (typeof (stream as ReadableStream<Uint8Array>).getReader === "function") {
    const reader = (stream as ReadableStream<Uint8Array>).getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  }

  // Fallback: async-iterable (Node Readable).
  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
