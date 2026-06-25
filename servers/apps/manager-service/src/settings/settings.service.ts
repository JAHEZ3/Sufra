import {
  BadRequestException,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeneralSettings } from '../entities/general-settings.entity';
import { FeesSettings } from '../entities/fees-settings.entity';
import { DeliverySettings } from '../entities/delivery-settings.entity';
import { NotificationSettings } from '../entities/notification-settings.entity';
import { SystemSettings } from '../entities/system-settings.entity';
import { PaymentSettings } from '../entities/payment-settings.entity';
import { S3Service } from '../s3.service';
import { UpdateSettingsDto } from './dto/settings.dto';

const SINGLETON_ID = 1;

/**
 * Singletons-per-section: each settings group lives in its own table as a
 * single row (id = 1). Defaults are defined on the entity columns, so the
 * DB is the source of truth — no hard-coded defaults at runtime.
 */
@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(
    @InjectRepository(GeneralSettings)
    private readonly generalRepo: Repository<GeneralSettings>,
    @InjectRepository(FeesSettings)
    private readonly feesRepo: Repository<FeesSettings>,
    @InjectRepository(DeliverySettings)
    private readonly deliveryRepo: Repository<DeliverySettings>,
    @InjectRepository(NotificationSettings)
    private readonly notificationsRepo: Repository<NotificationSettings>,
    @InjectRepository(SystemSettings)
    private readonly systemRepo: Repository<SystemSettings>,
    @InjectRepository(PaymentSettings)
    private readonly paymentRepo: Repository<PaymentSettings>,
    private readonly s3: S3Service,
  ) {}

  /** Ensure each singleton row exists so column defaults take effect on first read. */
  async onModuleInit() {
    await Promise.all([
      this.ensureRow(this.generalRepo),
      this.ensureRow(this.feesRepo),
      this.ensureRow(this.deliveryRepo),
      this.ensureRow(this.notificationsRepo),
      this.ensureRow(this.systemRepo),
      this.ensureRow(this.paymentRepo),
    ]);
  }

  private async ensureRow<T extends { id: number }>(
    repo: Repository<T>,
  ): Promise<T> {
    const existing = await repo.findOne({ where: { id: SINGLETON_ID } as any });
    if (existing) return existing;
    const row = repo.create({ id: SINGLETON_ID } as any) as unknown as T;
    return (await repo.save(row as any)) as unknown as T;
  }

  /** GET — full settings tree with logo resolved to a presigned URL. */
  async getAll() {
    const [general, fees, delivery, notifications, system, payment] =
      await Promise.all([
        this.ensureRow(this.generalRepo),
        this.ensureRow(this.feesRepo),
        this.ensureRow(this.deliveryRepo),
        this.ensureRow(this.notificationsRepo),
        this.ensureRow(this.systemRepo),
        this.ensureRow(this.paymentRepo),
      ]);

    return {
      general: {
        platformName: general.platformName,
        supportEmail: general.supportEmail,
        supportPhone: general.supportPhone,
        supportWhatsapp: general.supportWhatsapp,
        supportAddress: general.supportAddress,
        supportHours: general.supportHours,
        defaultLanguage: general.defaultLanguage,
        currency: general.currency,
        logoUrl: await this.s3.resolveImageUrl(general.logoUrl),
        // Social media
        facebookUrl: general.facebookUrl,
        instagramUrl: general.instagramUrl,
        xUrl: general.xUrl,
        youtubeUrl: general.youtubeUrl,
        tiktokUrl: general.tiktokUrl,
        snapchatUrl: general.snapchatUrl,
        // App stores
        appStoreUrl: general.appStoreUrl,
        googlePlayUrl: general.googlePlayUrl,
        // Public website CTA button URLs
        restaurantSignupUrl: general.restaurantSignupUrl,
        driverSignupUrl: general.driverSignupUrl,
        appDownloadUrl: general.appDownloadUrl,
        // SEO
        seoTitleTemplate: general.seoTitleTemplate,
        seoDescription: general.seoDescription,
        seoOgImageUrl: general.seoOgImageUrl,
      },
      fees: {
        restaurantCommission: Number(fees.restaurantCommission),
        deliveryFeeBase: Number(fees.deliveryFeeBase),
        deliveryFeePerKm: Number(fees.deliveryFeePerKm),
        minOrderAmount: Number(fees.minOrderAmount),
        taxRate: Number(fees.taxRate),
      },
      delivery: {
        maxDeliveryRadius: delivery.maxDeliveryRadius,
        estimatedTimeMin: delivery.estimatedTimeMin,
        estimatedTimeMax: delivery.estimatedTimeMax,
        allowScheduledOrders: delivery.allowScheduledOrders,
      },
      notifications: {
        enableEmailNotifications: notifications.enableEmailNotifications,
        enableSmsNotifications: notifications.enableSmsNotifications,
        enablePushNotifications: notifications.enablePushNotifications,
        orderUpdatesEnabled: notifications.orderUpdatesEnabled,
        marketingEnabled: notifications.marketingEnabled,
      },
      system: {
        maintenanceMode: system.maintenanceMode,
        allowNewRegistrations: system.allowNewRegistrations,
        allowNewRestaurants: system.allowNewRestaurants,
        requireRestaurantApproval: system.requireRestaurantApproval,
        requireDriverApproval: system.requireDriverApproval,
        enableRatings: system.enableRatings,
        enableReviews: system.enableReviews,
      },
      payment: {
        enableCreditCard: payment.enableCreditCard,
        enableApplePay: payment.enableApplePay,
        enableCashOnDelivery: payment.enableCashOnDelivery,
        enableWallet: payment.enableWallet,
        maxWalletBalance: Number(payment.maxWalletBalance),
      },
    };
  }

  /** Public website config — read-only subset of general settings used by the
   *  public marketing site (footer contact, social links, app-store badges,
   *  SEO metadata). All fields are nullable; the website skips any that are
   *  empty so unconfigured rows degrade gracefully. */
  async getPublicContactInfo() {
    const general = await this.ensureRow(this.generalRepo);
    return {
      platformName: general.platformName,
      supportEmail: general.supportEmail,
      supportPhone: general.supportPhone,
      supportWhatsapp: general.supportWhatsapp,
      supportAddress: general.supportAddress,
      supportHours: general.supportHours,
      logoUrl: await this.s3.resolveImageUrl(general.logoUrl),
      // Social media
      facebookUrl: general.facebookUrl,
      instagramUrl: general.instagramUrl,
      xUrl: general.xUrl,
      youtubeUrl: general.youtubeUrl,
      tiktokUrl: general.tiktokUrl,
      snapchatUrl: general.snapchatUrl,
      // App stores
      appStoreUrl: general.appStoreUrl,
      googlePlayUrl: general.googlePlayUrl,
      // Public website CTA button URLs
      restaurantSignupUrl: general.restaurantSignupUrl,
      driverSignupUrl: general.driverSignupUrl,
      appDownloadUrl: general.appDownloadUrl,
      // SEO
      seoTitleTemplate: general.seoTitleTemplate,
      seoDescription: general.seoDescription,
      seoOgImageUrl: general.seoOgImageUrl,
    };
  }

  /**
   * POST/PATCH — apply provided sections. Both routes shallow-merge per row,
   * which matches the dashboard behaviour (it always sends the full section).
   */
  async patch(dto: UpdateSettingsDto) {
    if (dto.general !== undefined) {
      await this.applyPatch(this.generalRepo, dto.general);
    }
    if (dto.fees !== undefined) {
      await this.applyPatch(this.feesRepo, dto.fees);
    }
    if (dto.delivery !== undefined) {
      await this.applyPatch(this.deliveryRepo, dto.delivery);
    }
    if (dto.notifications !== undefined) {
      await this.applyPatch(this.notificationsRepo, dto.notifications);
    }
    if (dto.system !== undefined) {
      await this.applyPatch(this.systemRepo, dto.system);
    }
    if (dto.payment !== undefined) {
      await this.applyPatch(this.paymentRepo, dto.payment);
    }
    return this.getAll();
  }

  private async applyPatch<T extends { id: number }>(
    repo: Repository<T>,
    patch: object,
  ) {
    const row = await this.ensureRow(repo);
    Object.assign(row, patch);
    await repo.save(row as any);
  }

  /** PATCH /admin/settings/logo — multipart image upload. */
  async uploadLogo(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('لم يتم رفع أي ملف.');
    }
    if (!file.mimetype?.startsWith('image/')) {
      throw new BadRequestException('يُسمح فقط برفع ملفات الصور.');
    }

    const row = await this.ensureRow(this.generalRepo);
    const previousKey = row.logoUrl;

    const newKey = await this.s3.upload(file, 'platform');
    row.logoUrl = newKey;
    await this.generalRepo.save(row);

    if (previousKey && !/^https?:\/\//i.test(previousKey)) {
      try {
        await this.s3.delete(previousKey);
      } catch {
        // best-effort cleanup
      }
    }

    return {
      logoUrl: await this.s3.resolveImageUrl(newKey),
    };
  }
}
