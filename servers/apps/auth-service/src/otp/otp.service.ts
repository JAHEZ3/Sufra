import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import * as bcrypt from "bcrypt";
import { OtpPurpose } from "../entities/otp-code.entity";

interface OtpRecord {
  codeHash: string;
  attempts: number;
}

interface RateRecord {
  count: number;
  windowStart: number;
}

const OTP_TTL_MS = 2 * 60 * 1000;
const OTP_RATE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 3;
const MAX_OTP_SENDS = 3;

@Injectable()
export class OtpService {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  private otpKey(userId: string, purpose: OtpPurpose): string {
    return `otp:${purpose}:${userId}`;
  }

  private rateKey(userId: string, purpose: OtpPurpose): string {
    return `otp_rate:${purpose}:${userId}`;
  }

  async saveOtp(userId: string, purpose: OtpPurpose, phone: string): Promise<void> {
    const existing = await this.cache.get<OtpRecord>(this.otpKey(userId, purpose));
    if (existing && existing.attempts < MAX_VERIFY_ATTEMPTS) {
      throw new BadRequestException(
        "تم إرسال رمز التحقق بالفعل وما زال صالحاً. راجع هاتفك.",
      );
    }

    await this.checkRateLimit(userId, purpose);

    const code = Math.floor(100_000 + Math.random() * 900_000).toString();
    const codeHash = await bcrypt.hash(code, 10);

    await this.cache.set(
      this.otpKey(userId, purpose),
      { codeHash, attempts: 0 } satisfies OtpRecord,
      OTP_TTL_MS,
    );

    // Mock SMS — استبدله بمزود SMS حقيقي (مثل Twilio)
    console.log(
      `[OTP] Phone: ${phone} | Code: ${code} | Purpose: ${purpose} | Expires: 2 min`,
    );
  }

  async verifyOtp(userId: string, purpose: OtpPurpose, plainCode: string): Promise<void> {
    const record = await this.cache.get<OtpRecord>(this.otpKey(userId, purpose));

    if (!record) {
      throw new BadRequestException(
        "رمز التحقق غير موجود أو منتهي الصلاحية. اطلب رمزاً جديداً.",
      );
    }

    if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
      await this.cache.del(this.otpKey(userId, purpose));
      const canResend = await this.canRequestNewCode(userId, purpose);
      if (canResend) {
        throw new BadRequestException(
          "تجاوزت الحد الأقصى للمحاولات. يمكنك طلب رمز تحقق جديد.",
        );
      } else {
        const hoursLeft = await this.hoursUntilReset(userId, purpose);
        throw new BadRequestException(
          `تجاوزت الحد الأقصى للمحاولات والحد اليومي. حاول مجدداً بعد ${hoursLeft} ساعة.`,
        );
      }
    }

    await this.cache.set(
      this.otpKey(userId, purpose),
      { ...record, attempts: record.attempts + 1 },
      OTP_TTL_MS,
    );

    const isMatch = await bcrypt.compare(plainCode, record.codeHash);
    if (!isMatch) {
      const attemptsLeft = MAX_VERIFY_ATTEMPTS - (record.attempts + 1);
      throw new BadRequestException(
        attemptsLeft > 0
          ? `رمز التحقق غير صحيح. تبقى ${attemptsLeft} محاولة.`
          : "رمز التحقق غير صحيح. لا توجد محاولات متبقية. اطلب رمزاً جديداً.",
      );
    }

    await this.cache.del(this.otpKey(userId, purpose));
    await this.cache.del(this.rateKey(userId, purpose));
  }

  async hasActiveOtp(userId: string, purpose: OtpPurpose): Promise<boolean> {
    const record = await this.cache.get<OtpRecord>(this.otpKey(userId, purpose));
    return !!record && record.attempts < MAX_VERIFY_ATTEMPTS;
  }

  async canRequestNewCode(userId: string, purpose: OtpPurpose): Promise<boolean> {
    const rate = await this.cache.get<RateRecord>(this.rateKey(userId, purpose));
    return !rate || rate.count < MAX_OTP_SENDS;
  }

  private async hoursUntilReset(userId: string, purpose: OtpPurpose): Promise<number> {
    const rate = await this.cache.get<RateRecord>(this.rateKey(userId, purpose));
    if (!rate) return 0;
    const resetInMs = OTP_RATE_TTL_MS - (Date.now() - rate.windowStart);
    return Math.max(1, Math.ceil(resetInMs / (60 * 60 * 1000)));
  }

  private async checkRateLimit(userId: string, purpose: OtpPurpose): Promise<void> {
    const rate = await this.cache.get<RateRecord>(this.rateKey(userId, purpose));
    const now = Date.now();

    if (!rate) {
      await this.cache.set(
        this.rateKey(userId, purpose),
        { count: 1, windowStart: now } satisfies RateRecord,
        OTP_RATE_TTL_MS,
      );
      return;
    }

    if (rate.count >= MAX_OTP_SENDS) {
      const hoursLeft = Math.max(
        1,
        Math.ceil((OTP_RATE_TTL_MS - (now - rate.windowStart)) / (60 * 60 * 1000)),
      );
      throw new BadRequestException(
        `تم الوصول إلى الحد اليومي لرمز التحقق. يمكنك الطلب مجدداً بعد ${hoursLeft} ساعة.`,
      );
    }

    const remainingTTL = Math.max(1, OTP_RATE_TTL_MS - (now - rate.windowStart));
    await this.cache.set(
      this.rateKey(userId, purpose),
      { count: rate.count + 1, windowStart: rate.windowStart } satisfies RateRecord,
      remainingTTL,
    );
  }
}
