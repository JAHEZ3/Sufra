import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, Repository } from "typeorm";
import { ClientProxy } from "@nestjs/microservices";
import * as bcrypt from "bcrypt";
import { User, UserRole, UserStatus } from "./entities/user.entity";
import { AdminListUsersDto } from "./dto/admin-list-users.dto";
import { AdminUpdateUserDto } from "./dto/admin-update-user.dto";
import { AdminChangeStatusDto } from "./dto/admin-change-status.dto";
import { OtpPurpose } from "./entities/otp-code.entity";
import { AppJwtService, SessionContext } from "./jwt/jwt.service";
import { OtpService } from "./otp/otp.service";
import {
  RegisterCustomerDto,
  RegisterDeliveryDto,
  RegisterRestaurantDto,
} from "./dto/register.dto";
import {
  DeliveryLoginOtpDto,
  LoginCustomerDto,
  LoginDeliveryDto,
  LoginManagerDto,
  LoginRestaurantDto,
} from "./dto/login.dto";
import { ResendOtpDto, VerifyOtpDto } from "./dto/verify-otp.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { normalizePhone, PhoneNormalizationError } from "./utils/phone.util";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly otpService: OtpService,
    private readonly jwtService: AppJwtService,
    @Inject("NATS_SERVICE")
    private readonly natsClient: ClientProxy,
    @Inject(CACHE_MANAGER)
    private readonly cache: Cache,
  ) {}

  // ─── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Funnel every user-supplied phone through one canonical form (E.164) so the
   * same human always resolves to the same row, no matter how they typed it.
   * Throws a friendly 400 when the number can't be a valid PS/IL mobile.
   */
  private normalize(phone: string): string {
    try {
      return normalizePhone(phone);
    } catch (err) {
      if (err instanceof PhoneNormalizationError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
  }

  private loginAttemptKey(identifier: string): string {
    return `login_fail:${identifier}`;
  }

  private async checkLoginRateLimit(identifier: string): Promise<void> {
    try {
      const record = await this.cache.get<{ count: number; lockedUntil?: number }>(
        this.loginAttemptKey(identifier),
      );
      if (record?.lockedUntil && Date.now() < record.lockedUntil) {
        const minutesLeft = Math.ceil((record.lockedUntil - Date.now()) / 60_000);
        throw new UnauthorizedException(
          `محاولات فاشلة كثيرة. حاول مجدداً بعد ${minutesLeft} دقيقة.`,
        );
      }
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      this.logger.error('Redis error in checkLoginRateLimit — allowing request', err);
    }
  }

  private async recordFailedLogin(identifier: string): Promise<void> {
    try {
      const key = this.loginAttemptKey(identifier);
      const record = await this.cache.get<{ count: number; lockedUntil?: number }>(key) ?? { count: 0 };
      const count = record.count + 1;
      const LOCK_MS = 15 * 60 * 1000;
      if (count >= 5) {
        await this.cache.set(key, { count, lockedUntil: Date.now() + LOCK_MS }, LOCK_MS);
      } else {
        await this.cache.set(key, { count }, LOCK_MS);
      }
    } catch (err) {
      this.logger.error('Redis error in recordFailedLogin — skipping rate-limit record', err);
    }
  }

  private async clearLoginAttempts(identifier: string): Promise<void> {
    try {
      await this.cache.del(this.loginAttemptKey(identifier));
    } catch (err) {
      this.logger.error('Redis error in clearLoginAttempts — skipping', err);
    }
  }

  private async issuePair(user: User, context?: SessionContext) {
    const payload = {
      sub: user.id,
      role: user.role,
      ...(user.phone && { phone: user.phone }),
      ...(user.email && { email: user.email }),
      profileCompleted: user.profileCompleted,
    };
    return {
      accessToken: this.jwtService.signAccessToken(payload),
      refreshToken: await this.jwtService.signRefreshToken(payload, context),
    };
  }

  // ─── Registration ─────────────────────────────────────────────────────────────
  //
  // Shared pattern for all phone-based roles:
  //   1. Enter phone → if new: create PENDING user + send OTP
  //                  → if PENDING already: resend OTP
  //                  → if already verified: redirect to login
  //   2. Verify OTP  → SUSPENDED + tokens
  //   3. Complete profile in their own service
  //

  async registerCustomer(dto: RegisterCustomerDto) {
    dto.phone = this.normalize(dto.phone);
    const existing = await this.userRepo.findOne({
      where: { phone: dto.phone },
    });

    if (existing) {
      if (existing.role !== UserRole.CUSTOMER) {
        throw new ConflictException(
          "رقم الهاتف مسجل بالفعل لنوع حساب مختلف.",
        );
      }
      if (existing.status === UserStatus.BANNED) {
        throw new UnauthorizedException("الحساب محظور. تواصل مع الدعم.");
      }
      if (existing.status === UserStatus.PENDING) {
        await this.otpService.saveOtp(
          existing.id,
          OtpPurpose.PHONE_VERIFY,
          existing.phone,
        );
        return {
          data: { phone: existing.phone },
          message: "الحساب قيد التحقق. تم إرسال رمز جديد.",
        };
      }
      throw new ConflictException(
        "رقم الهاتف مسجل بالفعل. يرجى تسجيل الدخول.",
      );
    }

    const user = await this.userRepo.save(
      this.userRepo.create({
        phone: dto.phone,
        role: UserRole.CUSTOMER,
        status: UserStatus.PENDING,
        ...(dto.deviceInfo && { deviceInfo: dto.deviceInfo }),
      }),
    );

    // customer-service creates the profile stub
    try {
      this.natsClient.emit("user.customer.created", { userId: user.id, phone: user.phone });
    } catch (err) {
      this.logger.error("NATS emit user.customer.created failed", err);
    }
    await this.otpService.saveOtp(user.id, OtpPurpose.PHONE_VERIFY, user.phone);

    return {
      data: { phone: user.phone },
      message: "تم إنشاء الحساب. تم إرسال رمز التحقق إلى هاتفك.",
    };
  }

  async registerDelivery(dto: RegisterDeliveryDto) {
    dto.phone = this.normalize(dto.phone);
    const existing = await this.userRepo.findOne({
      where: { phone: dto.phone },
    });

    if (existing) {
      if (existing.role !== UserRole.DELIVERY) {
        throw new ConflictException(
          "رقم الهاتف مسجل بالفعل تحت دور مختلف.",
        );
      }
      if (existing.status === UserStatus.BANNED) {
        throw new UnauthorizedException("الحساب محظور. تواصل مع الدعم.");
      }
      if (existing.status === UserStatus.PENDING) {
        await this.otpService.saveOtp(
          existing.id,
          OtpPurpose.PHONE_VERIFY,
          existing.phone,
        );
        return {
          data: { phone: existing.phone },
          message: "الحساب قيد التحقق. تم إرسال رمز جديد.",
        };
      }
      throw new ConflictException(
        "رقم الهاتف مسجل بالفعل. يرجى تسجيل الدخول.",
      );
    }

    const user = await this.userRepo.save(
      this.userRepo.create({
        phone: dto.phone,
        role: UserRole.DELIVERY,
        status: UserStatus.PENDING,
      }),
    );

    await this.otpService.saveOtp(user.id, OtpPurpose.PHONE_VERIFY, user.phone);
    return {
      data: { phone: user.phone },
      message: "تم إنشاء الحساب. تم إرسال رمز التحقق إلى هاتفك.",
    };
  }

  async registerRestaurant(dto: RegisterRestaurantDto, context?: SessionContext) {
    dto.phone = this.normalize(dto.phone);
    const existing = await this.userRepo.findOne({
      where: { phone: dto.phone },
    });

    if (existing) {
      if (existing.role !== UserRole.RESTAURANT_OWNER) {
        throw new ConflictException("رقم الهاتف مسجل بالفعل تحت دور مختلف.");
      }
      if (existing.status === UserStatus.BANNED) {
        throw new UnauthorizedException("الحساب محظور. تواصل مع الدعم.");
      }
      throw new ConflictException("رقم الهاتف مسجل بالفعل. يرجى تسجيل الدخول.");
    }

    // One-step signup: no OTP, no manager approval — the account is active now.
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.userRepo.save(
      this.userRepo.create({
        phone: dto.phone,
        role: UserRole.RESTAURANT_OWNER,
        status: UserStatus.ACTIVE,
        passwordHash,
        profileCompleted: true,
        phoneVerifiedAt: new Date(),
      }),
    );

    // restaurant-service creates the active profile with the chosen name
    try {
      this.natsClient.emit("user.restaurant.created", {
        userId: user.id,
        phone: user.phone,
        name: dto.restaurantName,
      });
    } catch (err) {
      this.logger.error("NATS emit user.restaurant.created failed", err);
    }

    const tokens = await this.issuePair(user, context);
    return {
      data: tokens,
      message: "تم إنشاء حسابك وتفعيله بنجاح.",
    };
  }

  // ─── OTP Verification (registration) ─────────────────────────────────────────
  // PENDING → SUSPENDED for all roles. Tokens are issued immediately so the
  // client can call the downstream service profile-completion endpoint.

  async verifyRegistrationOtp(dto: VerifyOtpDto, context?: SessionContext) {
    dto.phone = this.normalize(dto.phone);
    const user = await this.userRepo.findOne({ where: { phone: dto.phone } });
    if (!user) throw new NotFoundException("المستخدم غير موجود.");
    if (user.role === UserRole.MANAGER) {
      throw new BadRequestException(
        "التحقق برمز OTP لا ينطبق على حسابات المديرين.",
      );
    }
    if (user.status !== UserStatus.PENDING) {
      throw new BadRequestException(
        "تم التحقق من رقم الهاتف. يرجى تسجيل الدخول.",
      );
    }

    await this.otpService.verifyOtp(user.id, OtpPurpose.PHONE_VERIFY, dto.otp);

    await this.userRepo.update(user.id, {
      phoneVerifiedAt: new Date(),
      status: UserStatus.SUSPENDED,
    });
    user.phoneVerifiedAt = new Date();
    user.status = UserStatus.SUSPENDED;
    user.profileCompleted = false;

    const tokens = await this.issuePair(user, context);

    const message =
      user.role === UserRole.CUSTOMER
        ? "تم التحقق من هاتفك. أكمل ملفك الشخصي."
        : "تم التحقق من هاتفك. أكمل ملفك الشخصي وقدّم طلبك للمراجعة.";

    return { data: tokens, message };
  }

  // ─── Resend OTP (registration phase only) ────────────────────────────────────

  async resendOtp(dto: ResendOtpDto) {
    dto.phone = this.normalize(dto.phone);
    const user = await this.userRepo.findOne({ where: { phone: dto.phone } });
    if (!user) throw new NotFoundException("المستخدم غير موجود.");
    if (user.role === UserRole.MANAGER)
      throw new BadRequestException("رمز OTP لا ينطبق على المديرين.");
    if (user.status === UserStatus.BANNED)
      throw new UnauthorizedException("الحساب محظور.");
    if (user.status !== UserStatus.PENDING) {
      throw new BadRequestException(
        "تم التحقق من رقم الهاتف. استخدم تسجيل الدخول.",
      );
    }
    if (
      !(await this.otpService.canRequestNewCode(
        user.id,
        OtpPurpose.PHONE_VERIFY,
      ))
    ) {
      throw new BadRequestException(
        "تم بلوغ الحد اليومي لرمز التحقق. حاول مجدداً بعد 24 ساعة.",
      );
    }
    await this.otpService.saveOtp(user.id, OtpPurpose.PHONE_VERIFY, user.phone);
    return { data: { phone: user.phone }, message: "تم إعادة إرسال رمز التحقق." };
  }

  // ─── Customer Login (OTP-based, two-step) ────────────────────────────────────

  async loginCustomer(dto: LoginCustomerDto) {
    dto.phone = this.normalize(dto.phone);
    const user = await this.userRepo.findOne({
      where: { phone: dto.phone, role: UserRole.CUSTOMER },
    });
    if (!user)
      throw new NotFoundException(
        "لا يوجد حساب عميل لهذا الرقم.",
      );

    if (user.status === UserStatus.BANNED)
      throw new UnauthorizedException("الحساب محظور. تواصل مع الدعم.");
    if (user.status === UserStatus.PENDING) {
      throw new BadRequestException(
        "رقم الهاتف غير مُحقَّق. يرجى التحقق من رمز OTP أولاً.",
      );
    }
    if (user.status === UserStatus.SUSPENDED && user.profileCompleted) {
      throw new UnauthorizedException("الحساب موقوف. تواصل مع الدعم.");
    }

    // ACTIVE → normal login OTP
    // SUSPENDED + !profileCompleted → also send OTP; verifyLoginOtp will issue tokens
    //   so the customer can immediately call POST /api/customer/profile
    await this.otpService.saveOtp(user.id, OtpPurpose.LOGIN, user.phone);
    return {
      data: { phone: user.phone },
      message:
        user.status === UserStatus.SUSPENDED
          ? "تم إرسال رمز التحقق. تحقق منه للحصول على رمز الوصول وإكمال ملفك."
          : "تم إرسال رمز تسجيل الدخول إلى هاتفك.",
    };
  }

  async verifyLoginOtp(dto: VerifyOtpDto, context?: SessionContext) {
    dto.phone = this.normalize(dto.phone);
    const user = await this.userRepo.findOne({ where: { phone: dto.phone } });
    if (!user) throw new NotFoundException("المستخدم غير موجود.");
    if (user.role !== UserRole.CUSTOMER)
      throw new BadRequestException("تسجيل الدخول برمز OTP متاح للعملاء فقط.");
    if (user.status === UserStatus.BANNED)
      throw new UnauthorizedException("الحساب محظور. تواصل مع الدعم.");
    if (user.status === UserStatus.PENDING)
      throw new BadRequestException("رقم الهاتف غير مُحقَّق.");
    // Allow ACTIVE and SUSPENDED+!profileCompleted — both get tokens.
    // SUSPENDED+profileCompleted means manually suspended by admin.
    if (user.status === UserStatus.SUSPENDED && user.profileCompleted)
      throw new UnauthorizedException("الحساب موقوف. تواصل مع الدعم.");

    await this.otpService.verifyOtp(user.id, OtpPurpose.LOGIN, dto.otp);
    await this.userRepo.update(user.id, { lastLoginAt: new Date() });
    user.lastLoginAt = new Date();
    const tokens = await this.issuePair(user, context);

    const message =
      user.status === UserStatus.SUSPENDED
        ? "تم التحقق من الرمز. يرجى إكمال ملفك الشخصي."
        : "تم تسجيل الدخول بنجاح.";

    return { data: tokens, message };
  }

  // ─── Delivery Login (phone + password) ───────────────────────────────────────

  async loginDelivery(dto: LoginDeliveryDto, context?: SessionContext) {
    dto.phone = this.normalize(dto.phone);
    await this.checkLoginRateLimit(dto.phone);

    const user = await this.userRepo.findOne({
      where: { phone: dto.phone, role: UserRole.DELIVERY },
    });
    if (!user) {
      await this.recordFailedLogin(dto.phone);
      throw new UnauthorizedException("بيانات الدخول غير صحيحة.");
    }

    if (user.status === UserStatus.BANNED)
      throw new UnauthorizedException("الحساب محظور. تواصل مع الدعم.");
    if (user.status === UserStatus.PENDING)
      throw new BadRequestException("يرجى التحقق من رقم هاتفك أولاً.");

    // No password means the agent verified their phone but never finished the
    // application form (password is set on first profile submission). Rather than
    // dead-ending them, tell the client to switch to the OTP-login fallback so
    // they can sign back in and resume the form. (Not an error — a 200 signal.)
    if (!user.passwordHash) {
      return {
        data: { needsOtp: true, phone: user.phone },
        message: "هذا الحساب يسجّل الدخول برمز التحقق. سيصلك رمز جديد.",
      };
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      await this.recordFailedLogin(dto.phone);
      throw new UnauthorizedException("بيانات الدخول غير صحيحة.");
    }

    await this.clearLoginAttempts(dto.phone);

    if (user.status === UserStatus.SUSPENDED) {
      await this.userRepo.update(user.id, { lastLoginAt: new Date() });
      user.lastLoginAt = new Date();
      const tokens = await this.issuePair(user, context);
      if (!user.profileCompleted) {
        // Password was set via forgot-password but profile not yet submitted.
        // Return tokens so they can reach the profile-completion endpoint.
        return {
          data: tokens,
          message:
            "تم تسجيل الدخول. أكمل ملفك الشخصي.",
        };
      }
      // Profile submitted — awaiting admin approval.
      return {
        data: tokens,
        message: "تم تسجيل الدخول. حسابك قيد موافقة الإدارة.",
      };
    }

    await this.userRepo.update(user.id, { lastLoginAt: new Date() });
    user.lastLoginAt = new Date();
    const tokens = await this.issuePair(user, context);
    return { data: tokens, message: "تم تسجيل الدخول بنجاح." };
  }

  // ─── Delivery OTP Login (fallback for agents with no password) ────────────────
  //
  // A driver who verified their phone but never finished the application form has
  // no password, so phone+password login can't work for them. This two-step flow
  // lets them sign back in with a one-time code and resume onboarding — without
  // creating a duplicate account or hitting a dead end.

  /** Step 1 — send a LOGIN OTP to an existing delivery account. */
  async sendDeliveryLoginOtp(dto: DeliveryLoginOtpDto) {
    const phone = this.normalize(dto.phone);

    const user = await this.userRepo.findOne({
      where: { phone, role: UserRole.DELIVERY },
    });
    // Unlike the password endpoint, this one is explicitly the "returning user"
    // entry point, so a clear 404 lets the client route a brand-new number to
    // registration instead of looping.
    if (!user) throw new NotFoundException("لا يوجد حساب سائق لهذا الرقم.");
    if (user.status === UserStatus.BANNED)
      throw new UnauthorizedException("الحساب محظور. تواصل مع الدعم.");
    if (user.status === UserStatus.PENDING)
      throw new BadRequestException("لم يتم التحقق من رقم هاتفك بعد. أكمل التسجيل أولاً.");

    await this.otpService.saveOtp(user.id, OtpPurpose.LOGIN, phone);
    return {
      data: { phone },
      message: "تم إرسال رمز تسجيل الدخول إلى هاتفك.",
    };
  }

  /** Step 2 — verify the LOGIN OTP and issue tokens for the delivery agent. */
  async verifyDeliveryLoginOtp(dto: VerifyOtpDto, context?: SessionContext) {
    const phone = this.normalize(dto.phone);

    const user = await this.userRepo.findOne({
      where: { phone, role: UserRole.DELIVERY },
    });
    if (!user) throw new NotFoundException("لا يوجد حساب سائق لهذا الرقم.");
    if (user.status === UserStatus.BANNED)
      throw new UnauthorizedException("الحساب محظور. تواصل مع الدعم.");
    if (user.status === UserStatus.PENDING)
      throw new BadRequestException("لم يتم التحقق من رقم هاتفك بعد.");
    // A manually-suspended, fully-onboarded agent is a real suspension, not the
    // "awaiting approval" SUSPENDED state — block them.
    if (user.status === UserStatus.SUSPENDED && user.profileCompleted)
      throw new UnauthorizedException("الحساب موقوف. تواصل مع الدعم.");

    await this.otpService.verifyOtp(user.id, OtpPurpose.LOGIN, dto.otp);
    await this.userRepo.update(user.id, { lastLoginAt: new Date() });
    user.lastLoginAt = new Date();

    const tokens = await this.issuePair(user, context);
    const message = !user.profileCompleted
      ? "تم تسجيل الدخول. أكمل ملفك الشخصي."
      : "تم تسجيل الدخول بنجاح.";
    return { data: tokens, message };
  }

  // ─── Restaurant Login (phone + password) ─────────────────────────────────────

  async loginRestaurant(dto: LoginRestaurantDto, context?: SessionContext) {
    dto.phone = this.normalize(dto.phone);
    await this.checkLoginRateLimit(dto.phone);

    const user = await this.userRepo.findOne({
      where: { phone: dto.phone, role: UserRole.RESTAURANT_OWNER },
    });
    if (!user) {
      await this.recordFailedLogin(dto.phone);
      throw new UnauthorizedException("بيانات الدخول غير صحيحة.");
    }

    if (user.status === UserStatus.BANNED)
      throw new UnauthorizedException("الحساب محظور. تواصل مع الدعم.");
    if (user.status === UserStatus.PENDING)
      throw new BadRequestException("يرجى التحقق من رقم هاتفك أولاً.");

    // No password means profile was never completed.
    if (!user.passwordHash) {
      throw new BadRequestException(
        "لم يتم تعيين كلمة مرور. سجّل من جديد لاستلام رمز الوصول وإكمال ملفك.",
      );
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      await this.recordFailedLogin(dto.phone);
      throw new UnauthorizedException("بيانات الدخول غير صحيحة.");
    }

    await this.clearLoginAttempts(dto.phone);

    if (user.status === UserStatus.SUSPENDED) {
      await this.userRepo.update(user.id, { lastLoginAt: new Date() });
      user.lastLoginAt = new Date();
      const tokens = await this.issuePair(user, context);
      if (!user.profileCompleted) {
        return {
          data: tokens,
          message:
            "تم تسجيل الدخول. أكمل ملفك الشخصي.",
        };
      }
      return {
        data: tokens,
        message: "تم تسجيل الدخول. حسابك قيد موافقة الإدارة.",
      };
    }

    await this.userRepo.update(user.id, { lastLoginAt: new Date() });
    user.lastLoginAt = new Date();
    const tokens = await this.issuePair(user, context);
    return { data: tokens, message: "تم تسجيل الدخول بنجاح." };
  }

  // ─── Manager Login (email + password) ────────────────────────────────────────

  async loginManager(dto: LoginManagerDto, context?: SessionContext) {
    await this.checkLoginRateLimit(dto.email);

    const user = await this.userRepo.findOne({
      where: { email: dto.email, role: UserRole.MANAGER },
    });
    if (!user || !user.passwordHash) {
      await this.recordFailedLogin(dto.email);
      throw new UnauthorizedException("بيانات الدخول غير صحيحة.");
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      await this.recordFailedLogin(dto.email);
      throw new UnauthorizedException("بيانات الدخول غير صحيحة.");
    }

    if (user.status !== UserStatus.ACTIVE)
      throw new UnauthorizedException("حساب المدير غير نشط.");

    await this.clearLoginAttempts(dto.email);
    await this.userRepo.update(user.id, { lastLoginAt: new Date() });
    user.lastLoginAt = new Date();
    const tokens = await this.issuePair(user, context);
    return { data: tokens, message: "تم تسجيل الدخول بنجاح." };
  }

  // ─── Password Management ──────────────────────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto) {
    if (!dto.phone && !dto.email)
      throw new BadRequestException("يرجى إدخال رقم الهاتف أو البريد الإلكتروني.");
    if (dto.phone) dto.phone = this.normalize(dto.phone);

    const user = dto.phone
      ? await this.userRepo.findOne({ where: { phone: dto.phone } })
      : await this.userRepo.findOne({ where: { email: dto.email } });

    if (!user)
      throw new NotFoundException("لا يوجد حساب لهذا الاتصال.");
    if (user.role === UserRole.CUSTOMER)
      throw new BadRequestException(
        "العملاء يسجلون الدخول برمز OTP وليس لديهم كلمة مرور.",
      );
    if (user.status === UserStatus.BANNED)
      throw new UnauthorizedException("الحساب محظور.");
    if (user.status === UserStatus.PENDING)
      throw new BadRequestException("تحقق من رقم هاتفك أولاً.");

    const identifier = user.phone ?? user.email;
    await this.otpService.saveOtp(
      user.id,
      OtpPurpose.PASSWORD_RESET,
      identifier,
    );
    return { data: null, message: "تم إرسال رمز إعادة تعيين كلمة المرور." };
  }

  async resetPassword(dto: ResetPasswordDto) {
    if (!dto.phone && !dto.email)
      throw new BadRequestException("يرجى إدخال رقم الهاتف أو البريد الإلكتروني.");
    if (dto.phone) dto.phone = this.normalize(dto.phone);

    const user = dto.phone
      ? await this.userRepo.findOne({ where: { phone: dto.phone } })
      : await this.userRepo.findOne({ where: { email: dto.email } });

    if (!user) throw new NotFoundException("المستخدم غير موجود.");
    if (user.role === UserRole.CUSTOMER)
      throw new BadRequestException("العملاء لا يملكون كلمة مرور.");

    await this.otpService.verifyOtp(
      user.id,
      OtpPurpose.PASSWORD_RESET,
      dto.otp,
    );

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.userRepo.update(user.id, { passwordHash });
    await this.jwtService.revokeAllUserTokens(user.id);

    return {
      data: null,
      message: "تمت إعادة تعيين كلمة المرور بنجاح. سجّل الدخول مجدداً.",
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException("المستخدم غير موجود.");
    if (user.role === UserRole.CUSTOMER)
      throw new BadRequestException("العملاء لا يملكون كلمة مرور.");
    if (!user.passwordHash)
      throw new BadRequestException(
        "لم يتم تعيين كلمة مرور. استخدم خاصية نسيت كلمة المرور.",
      );

    const ok = await bcrypt.compare(dto.oldPassword, user.passwordHash);
    if (!ok) throw new BadRequestException("كلمة المرور الحالية غير صحيحة.");
    if (dto.oldPassword === dto.newPassword)
      throw new BadRequestException("يجب أن تختلف كلمة المرور الجديدة عن الحالية.");

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.userRepo.update(userId, { passwordHash });
    await this.jwtService.revokeAllUserTokens(userId);
    return { data: null, message: "تم تغيير كلمة المرور بنجاح. سجّل الدخول مجدداً." };
  }

  // ─── Token Management ──────────────────────────────────────────────────────────

  async refresh(token: string, context?: SessionContext) {
    const payload = await this.jwtService.verifyRefreshToken(token);

    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException("المستخدم غير موجود.");
    if (user.status === UserStatus.BANNED)
      throw new UnauthorizedException("الحساب محظور.");

    // Revoke the old refresh token before issuing a new pair (rotation)
    await this.jwtService.revokeRefreshToken(token);

    const tokens = await this.issuePair(user, context);
    return { data: tokens, message: "تم تجديد الرمز." };
  }

  async logout(_userId: string, token: string) {
    await this.jwtService.revokeRefreshToken(token);
    return { data: null, message: "تم تسجيل الخروج بنجاح." };
  }

  // ─── Sessions ─────────────────────────────────────────────────────────────────

  async listSessions(userId: string, currentRefreshToken?: string) {
    const sessions = await this.jwtService.listSessions(userId);
    const currentJti = currentRefreshToken
      ? this.jwtService.decodeJtiFromRefreshToken(currentRefreshToken)
      : null;

    const items = sessions.map((s) => ({
      ...s,
      current: currentJti !== null && s.id === currentJti,
    }));

    return { data: { items, total: items.length }, message: "تم استرجاع الجلسات." };
  }

  async revokeSession(userId: string, sessionId: string) {
    await this.jwtService.revokeSessionByJti(userId, sessionId);
    return { data: null, message: "تم إنهاء الجلسة." };
  }

  async revokeOtherSessions(userId: string, currentRefreshToken: string) {
    const jti = this.jwtService.decodeJtiFromRefreshToken(currentRefreshToken);
    if (!jti) {
      throw new UnauthorizedException("رمز التحديث غير صالح.");
    }
    const revoked = await this.jwtService.revokeAllUserSessionsExcept(userId, jti);
    return {
      data: { revoked },
      message: "تم إنهاء الجلسات الأخرى.",
    };
  }

  // ─── NATS Event Handlers — user status transitions ────────────────────────────
  // Called from auth.controller.ts @EventPattern handlers.
  // Each service emits an event when something meaningful happens; auth-service
  // updates the users table accordingly (single source of truth for auth state).

  /** customer-service emits this after customer saves their profile. */
  async onCustomerProfileCompleted(data: { userId: string }) {
    await this.userRepo.update(
      { id: data.userId, role: UserRole.CUSTOMER },
      { profileCompleted: true, status: UserStatus.ACTIVE },
    );
    this.logger.log(`Customer ${data.userId} profile completed → ACTIVE`);
  }

  /** delivery-service emits this after agent submits their application. */
  async onDeliveryProfileCompleted(data: { userId: string }) {
    await this.userRepo.update(
      { id: data.userId, role: UserRole.DELIVERY },
      { profileCompleted: true },
    );
    this.logger.log(`Delivery agent ${data.userId} profile submitted`);
  }

  /** delivery-service emits this after manager approves an application. */
  async onDeliveryAgentApproved(data: { userId: string }) {
    const user = await this.userRepo.findOne({ where: { id: data.userId } });
    if (!user || user.role !== UserRole.DELIVERY) {
      this.logger.warn(`onDeliveryAgentApproved: invalid userId or role for ${data.userId}`);
      return;
    }
    await this.userRepo.update({ id: data.userId }, { status: UserStatus.ACTIVE });
    this.logger.log(`Delivery agent ${data.userId} approved → ACTIVE`);
  }

  /** delivery-service emits this after manager rejects an application. */
  async onDeliveryAgentRejected(data: { userId: string }) {
    const user = await this.userRepo.findOne({ where: { id: data.userId } });
    if (!user || user.role !== UserRole.DELIVERY) {
      this.logger.warn(`onDeliveryAgentRejected: invalid userId or role for ${data.userId}`);
      return;
    }
    await this.userRepo.update({ id: data.userId }, { profileCompleted: false });
    this.logger.log(`Delivery agent ${data.userId} rejected → profileCompleted reset`);
  }

  /** restaurant-service emits this after owner saves their restaurant profile. */
  async onRestaurantProfileCompleted(data: { userId: string }) {
    // No manager approval step: completing the profile activates the account.
    await this.userRepo.update(
      { id: data.userId, role: UserRole.RESTAURANT_OWNER },
      { profileCompleted: true, status: UserStatus.ACTIVE },
    );
    this.logger.log(`Restaurant owner ${data.userId} profile completed → ACTIVE`);
  }

  /** restaurant-service emits this after manager approves the restaurant. */
  async onRestaurantOwnerApproved(data: { userId: string }) {
    const user = await this.userRepo.findOne({ where: { id: data.userId } });
    if (!user || user.role !== UserRole.RESTAURANT_OWNER) {
      this.logger.warn(`onRestaurantOwnerApproved: invalid userId or role for ${data.userId}`);
      return;
    }
    await this.userRepo.update({ id: data.userId }, { status: UserStatus.ACTIVE });
    this.logger.log(`Restaurant owner ${data.userId} approved → ACTIVE`);
  }

  /** restaurant-service emits this after manager rejects the restaurant. */
  async onRestaurantOwnerRejected(data: { userId: string }) {
    const user = await this.userRepo.findOne({ where: { id: data.userId } });
    if (!user || user.role !== UserRole.RESTAURANT_OWNER) {
      this.logger.warn(`onRestaurantOwnerRejected: invalid userId or role for ${data.userId}`);
      return;
    }
    await this.userRepo.update({ id: data.userId }, { profileCompleted: false });
    this.logger.log(`Restaurant owner ${data.userId} rejected → profileCompleted reset`);
  }

  /** delivery-service or restaurant-service set a password on behalf of user. */
  async onPasswordSet(data: { userId: string; password: string }) {
    const passwordHash = await bcrypt.hash(data.password, 10);
    await this.userRepo.update({ id: data.userId }, { passwordHash });
    this.logger.log(`Password set for user ${data.userId}`);
  }

  // ─── Manager Dashboard — User Administration ─────────────────────────────────
  // All endpoints require manager role (enforced via guards on the controller).

  async adminListUsers(query: AdminListUsersDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.userRepo.createQueryBuilder("u");

    if (query.role) qb.andWhere("u.role = :role", { role: query.role });
    if (query.status) qb.andWhere("u.status = :status", { status: query.status });
    if (query.search) {
      qb.andWhere(
        new Brackets((b) => {
          b.where("u.full_name ILIKE :s", { s: `%${query.search}%` })
            .orWhere("u.email ILIKE :s", { s: `%${query.search}%` })
            .orWhere("u.phone ILIKE :s", { s: `%${query.search}%` });
        }),
      );
    }

    qb.orderBy("u.created_at", "DESC")
      .skip((page - 1) * limit)
      .take(limit)
      .select([
        "u.id",
        "u.email",
        "u.phone",
        "u.fullName",
        "u.role",
        "u.status",
        "u.profileCompleted",
        "u.phoneVerifiedAt",
        "u.emailVerifiedAt",
        "u.lastLoginAt",
        "u.createdAt",
      ]);

    const [items, total] = await qb.getManyAndCount();
    return {
      data: { items, total, page, limit, pages: Math.ceil(total / limit) },
      message: "تم استرجاع المستخدمين.",
    };
  }

  async adminGetUser(id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException("المستخدم غير موجود.");
    const { passwordHash: _omit, ...safe } = user;
    return { data: safe, message: "تم استرجاع المستخدم." };
  }

  async adminUpdateUser(id: string, dto: AdminUpdateUserDto) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException("المستخدم غير موجود.");

    if (dto.email && dto.email !== user.email) {
      const exists = await this.userRepo.findOne({ where: { email: dto.email } });
      if (exists && exists.id !== id) {
        throw new ConflictException("البريد الإلكتروني مستخدم بالفعل.");
      }
    }
    if (dto.phone && dto.phone !== user.phone) {
      const exists = await this.userRepo.findOne({ where: { phone: dto.phone } });
      if (exists && exists.id !== id) {
        throw new ConflictException("رقم الهاتف مستخدم بالفعل.");
      }
    }

    await this.userRepo.update(id, { ...dto });
    const updated = await this.userRepo.findOne({ where: { id } });
    if (!updated) throw new NotFoundException("لم يُعثر على المستخدم بعد التحديث.");
    const { passwordHash: _omit, ...safe } = updated;
    return { data: safe, message: "تم تحديث بيانات المستخدم." };
  }

  async adminChangeStatus(id: string, dto: AdminChangeStatusDto) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException("المستخدم غير موجود.");

    if (user.status === dto.status) {
      return { data: { id, status: user.status }, message: "الحالة لم تتغير." };
    }

    await this.userRepo.update(id, { status: dto.status });

    // If banning/suspending, revoke all refresh tokens so the user is logged out.
    if (
      dto.status === UserStatus.BANNED ||
      dto.status === UserStatus.SUSPENDED
    ) {
      await this.jwtService.revokeAllUserTokens(id);
    }

    // Notify other services so they can mirror the status (best-effort).
    try {
      this.natsClient.emit("user.status.changed", {
        userId: id,
        role: user.role,
        status: dto.status,
      });
    } catch (err) {
      this.logger.error("NATS emit user.status.changed failed", err);
    }

    return {
      data: { id, status: dto.status },
      message: "تم تحديث حالة المستخدم.",
    };
  }

  async adminDeleteUser(id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException("المستخدم غير موجود.");

    await this.jwtService.revokeAllUserTokens(id);
    await this.userRepo.delete(id);

    // Tell downstream services to clean up their copies of this user.
    try {
      this.natsClient.emit("user.deleted", { userId: id, role: user.role });
    } catch (err) {
      this.logger.error("NATS emit user.deleted failed", err);
    }

    return { data: null, message: "تم حذف المستخدم." };
  }
}
