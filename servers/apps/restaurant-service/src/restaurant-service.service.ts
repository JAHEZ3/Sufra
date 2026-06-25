import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, In, Repository } from "typeorm";
import { ClientProxy } from "@nestjs/microservices";
import { Restaurant, RestaurantStatus } from "./entities/restaurant.entity";
import { AdminListRestaurantsDto } from "./dto/admin-list-restaurants.dto";
import { AdminChangeRestaurantStatusDto } from "./dto/admin-change-restaurant-status.dto";
import { RestaurantHour } from "./entities/restaurant-hour.entity";
import { Menu } from "./entities/menu.entity";
import { MenuSection } from "./entities/menu-section.entity";
import { Meal } from "./entities/meal.entity";
import { MealOptionGroup } from "./entities/meal-option-group.entity";
import { MealOption } from "./entities/meal-option.entity";
import {
  RestaurantRequest,
  RestaurantRequestStatus,
} from "./entities/restaurant-request.entity";
import { CompleteRestaurantProfileDto } from "./dto/complete-profile.dto";
import { parseAndValidatePaymentInfo, validatePaymentInfo } from "./common/payment-info";
import { S3Service } from "./s3.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UpdateSettingsDto } from "./dto/update-settings.dto";
import { SetHoursDto } from "./dto/set-hours.dto";
import { CreateMenuDto } from "./dto/create-menu.dto";
import { UpdateMenuDto } from "./dto/update-menu.dto";
import { CreateSectionDto } from "./dto/create-section.dto";
import { UpdateSectionDto } from "./dto/update-section.dto";
import { CreateMealDto } from "./dto/create-meal.dto";
import { UpdateMealDto } from "./dto/update-meal.dto";
import { CreateOptionGroupDto } from "./dto/create-option-group.dto";
import { UpdateOptionGroupDto } from "./dto/update-option-group.dto";
import { CreateOptionDto } from "./dto/create-option.dto";
import { UpdateOptionDto } from "./dto/update-option.dto";
import { ReorderDto } from "./dto/reorder.dto";

@Injectable()
export class RestaurantServiceService {
  private readonly logger = new Logger(RestaurantServiceService.name);

  constructor(
    @InjectRepository(Restaurant)
    private readonly restaurantRepo: Repository<Restaurant>,
    @InjectRepository(RestaurantRequest)
    private readonly requestRepo: Repository<RestaurantRequest>,
    @InjectRepository(RestaurantHour)
    private readonly hoursRepo: Repository<RestaurantHour>,
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
    @Inject("NATS_SERVICE")
    private readonly natsClient: ClientProxy,
    private readonly s3: S3Service,
  ) {}

  // ─── NATS: create profile stub on registration ────────────────────────────────

  async createProfileStub(data: { userId: string; phone: string; name?: string }) {
    const existing = await this.restaurantRepo.findOne({
      where: { ownerUserId: data.userId },
    });
    if (existing) {
      this.logger.warn(
        `Restaurant stub already exists for userId: ${data.userId}`,
      );
      return;
    }
    // One-step signup: the restaurant is created active (no manager approval).
    // isOpen stays false until the owner finishes menu/details and opens it.
    await this.restaurantRepo.save(
      this.restaurantRepo.create({
        ownerUserId: data.userId,
        phone: data.phone,
        name: data.name,
        status: RestaurantStatus.ACTIVE,
        isOpen: false,
      }),
    );
    this.logger.log(`Restaurant created (active) for userId: ${data.userId}`);
  }

  // ─── NATS: order.rated → fold into the cached restaurant rating ───────────────
  //
  // The authoritative per-order ratings live in `order_ratings` (order-service).
  // We keep a denormalised running average + count on `restaurants` so listings
  // and cards don't need a join. Atomic SQL keeps it correct under concurrency.

  async applyRating(data: {
    orderId: string;
    restaurantId: string;
    foodRating: number;
  }) {
    const score = Number(data.foodRating);
    if (!Number.isFinite(score) || score < 1 || score > 5) {
      this.logger.warn(
        `Ignoring rating ${data.foodRating} for restaurant ${data.restaurantId} (out of range)`,
      );
      return;
    }
    await this.restaurantRepo
      .createQueryBuilder()
      .update(Restaurant)
      .set({
        rating: () =>
          `ROUND(((COALESCE(rating, 0) * COALESCE(total_ratings, 0)) + ${score}) / (COALESCE(total_ratings, 0) + 1)::numeric, 2)`,
        totalRatings: () => `COALESCE(total_ratings, 0) + 1`,
      })
      .where("id = :id", { id: data.restaurantId })
      .execute();
  }

  // ─── HTTP: first-time profile completion ──────────────────────────────────────

  async completeProfile(
    userId: string,
    phone: string,
    dto: CompleteRestaurantProfileDto,
    files: {
      logo?: Express.Multer.File[];
      ownerIdPicture?: Express.Multer.File[];
    },
  ) {
    if (!dto.termsAccepted) {
      throw new BadRequestException("يجب قبول الشروط والسياسة للمتابعة.");
    }
    if (!files?.logo?.[0]) {
      throw new BadRequestException("شعار المطعم مطلوب.");
    }
    if (!files?.ownerIdPicture?.[0]) {
      throw new BadRequestException("صورة هوية المالك مطلوبة.");
    }

    // Create the stub if it doesn't exist yet (handles cases where the NATS
    // event was missed — e.g. service was down at registration time).
    await this.createProfileStub({ userId, phone });

    const restaurant = await this.getOwnedRestaurant(userId);

    let paymentInfo: ReturnType<typeof parseAndValidatePaymentInfo>;
    try {
      paymentInfo = parseAndValidatePaymentInfo(dto.paymentInfo);
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }

    // Upload files to private S3 bucket
    let logoKey: string;
    let ownerIdKey: string;
    try {
      [logoKey, ownerIdKey] = await Promise.all([
        this.s3.upload(files.logo[0], "restaurant"),
        this.s3.upload(files.ownerIdPicture[0], "restaurant"),
      ]);
    } catch (err) {
      this.logger.error("S3 upload failed during completeProfile", err);
      throw new BadRequestException("فشل رفع الملفات. يرجى المحاولة مجدداً.");
    }

    // Update restaurant record with all profile data
    await this.restaurantRepo.update(restaurant.id, {
      name: dto.restaurantName,
      ownerName: dto.ownerName,
      ownerNationalIdNumber: dto.ownerNationalIdNumber,
      commercialRegNumber: dto.commercialRegNumber,
      phone: dto.restaurantPhone,
      description: dto.description,
      logoUrl: logoKey,
      street: dto.street,
      city: dto.city,
      cuisineType: dto.cuisineType,
      lat: dto.lat,
      lng: dto.lng,
      paymentInfo,
      termsAccepted: true,
      // No manager approval: the restaurant goes live immediately.
      status: RestaurantStatus.ACTIVE,
      isOpen: true,
    });

    // Store the submitted documents as an auto-approved record (audit trail).
    const request = await this.requestRepo.save(
      this.requestRepo.create({
        restaurantId: restaurant.id,
        logoUrl: logoKey,
        ownerIdPictureUrl: ownerIdKey,
        status: RestaurantRequestStatus.APPROVED,
      }),
    );

    // Auth-service hashes the password — never send a hash over NATS
    try {
      this.natsClient.emit("user.password.set", { userId, password: dto.password });
    } catch (err) {
      this.logger.error("NATS emit user.password.set failed", err);
    }

    // Notify auth-service that profile is complete → user becomes ACTIVE
    try {
      this.natsClient.emit("restaurant.profile.completed", { userId, requestId: request.id });
    } catch (err) {
      this.logger.error("NATS emit restaurant.profile.completed failed", err);
    }

    this.logger.log(
      `Profile completed for restaurant ownerId: ${userId} — active (no approval needed)`,
    );
    return { message: "تم تفعيل حسابك بنجاح." };
  }

  // ─── Manager: list pending applications ───────────────────────────────────────

  async getPendingApplications() {
    const requests = await this.requestRepo
      .createQueryBuilder("req")
      .leftJoinAndMapOne(
        "req.restaurant",
        Restaurant,
        "r",
        "r.id = req.restaurantId",
      )
      .where("req.status = :status", {
        status: RestaurantRequestStatus.PENDING,
      })
      .orderBy("req.submittedAt", "ASC")
      .getMany();

    // Generate short-lived presigned URLs — failures are isolated per request
    const data = await Promise.all(
      requests.map(async (req: any) => {
        const presign = async (key: string | null | undefined) => {
          if (!key) return null;
          try { return await this.s3.presignedUrl(key); }
          catch (err) {
            this.logger.error(`Failed to presign key ${key}`, err);
            return null;
          }
        };
        const [logoUrl, ownerIdPictureUrl] = await Promise.all([
          presign(req.logoUrl),
          presign(req.ownerIdPictureUrl),
        ]);
        return { ...req, logoUrl, ownerIdPictureUrl };
      }),
    );

    return { data, message: "تم استرجاع الطلبات المعلقة." };
  }

  // ─── Manager: approve application ────────────────────────────────────────────

  async approveApplication(requestId: string, managerId: string) {
    const request = await this.requestRepo.findOne({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException("الطلب غير موجود.");
    if (request.status !== RestaurantRequestStatus.PENDING) {
      throw new BadRequestException("الطلب لم يعد معلقاً.");
    }

    // Mark request approved
    await this.requestRepo.update(request.id, {
      status: RestaurantRequestStatus.APPROVED,
      reviewedBy: managerId,
      reviewedAt: new Date(),
    });

    // Activate the restaurant record
    await this.restaurantRepo.update(request.restaurantId, {
      status: RestaurantStatus.ACTIVE,
    });

    // Get the owner's userId so auth-service can flip User.status → ACTIVE
    const restaurant = await this.restaurantRepo.findOne({
      where: { id: request.restaurantId },
    });
    if (!restaurant) throw new NotFoundException("بيانات المطعم غير موجودة.");
    try {
      this.natsClient.emit("restaurant.owner.approved", {
        userId: restaurant.ownerUserId,
        requestId: request.id,
        restaurantId: restaurant.id,
        restaurantName: restaurant.name ?? null,
      });
    } catch (err) {
      this.logger.error("NATS emit restaurant.owner.approved failed", err);
    }

    this.logger.log(
      `Restaurant request ${requestId} approved by manager ${managerId}`,
    );
    return { message: "تمت الموافقة على الطلب. المطعم نشط الآن." };
  }

  // ─── Manager: reject application ─────────────────────────────────────────────

  async rejectApplication(
    requestId: string,
    managerId: string,
    reason?: string,
  ) {
    const request = await this.requestRepo.findOne({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException("الطلب غير موجود.");
    if (request.status !== RestaurantRequestStatus.PENDING) {
      throw new BadRequestException("الطلب لم يعد معلقاً.");
    }

    await this.requestRepo.update(request.id, {
      status: RestaurantRequestStatus.REJECTED,
      reviewedBy: managerId,
      reviewedAt: new Date(),
      rejectionReason: reason,
    });

    const restaurant = await this.restaurantRepo.findOne({
      where: { id: request.restaurantId },
    });
    if (!restaurant) throw new NotFoundException("بيانات المطعم غير موجودة.");
    try {
      this.natsClient.emit("restaurant.owner.rejected", {
        userId: restaurant.ownerUserId,
        requestId: request.id,
        reason,
      });
    } catch (err) {
      this.logger.error("NATS emit restaurant.owner.rejected failed", err);
    }

    this.logger.log(
      `Restaurant request ${requestId} rejected by manager ${managerId}`,
    );
    return { message: "تم رفض الطلب." };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private async getOwnedRestaurant(ownerId: string): Promise<Restaurant> {
    const restaurant = await this.restaurantRepo.findOne({
      where: { ownerUserId: ownerId },
    });
    if (!restaurant)
      throw new NotFoundException("لم يُعثر على مطعم لهذا الحساب.");
    return restaurant;
  }

  private async assertMenuOwner(
    menuId: string,
    restaurantId: string,
  ): Promise<Menu> {
    const menu = await this.menuRepo.findOne({ where: { id: menuId } });
    if (!menu) throw new NotFoundException("القائمة غير موجودة.");
    if (menu.restaurantId !== restaurantId)
      throw new ForbiddenException("هذه القائمة لا تخصك.");
    return menu;
  }

  private async assertSectionOwner(
    sectionId: string,
    restaurantId: string,
  ): Promise<MenuSection> {
    const section = await this.sectionRepo.findOne({
      where: { id: sectionId },
    });
    if (!section) throw new NotFoundException("القسم غير موجود.");
    const menu = await this.menuRepo.findOne({ where: { id: section.menuId } });
    if (!menu || menu.restaurantId !== restaurantId)
      throw new ForbiddenException("هذا القسم لا يخصك.");
    return section;
  }

  private async assertMealOwner(
    mealId: string,
    restaurantId: string,
  ): Promise<Meal> {
    const meal = await this.mealRepo.findOne({ where: { id: mealId } });
    if (!meal) throw new NotFoundException("الوجبة غير موجودة.");
    if (meal.restaurantId !== restaurantId)
      throw new ForbiddenException("هذه الوجبة لا تخصك.");
    return meal;
  }

  private async assertOptionGroupOwner(
    groupId: string,
    restaurantId: string,
  ): Promise<MealOptionGroup> {
    const group = await this.optionGroupRepo.findOne({
      where: { id: groupId },
    });
    if (!group) throw new NotFoundException("مجموعة الخيارات غير موجودة.");
    await this.assertMealOwner(group.mealId, restaurantId);
    return group;
  }

  // ─── Helpers — presigned URLs ─────────────────────────────────────────────────

  private async withPresignedUrls(restaurant: Restaurant): Promise<Restaurant & { logoUrl?: string; coverUrl?: string }> {
    const [logoUrl, coverUrl, paymentInfo] = await Promise.all([
      restaurant.logoUrl ? this.s3.presignedUrl(restaurant.logoUrl) : undefined,
      restaurant.coverUrl ? this.s3.presignedUrl(restaurant.coverUrl) : undefined,
      this.resolvePaymentQr(restaurant.paymentInfo),
    ]);
    return {
      ...restaurant,
      ...(logoUrl && { logoUrl }),
      ...(coverUrl && { coverUrl }),
      ...(paymentInfo !== undefined && { paymentInfo }),
    };
  }

  private async resolvePaymentQr(paymentInfo: Restaurant["paymentInfo"]) {
    if (!paymentInfo) return undefined;
    if (!paymentInfo.qrImageUrl) return paymentInfo;
    const qrImageUrl = await this.s3.resolveImageUrl(paymentInfo.qrImageUrl);
    return { ...paymentInfo, qrImageUrl: qrImageUrl ?? undefined };
  }

  /**
   * Customer-facing read of the restaurant's payment instructions. Used by the
   * mobile checkout screen so the customer knows where to send the bank
   * transfer / wallet payment for orders paid online. The endpoint is JWT-
   * protected (no anonymous scraping of bank details). The QR-image S3 key is
   * resolved to a presigned URL before returning.
   */
  async getPaymentInfoForCheckout(restaurantId: string) {
    const restaurant = await this.restaurantRepo.findOne({
      where: { id: restaurantId },
      select: ["id", "paymentInfo", "name"],
    });
    if (!restaurant) {
      throw new NotFoundException("المطعم غير موجود.");
    }
    const paymentInfo = await this.resolvePaymentQr(restaurant.paymentInfo);
    return {
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      paymentInfo: paymentInfo ?? null,
    };
  }

  async uploadPaymentQr(userId: string, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("لم يتم رفع أي ملف.");
    }
    const restaurant = await this.getOwnedRestaurant(userId);
    let key: string;
    try {
      key = await this.s3.upload(file, "payment-qr");
    } catch (err) {
      this.logger.error("S3 upload failed during uploadPaymentQr", err);
      throw new BadRequestException("فشل رفع رمز QR.");
    }

    const url = await this.s3.presignedUrl(key);

    // If paymentInfo exists, attach the new key and clean up the old QR.
    const existing = restaurant.paymentInfo;
    if (existing) {
      const oldKey = existing.qrImageUrl;
      const next = { ...existing, qrImageUrl: key };
      await this.restaurantRepo.update(restaurant.id, { paymentInfo: next });
      if (oldKey && !/^https?:\/\//i.test(oldKey) && oldKey !== key) {
        await this.s3.delete(oldKey).catch(() => undefined);
      }
    }

    return { data: { key, url }, message: "تم رفع رمز QR بنجاح." };
  }

  private async withMealImage(meal: Meal): Promise<Meal & { imageUrl: string | null }> {
    const imageUrl = await this.s3.resolveImageUrl(meal.imageUrl);
    return { ...meal, imageUrl };
  }

  // ─── Branding: logo + cover image (S3) + main brand color ──────────────────
  async updateBranding(
    userId: string,
    body: { brandColor?: string },
    files: { logo?: Express.Multer.File[]; cover?: Express.Multer.File[] },
  ) {
    const restaurant = await this.getOwnedRestaurant(userId);
    const patch: Partial<Restaurant> = {};

    if (body.brandColor !== undefined) {
      const c = (body.brandColor ?? "").trim();
      if (c && !/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(c)) {
        throw new BadRequestException("لون غير صالح. استخدم الصيغة #RRGGBB.");
      }
      patch.brandColor = c; // empty string clears → app falls back to default
    }

    const swapImage = async (
      file: Express.Multer.File | undefined,
      oldKey: string | undefined,
    ): Promise<string | undefined> => {
      if (!file) return undefined;
      let key: string;
      try {
        key = await this.s3.upload(file, "restaurant");
      } catch (err) {
        this.logger.error("S3 upload failed during updateBranding", err);
        throw new BadRequestException("فشل رفع الصورة. حاول مجدداً.");
      }
      if (oldKey && !/^https?:\/\//i.test(oldKey) && oldKey !== key) {
        this.s3.delete(oldKey).catch(() => undefined);
      }
      return key;
    };

    const logoKey = await swapImage(files?.logo?.[0], restaurant.logoUrl);
    if (logoKey) patch.logoUrl = logoKey;
    const coverKey = await swapImage(files?.cover?.[0], restaurant.coverUrl);
    if (coverKey) patch.coverUrl = coverKey;

    if (Object.keys(patch).length) {
      await this.restaurantRepo.update(restaurant.id, patch);
    }

    const updated = await this.getOwnedRestaurant(userId);
    const presigned = await this.withPresignedUrls(updated);
    return {
      data: {
        logoUrl: presigned.logoUrl ?? null,
        coverUrl: presigned.coverUrl ?? null,
        brandColor: updated.brandColor || null,
      },
      message: "تم تحديث هوية المطعم بنجاح.",
    };
  }

  // ─── Restaurant Profile & Settings ────────────────────────────────────────────

  async getProfile(ownerId: string) {
    const restaurant = await this.getOwnedRestaurant(ownerId);

    // Latest request holds ownerIdPicture
    const request = await this.requestRepo.findOne({
      where: { restaurantId: restaurant.id },
      order: { submittedAt: 'DESC' },
    });

    const ownerIdPictureUrl = request?.ownerIdPictureUrl
      ? await this.s3.presignedUrl(request.ownerIdPictureUrl)
      : null;

    const data = {
      ...(await this.withPresignedUrls(restaurant)),
      ownerIdPictureUrl,
      applicationStatus: request?.status ?? null,
      rejectionReason: request?.rejectionReason ?? null,
    };

    return { data, message: "تم استرجاع الملف الشخصي." };
  }

  async updateProfile(ownerId: string, dto: UpdateProfileDto) {
    const restaurant = await this.getOwnedRestaurant(ownerId);
    await this.restaurantRepo.update(restaurant.id, { ...dto });
    const updated = await this.restaurantRepo.findOne({ where: { id: restaurant.id } });
    if (!updated) throw new NotFoundException("لم يُعثر على المطعم بعد التحديث.");
    return {
      data: await this.withPresignedUrls(updated),
      message: "تم تحديث الملف الشخصي.",
    };
  }

  async updateSettings(ownerId: string, dto: UpdateSettingsDto) {
    const restaurant = await this.getOwnedRestaurant(ownerId);

    const { paymentInfo: rawPaymentInfo, ...rest } = dto;
    const patch: Record<string, unknown> = { ...rest };

    if (rawPaymentInfo !== undefined) {
      try {
        patch.paymentInfo = validatePaymentInfo(rawPaymentInfo);
      } catch (err: any) {
        throw new BadRequestException(err.message);
      }
    }

    await this.restaurantRepo.update(restaurant.id, patch);
    return {
      data: await this.restaurantRepo.findOne({ where: { id: restaurant.id } }),
      message: "تم تحديث الإعدادات.",
    };
  }

  async toggleOpen(ownerId: string) {
    const restaurant = await this.getOwnedRestaurant(ownerId);
    const newState = !restaurant.isOpen;
    await this.restaurantRepo.update(restaurant.id, { isOpen: newState });
    return {
      data: { isOpen: newState },
      message: newState ? "Restaurant is now open" : "Restaurant is now closed",
    };
  }

  // ─── Operating Hours ──────────────────────────────────────────────────────────

  async getHours(ownerId: string) {
    const restaurant = await this.getOwnedRestaurant(ownerId);
    const hours = await this.hoursRepo.find({
      where: { restaurantId: restaurant.id },
      order: { dayOfWeek: "ASC" },
    });
    return { data: hours, message: "تم استرجاع أوقات العمل." };
  }

  async setHours(ownerId: string, dto: SetHoursDto) {
    const restaurant = await this.getOwnedRestaurant(ownerId);

    const days = dto.hours.map((h) => h.dayOfWeek).sort((a, b) => a - b);
    const expected = [0, 1, 2, 3, 4, 5, 6];
    if (days.some((d, i) => d !== expected[i])) {
      throw new BadRequestException(
        "يجب تحديد أوقات العمل لجميع أيام الأسبوع من الأحد (0) إلى السبت (6).",
      );
    }

    await this.hoursRepo.manager.transaction(async (em) => {
      await em.delete(RestaurantHour, { restaurantId: restaurant.id });
      await em.save(
        RestaurantHour,
        dto.hours.map((entry) =>
          em.create(RestaurantHour, {
            restaurantId: restaurant.id,
            dayOfWeek: entry.dayOfWeek,
            openTime: entry.openTime,
            closeTime: entry.closeTime,
          }),
        ),
      );
    });

    const hours = await this.hoursRepo.find({
      where: { restaurantId: restaurant.id },
      order: { dayOfWeek: "ASC" },
    });
    return { data: hours, message: "تم تحديث أوقات العمل." };
  }

  // ─── Public Listing ───────────────────────────────────────────────────────────

  async listPublicRestaurants(opts: { city?: string; page?: number; limit?: number } = {}) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 10));
    const skip = (page - 1) * limit;

    const qb = this.restaurantRepo
      .createQueryBuilder("r")
      .where("r.status = :status", { status: RestaurantStatus.ACTIVE });

    if (opts.city) qb.andWhere("r.city ILIKE :city", { city: `%${opts.city}%` });

    const [restaurants, total] = await qb
      .orderBy("r.rating", "DESC")
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: restaurants,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      message: "تم استرجاع المطاعم.",
    };
  }

  async getPublicRestaurantByName(name: string) {
    const restaurant = await this.restaurantRepo
      .createQueryBuilder("r")
      .where("r.status = :status", { status: RestaurantStatus.ACTIVE })
      .andWhere("LOWER(r.name) = LOWER(:name)", { name: name.trim() })
      .getOne();
    if (!restaurant) throw new NotFoundException("المطعم غير موجود.");
    return this.getPublicRestaurantWithMenu(restaurant.id);
  }

  async getPublicRestaurantWithMenu(restaurantId: string) {
    const restaurant = await this.restaurantRepo.findOne({
      where: { id: restaurantId, status: RestaurantStatus.ACTIVE },
    });
    if (!restaurant) throw new NotFoundException("المطعم غير موجود.");

    const menus = await this.menuRepo.find({
      where: { restaurantId, isActive: true },
    });

    const menusWithSections = await Promise.all(
      menus.map(async (menu) => {
        const sections = await this.sectionRepo.find({
          where: { menuId: menu.id },
        });
        const sectionsWithMeals = await Promise.all(
          sections.map(async (section) => {
            const meals = await this.mealRepo.find({
              where: { sectionId: section.id, isAvailable: true },
            });
            const mealsWithOptions = await Promise.all(
              meals.map(async (meal) => {
                const optionGroups = await this.optionGroupRepo.find({
                  where: { mealId: meal.id },
                });
                const groupsWithOptions = await Promise.all(
                  optionGroups.map(async (group) => {
                    const options = await this.optionRepo.find({
                      where: { groupId: group.id, isAvailable: true },
                    });
                    return { ...group, options };
                  }),
                );
                const mealWithImage = await this.withMealImage(meal);
                return { ...mealWithImage, optionGroups: groupsWithOptions };
              }),
            );
            return { ...section, meals: mealsWithOptions };
          }),
        );
        return { ...menu, sections: sectionsWithMeals };
      }),
    );

    return {
      // Presign logo/cover (S3 keys → URLs) and surface brandColor for the
      // customer QR menu's theming.
      data: { ...(await this.withPresignedUrls(restaurant)), menus: menusWithSections },
      message: "Restaurant retrieved",
    };
  }

  // ─── Mobile (lightweight, paginated, customer-app endpoints) ──────────────────

  async mobileListRestaurants(opts: {
    city?: string;
    search?: string;
    cuisineType?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(50, Math.max(1, opts.limit ?? 10));
    const skip = (page - 1) * limit;

    const qb = this.restaurantRepo
      .createQueryBuilder("r")
      .where("r.status = :status", { status: RestaurantStatus.ACTIVE });

    if (opts.city) qb.andWhere("r.city ILIKE :city", { city: `%${opts.city}%` });
    if (opts.cuisineType) qb.andWhere("r.cuisine_type = :ct", { ct: opts.cuisineType });
    if (opts.search) qb.andWhere("r.name ILIKE :q", { q: `%${opts.search}%` });

    const [restaurants, total] = await qb
      .orderBy("r.is_open", "DESC")
      .addOrderBy("r.rating", "DESC")
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const items = await Promise.all(
      restaurants.map(async (r) => ({
        id: r.id,
        name: r.name,
        logoUrl: await this.s3.resolveImageUrl(r.logoUrl),
        coverUrl: await this.s3.resolveImageUrl(r.coverUrl),
        city: r.city,
        cuisineType: r.cuisineType,
        rating: Number(r.rating),
        totalRatings: r.totalRatings,
        minOrderAmount: Number(r.minOrderAmount),
        isOpen: r.isOpen,
      })),
    );

    const totalPages = Math.ceil(total / limit) || 1;
    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      message: "تم استرجاع المطاعم.",
    };
  }

  async mobileGetRestaurant(restaurantId: string) {
    const restaurant = await this.restaurantRepo.findOne({
      where: { id: restaurantId, status: RestaurantStatus.ACTIVE },
    });
    if (!restaurant) throw new NotFoundException("المطعم غير موجود.");

    const hours = await this.hoursRepo.find({
      where: { restaurantId: restaurant.id },
      order: { dayOfWeek: "ASC" },
    });

    const [logoUrl, coverUrl] = await Promise.all([
      this.s3.resolveImageUrl(restaurant.logoUrl),
      this.s3.resolveImageUrl(restaurant.coverUrl),
    ]);

    return {
      data: {
        id: restaurant.id,
        name: restaurant.name,
        description: restaurant.description,
        logoUrl,
        coverUrl,
        phone: restaurant.phone,
        cuisineType: restaurant.cuisineType,
        street: restaurant.street,
        city: restaurant.city,
        lat: restaurant.lat,
        lng: restaurant.lng,
        minOrderAmount: Number(restaurant.minOrderAmount),
        rating: Number(restaurant.rating),
        totalRatings: restaurant.totalRatings,
        isOpen: restaurant.isOpen,
        hours,
      },
      message: "تم استرجاع المطعم.",
    };
  }

  async mobileListMenus(restaurantId: string) {
    const restaurant = await this.restaurantRepo.findOne({
      where: { id: restaurantId, status: RestaurantStatus.ACTIVE },
      select: ["id"],
    });
    if (!restaurant) throw new NotFoundException("المطعم غير موجود.");

    const menus = await this.menuRepo.find({
      where: { restaurantId: restaurant.id, isActive: true },
      order: { displayOrder: "ASC" },
    });

    if (menus.length === 0) {
      return { data: [], message: "تم استرجاع القوائم." };
    }

    const menuIds = menus.map((m) => m.id);
    const sections = await this.sectionRepo.find({
      where: { menuId: In(menuIds) },
    });

    const sectionsByMenu = new Map<string, string[]>();
    for (const s of sections) {
      const list = sectionsByMenu.get(s.menuId) ?? [];
      list.push(s.id);
      sectionsByMenu.set(s.menuId, list);
    }

    const sectionIds = sections.map((s) => s.id);
    const mealCountRows = sectionIds.length
      ? await this.mealRepo
          .createQueryBuilder("m")
          .select("m.section_id", "sectionId")
          .addSelect("COUNT(*)", "count")
          .where("m.section_id IN (:...ids)", { ids: sectionIds })
          .andWhere("m.is_available = true")
          .groupBy("m.section_id")
          .getRawMany<{ sectionId: string; count: string }>()
      : [];
    const mealsBySection = new Map<string, number>();
    for (const r of mealCountRows) mealsBySection.set(r.sectionId, Number(r.count));

    const data = menus.map((menu) => {
      const ownSections = sectionsByMenu.get(menu.id) ?? [];
      const mealCount = ownSections.reduce(
        (acc, sid) => acc + (mealsBySection.get(sid) ?? 0),
        0,
      );
      return {
        id: menu.id,
        name: menu.name,
        displayOrder: menu.displayOrder,
        sectionCount: ownSections.length,
        mealCount,
      };
    });

    return { data, message: "تم استرجاع القوائم." };
  }

  async mobileGetMenu(menuId: string) {
    const menu = await this.menuRepo.findOne({
      where: { id: menuId, isActive: true },
    });
    if (!menu) throw new NotFoundException("القائمة غير موجودة.");

    const restaurant = await this.restaurantRepo.findOne({
      where: { id: menu.restaurantId, status: RestaurantStatus.ACTIVE },
      select: ["id"],
    });
    if (!restaurant) throw new NotFoundException("المطعم غير متاح.");

    const sections = await this.sectionRepo.find({
      where: { menuId: menu.id },
      order: { displayOrder: "ASC" },
    });
    if (sections.length === 0) {
      return {
        data: { ...menu, sections: [] },
        message: "تم استرجاع القائمة.",
      };
    }

    const sectionIds = sections.map((s) => s.id);
    const meals = await this.mealRepo.find({
      where: { sectionId: In(sectionIds), isAvailable: true },
      order: { displayOrder: "ASC" },
    });

    const mealIds = meals.map((m) => m.id);
    const optionGroups = mealIds.length
      ? await this.optionGroupRepo.find({ where: { mealId: In(mealIds) } })
      : [];
    const groupIds = optionGroups.map((g) => g.id);
    const options = groupIds.length
      ? await this.optionRepo.find({
          where: { groupId: In(groupIds), isAvailable: true },
        })
      : [];

    const optionsByGroup = new Map<string, typeof options>();
    for (const o of options) {
      const list = optionsByGroup.get(o.groupId) ?? [];
      list.push(o);
      optionsByGroup.set(o.groupId, list);
    }

    const groupsByMeal = new Map<string, any[]>();
    for (const g of optionGroups) {
      const list = groupsByMeal.get(g.mealId) ?? [];
      list.push({ ...g, options: optionsByGroup.get(g.id) ?? [] });
      groupsByMeal.set(g.mealId, list);
    }

    const mealsWithImages = await Promise.all(
      meals.map(async (m) => ({
        ...(await this.withMealImage(m)),
        optionGroups: groupsByMeal.get(m.id) ?? [],
      })),
    );

    const mealsBySection = new Map<string, typeof mealsWithImages>();
    for (const m of mealsWithImages) {
      const list = mealsBySection.get(m.sectionId) ?? [];
      list.push(m);
      mealsBySection.set(m.sectionId, list);
    }

    const sectionsWithMeals = sections.map((s) => ({
      ...s,
      meals: mealsBySection.get(s.id) ?? [],
    }));

    return {
      data: { ...menu, sections: sectionsWithMeals },
      message: "تم استرجاع القائمة.",
    };
  }

  // ─── Menus ────────────────────────────────────────────────────────────────────

  async getMenus(ownerId: string) {
    const restaurant = await this.getOwnedRestaurant(ownerId);
    const menus = await this.menuRepo.find({
      where: { restaurantId: restaurant.id },
    });
    return { data: menus, message: "تم استرجاع القوائم." };
  }

  async createMenu(ownerId: string, dto: CreateMenuDto) {
    const restaurant = await this.getOwnedRestaurant(ownerId);
    const menu = await this.menuRepo.save(
      this.menuRepo.create({
        restaurantId: restaurant.id,
        name: dto.name,
        isActive: dto.isActive ?? true,
        displayOrder: dto.displayOrder ?? 0,
      }),
    );
    return { data: menu, message: "تم إنشاء القائمة." };
  }

  async updateMenu(ownerId: string, menuId: string, dto: UpdateMenuDto) {
    const restaurant = await this.getOwnedRestaurant(ownerId);
    const menu = await this.assertMenuOwner(menuId, restaurant.id);
    await this.menuRepo.update(menu.id, { ...dto });
    return {
      data: await this.menuRepo.findOne({ where: { id: menu.id } }),
      message: "تم تحديث القائمة.",
    };
  }

  async deleteMenu(ownerId: string, menuId: string) {
    const restaurant = await this.getOwnedRestaurant(ownerId);
    const menu = await this.assertMenuOwner(menuId, restaurant.id);
    await this.menuRepo.delete(menu.id);
    return { data: null, message: "تم حذف القائمة." };
  }

  // ─── Menu Sections ────────────────────────────────────────────────────────────

  async getSections(ownerId: string, menuId: string) {
    const restaurant = await this.getOwnedRestaurant(ownerId);
    await this.assertMenuOwner(menuId, restaurant.id);
    const sections = await this.sectionRepo.find({ where: { menuId } });
    return { data: sections, message: "تم استرجاع الأقسام." };
  }

  async createSection(ownerId: string, menuId: string, dto: CreateSectionDto) {
    const restaurant = await this.getOwnedRestaurant(ownerId);
    await this.assertMenuOwner(menuId, restaurant.id);
    const section = await this.sectionRepo.save(
      this.sectionRepo.create({
        menuId,
        name: dto.name,
        displayOrder: dto.displayOrder ?? 0,
      }),
    );
    return { data: section, message: "تم إنشاء القسم." };
  }

  async updateSection(
    ownerId: string,
    sectionId: string,
    dto: UpdateSectionDto,
  ) {
    const restaurant = await this.getOwnedRestaurant(ownerId);
    const section = await this.assertSectionOwner(sectionId, restaurant.id);
    await this.sectionRepo.update(section.id, { ...dto });
    return {
      data: await this.sectionRepo.findOne({ where: { id: section.id } }),
      message: "تم تحديث القسم.",
    };
  }

  async deleteSection(ownerId: string, sectionId: string) {
    const restaurant = await this.getOwnedRestaurant(ownerId);
    const section = await this.assertSectionOwner(sectionId, restaurant.id);
    await this.sectionRepo.delete(section.id);
    return { data: null, message: "تم حذف القسم." };
  }

  // ─── Meals ────────────────────────────────────────────────────────────────────

  async getMeals(ownerId: string, sectionId: string) {
    const restaurant = await this.getOwnedRestaurant(ownerId);
    await this.assertSectionOwner(sectionId, restaurant.id);
    const meals = await this.mealRepo.find({ where: { sectionId } });
    const data = await Promise.all(meals.map((m) => this.withMealImage(m)));
    return { data, message: "تم استرجاع الوجبات." };
  }

  async createMeal(
    ownerId: string,
    dto: CreateMealDto,
    imageFile?: Express.Multer.File,
  ) {
    const restaurant = await this.getOwnedRestaurant(ownerId);
    await this.assertSectionOwner(dto.sectionId, restaurant.id);

    let imageKey: string | undefined = dto.imageUrl;
    if (imageFile) {
      try {
        imageKey = await this.s3.upload(imageFile, "meals");
      } catch (err) {
        this.logger.error("S3 upload failed during createMeal", err);
        throw new BadRequestException("فشل رفع صورة الوجبة.");
      }
    } else {
      // An external image URL → pull it into S3 so all images live on our bucket.
      imageKey = (await this.s3.ensureUploaded(imageKey, "meals")) ?? undefined;
    }

    const meal = await this.mealRepo.save(
      this.mealRepo.create({
        restaurantId: restaurant.id,
        sectionId: dto.sectionId,
        name: dto.name,
        description: dto.description,
        imageUrl: imageKey,
        basePrice: dto.basePrice,
        discountPrice: dto.discountPrice,
        calories: dto.calories,
        isAvailable: dto.isAvailable ?? true,
        isFeatured: dto.isFeatured ?? false,
        tags: dto.tags,
        displayOrder: dto.displayOrder ?? 0,
      }),
    );
    return { data: await this.withMealImage(meal), message: "تم إنشاء الوجبة." };
  }

  async updateMeal(
    ownerId: string,
    mealId: string,
    dto: UpdateMealDto,
    imageFile?: Express.Multer.File,
  ) {
    const restaurant = await this.getOwnedRestaurant(ownerId);
    const meal = await this.assertMealOwner(mealId, restaurant.id);

    if (dto.sectionId) {
      await this.assertSectionOwner(dto.sectionId, restaurant.id);
    }

    let oldKeyToDelete: string | null = null;
    const patch: Partial<Meal> = { ...dto };

    if (imageFile) {
      let newKey: string;
      try {
        newKey = await this.s3.upload(imageFile, "meals");
      } catch (err) {
        this.logger.error("S3 upload failed during updateMeal", err);
        throw new BadRequestException("فشل رفع صورة الوجبة.");
      }
      patch.imageUrl = newKey;
      // Only delete the old object if it's an S3 key, not an external URL
      if (meal.imageUrl && !/^https?:\/\//i.test(meal.imageUrl)) {
        oldKeyToDelete = meal.imageUrl;
      }
    } else if (typeof dto.imageUrl === "string" && /^https?:\/\//i.test(dto.imageUrl)) {
      // External image URL passed in → ingest into S3 and store the key instead.
      const newKey = await this.s3.ensureUploaded(dto.imageUrl, "meals");
      if (newKey && newKey !== dto.imageUrl) {
        patch.imageUrl = newKey;
        if (meal.imageUrl && !/^https?:\/\//i.test(meal.imageUrl)) {
          oldKeyToDelete = meal.imageUrl;
        }
      }
    }

    await this.mealRepo.update(meal.id, patch);

    if (oldKeyToDelete) {
      // Fire-and-forget — stale S3 objects are a cleanup concern, not a correctness one
      this.s3.delete(oldKeyToDelete).catch((err) =>
        this.logger.warn(`Failed to delete old meal image ${oldKeyToDelete}`, err),
      );
    }

    const updated = await this.mealRepo.findOne({ where: { id: meal.id } });
    if (!updated) throw new NotFoundException("لم يُعثر على الوجبة بعد التحديث.");
    return { data: await this.withMealImage(updated), message: "تم تحديث الوجبة." };
  }

  async deleteMeal(ownerId: string, mealId: string) {
    const restaurant = await this.getOwnedRestaurant(ownerId);
    const meal = await this.assertMealOwner(mealId, restaurant.id);
    await this.mealRepo.delete(meal.id);

    // Best-effort S3 cleanup
    if (meal.imageUrl && !/^https?:\/\//i.test(meal.imageUrl)) {
      this.s3.delete(meal.imageUrl).catch((err) =>
        this.logger.warn(`Failed to delete meal image ${meal.imageUrl}`, err),
      );
    }

    return { data: null, message: "تم حذف الوجبة." };
  }

  // ─── Reorder ──────────────────────────────────────────────────────────────────
  //
  // Batch updates a list of `(id, displayOrder)` pairs. Each method verifies
  // ownership of every id before any write, then applies all writes in one
  // transaction so partial reorders can't leave the menu half-sorted.

  async reorderMenus(ownerId: string, dto: ReorderDto) {
    const restaurant = await this.getOwnedRestaurant(ownerId);
    const ids = dto.items.map((i) => i.id);

    const menus = await this.menuRepo.findBy({ id: In(ids) });
    if (menus.length !== ids.length) {
      throw new NotFoundException("بعض القوائم غير موجودة.");
    }
    if (menus.some((m) => m.restaurantId !== restaurant.id)) {
      throw new ForbiddenException("لا تملك صلاحية إعادة ترتيب هذه القوائم.");
    }

    await this.menuRepo.manager.transaction(async (em) => {
      for (const item of dto.items) {
        await em.update(Menu, item.id, { displayOrder: item.displayOrder });
      }
    });
    return { data: null, message: "تم تحديث ترتيب القوائم." };
  }

  async reorderSections(ownerId: string, menuId: string, dto: ReorderDto) {
    const restaurant = await this.getOwnedRestaurant(ownerId);
    await this.assertMenuOwner(menuId, restaurant.id);
    const ids = dto.items.map((i) => i.id);

    const sections = await this.sectionRepo.findBy({ id: In(ids) });
    if (sections.length !== ids.length) {
      throw new NotFoundException("بعض الأقسام غير موجودة.");
    }
    if (sections.some((s) => s.menuId !== menuId)) {
      throw new BadRequestException("جميع الأقسام يجب أن تنتمي لنفس القائمة.");
    }

    await this.sectionRepo.manager.transaction(async (em) => {
      for (const item of dto.items) {
        await em.update(MenuSection, item.id, { displayOrder: item.displayOrder });
      }
    });
    return { data: null, message: "تم تحديث ترتيب الأقسام." };
  }

  async reorderMeals(ownerId: string, sectionId: string, dto: ReorderDto) {
    const restaurant = await this.getOwnedRestaurant(ownerId);
    await this.assertSectionOwner(sectionId, restaurant.id);
    const ids = dto.items.map((i) => i.id);

    const meals = await this.mealRepo.findBy({ id: In(ids) });
    if (meals.length !== ids.length) {
      throw new NotFoundException("بعض الوجبات غير موجودة.");
    }
    if (meals.some((m) => m.sectionId !== sectionId || m.restaurantId !== restaurant.id)) {
      throw new BadRequestException("جميع الوجبات يجب أن تنتمي لنفس القسم.");
    }

    await this.mealRepo.manager.transaction(async (em) => {
      for (const item of dto.items) {
        await em.update(Meal, item.id, { displayOrder: item.displayOrder });
      }
    });
    return { data: null, message: "تم تحديث ترتيب الوجبات." };
  }

  async toggleMealAvailability(ownerId: string, mealId: string) {
    const restaurant = await this.getOwnedRestaurant(ownerId);
    const meal = await this.assertMealOwner(mealId, restaurant.id);
    const newState = !meal.isAvailable;
    await this.mealRepo.update(meal.id, { isAvailable: newState });
    return {
      data: { isAvailable: newState },
      message: newState ? "Meal is now available" : "Meal is now unavailable",
    };
  }

  // ─── Meal Option Groups ───────────────────────────────────────────────────────

  async getOptionGroups(ownerId: string, mealId: string) {
    const restaurant = await this.getOwnedRestaurant(ownerId);
    await this.assertMealOwner(mealId, restaurant.id);
    const groups = await this.optionGroupRepo.find({ where: { mealId } });
    return { data: groups, message: "تم استرجاع مجموعات الخيارات." };
  }

  async createOptionGroup(
    ownerId: string,
    mealId: string,
    dto: CreateOptionGroupDto,
  ) {
    const restaurant = await this.getOwnedRestaurant(ownerId);
    await this.assertMealOwner(mealId, restaurant.id);
    const group = await this.optionGroupRepo.save(
      this.optionGroupRepo.create({
        mealId,
        name: dto.name,
        selectionType: dto.selectionType,
        isRequired: dto.isRequired ?? false,
        maxSelections: dto.maxSelections,
      }),
    );
    return { data: group, message: "تم إنشاء مجموعة الخيارات." };
  }

  async updateOptionGroup(
    ownerId: string,
    groupId: string,
    dto: UpdateOptionGroupDto,
  ) {
    const restaurant = await this.getOwnedRestaurant(ownerId);
    const group = await this.assertOptionGroupOwner(groupId, restaurant.id);
    await this.optionGroupRepo.update(group.id, { ...dto });
    return {
      data: await this.optionGroupRepo.findOne({ where: { id: group.id } }),
      message: "تم تحديث مجموعة الخيارات.",
    };
  }

  async deleteOptionGroup(ownerId: string, groupId: string) {
    const restaurant = await this.getOwnedRestaurant(ownerId);
    const group = await this.assertOptionGroupOwner(groupId, restaurant.id);
    await this.optionGroupRepo.delete(group.id);
    return { data: null, message: "تم حذف مجموعة الخيارات." };
  }

  // ─── Meal Options ─────────────────────────────────────────────────────────────

  async getOptions(ownerId: string, groupId: string) {
    const restaurant = await this.getOwnedRestaurant(ownerId);
    await this.assertOptionGroupOwner(groupId, restaurant.id);
    const options = await this.optionRepo.find({ where: { groupId } });
    return { data: options, message: "تم استرجاع الخيارات." };
  }

  async createOption(ownerId: string, groupId: string, dto: CreateOptionDto) {
    const restaurant = await this.getOwnedRestaurant(ownerId);
    await this.assertOptionGroupOwner(groupId, restaurant.id);
    const option = await this.optionRepo.save(
      this.optionRepo.create({
        groupId,
        name: dto.name,
        extraPrice: dto.extraPrice ?? 0,
        isAvailable: dto.isAvailable ?? true,
      }),
    );
    return { data: option, message: "تم إنشاء الخيار." };
  }

  async updateOption(ownerId: string, optionId: string, dto: UpdateOptionDto) {
    const restaurant = await this.getOwnedRestaurant(ownerId);
    const option = await this.optionRepo.findOne({ where: { id: optionId } });
    if (!option) throw new NotFoundException("الخيار غير موجود.");
    await this.assertOptionGroupOwner(option.groupId, restaurant.id);
    await this.optionRepo.update(option.id, { ...dto });
    return {
      data: await this.optionRepo.findOne({ where: { id: option.id } }),
      message: "تم تحديث الخيار.",
    };
  }

  async deleteOption(ownerId: string, optionId: string) {
    const restaurant = await this.getOwnedRestaurant(ownerId);
    const option = await this.optionRepo.findOne({ where: { id: optionId } });
    if (!option) throw new NotFoundException("الخيار غير موجود.");
    await this.assertOptionGroupOwner(option.groupId, restaurant.id);
    await this.optionRepo.delete(option.id);
    return { data: null, message: "تم حذف الخيار." };
  }

  // ─── Manager Dashboard — Restaurant Administration ──────────────────────────
  // All endpoints require manager role (enforced via guards on the controller).

  async adminListRestaurants(query: AdminListRestaurantsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.restaurantRepo.createQueryBuilder("r");

    if (query.status) qb.andWhere("r.status = :status", { status: query.status });
    if (query.cuisineType)
      qb.andWhere("r.cuisine_type = :ct", { ct: query.cuisineType });
    if (query.city)
      qb.andWhere("r.city ILIKE :city", { city: `%${query.city}%` });
    if (query.search) {
      qb.andWhere(
        new Brackets((b) => {
          b.where("r.name ILIKE :s", { s: `%${query.search}%` })
            .orWhere("r.owner_name ILIKE :s", { s: `%${query.search}%` })
            .orWhere("r.phone ILIKE :s", { s: `%${query.search}%` });
        }),
      );
    }

    qb.orderBy("r.created_at", "DESC")
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    return {
      data: { items, total, page, limit, pages: Math.ceil(total / limit) },
      message: "تم استرجاع المطاعم.",
    };
  }

  async adminGetRestaurant(id: string) {
    const restaurant = await this.restaurantRepo.findOne({ where: { id } });
    if (!restaurant) throw new NotFoundException("المطعم غير موجود.");
    return {
      data: await this.withPresignedUrls(restaurant),
      message: "تم استرجاع بيانات المطعم.",
    };
  }

  /**
   * GET /api/restaurant/manager/restaurants/:id/full
   * Manager-only: returns the restaurant profile, hours, and the entire
   * menu tree (menus → sections → meals → option groups → options) in a
   * single response. Loaded in batched queries (no N+1).
   */
  async adminGetRestaurantFull(id: string) {
    const restaurant = await this.restaurantRepo.findOne({ where: { id } });
    if (!restaurant) throw new NotFoundException("المطعم غير موجود.");

    const [hours, menus] = await Promise.all([
      this.hoursRepo.find({
        where: { restaurantId: id },
        order: { dayOfWeek: "ASC" },
      }),
      this.menuRepo.find({
        where: { restaurantId: id },
        order: { displayOrder: "ASC", id: "ASC" },
      }),
    ]);

    const menuIds = menus.map((m) => m.id);
    const sections = menuIds.length
      ? await this.sectionRepo.find({
          where: { menuId: In(menuIds) },
          order: { displayOrder: "ASC", id: "ASC" },
        })
      : [];

    const meals = await this.mealRepo.find({
      where: { restaurantId: id },
      order: { displayOrder: "ASC", id: "ASC" },
    });

    const mealIds = meals.map((m) => m.id);
    const optionGroups = mealIds.length
      ? await this.optionGroupRepo.find({ where: { mealId: In(mealIds) } })
      : [];

    const groupIds = optionGroups.map((g) => g.id);
    const options = groupIds.length
      ? await this.optionRepo.find({ where: { groupId: In(groupIds) } })
      : [];

    // Resolve meal images in parallel.
    const mealsWithImages = await Promise.all(
      meals.map((m) => this.withMealImage(m)),
    );

    // Build lookup indices.
    const optionsByGroup = new Map<string, MealOption[]>();
    for (const o of options) {
      const list = optionsByGroup.get(o.groupId) ?? [];
      list.push(o);
      optionsByGroup.set(o.groupId, list);
    }

    const groupsByMeal = new Map<
      string,
      Array<MealOptionGroup & { options: MealOption[] }>
    >();
    for (const g of optionGroups) {
      const list = groupsByMeal.get(g.mealId) ?? [];
      list.push({ ...g, options: optionsByGroup.get(g.id) ?? [] });
      groupsByMeal.set(g.mealId, list);
    }

    const mealsBySection = new Map<string, any[]>();
    for (const m of mealsWithImages) {
      const list = mealsBySection.get(m.sectionId) ?? [];
      list.push({ ...m, optionGroups: groupsByMeal.get(m.id) ?? [] });
      mealsBySection.set(m.sectionId, list);
    }

    const sectionsByMenu = new Map<string, any[]>();
    for (const s of sections) {
      const list = sectionsByMenu.get(s.menuId) ?? [];
      list.push({ ...s, meals: mealsBySection.get(s.id) ?? [] });
      sectionsByMenu.set(s.menuId, list);
    }

    const menusTree = menus.map((m) => ({
      ...m,
      sections: sectionsByMenu.get(m.id) ?? [],
    }));

    return {
      data: {
        restaurant: await this.withPresignedUrls(restaurant),
        hours,
        menus: menusTree,
      },
      message: "تم استرجاع بيانات المطعم الكاملة.",
    };
  }

  async adminUpdateRestaurant(id: string, dto: UpdateProfileDto) {
    const restaurant = await this.restaurantRepo.findOne({ where: { id } });
    if (!restaurant) throw new NotFoundException("المطعم غير موجود.");
    await this.restaurantRepo.update(id, { ...dto });
    const updated = await this.restaurantRepo.findOne({ where: { id } });
    if (!updated) throw new NotFoundException("لم يُعثر على المطعم بعد التحديث.");
    return {
      data: await this.withPresignedUrls(updated),
      message: "تم تحديث بيانات المطعم.",
    };
  }

  async adminChangeRestaurantStatus(
    id: string,
    dto: AdminChangeRestaurantStatusDto,
  ) {
    const restaurant = await this.restaurantRepo.findOne({ where: { id } });
    if (!restaurant) throw new NotFoundException("المطعم غير موجود.");

    if (restaurant.status === dto.status) {
      return {
        data: { id, status: restaurant.status },
        message: "الحالة لم تتغير.",
      };
    }

    await this.restaurantRepo.update(id, { status: dto.status });

    // If suspending/closing, also force the restaurant offline.
    if (dto.status !== RestaurantStatus.ACTIVE && restaurant.isOpen) {
      await this.restaurantRepo.update(id, { isOpen: false });
    }

    return {
      data: { id, status: dto.status },
      message: "تم تحديث حالة المطعم.",
    };
  }

  async adminDeleteRestaurant(id: string) {
    const restaurant = await this.restaurantRepo.findOne({ where: { id } });
    if (!restaurant) throw new NotFoundException("المطعم غير موجود.");

    await this.restaurantRepo.delete(id);

    try {
      this.natsClient.emit("restaurant.deleted", {
        restaurantId: id,
        ownerUserId: restaurant.ownerUserId,
      });
    } catch (err) {
      this.logger.error("NATS emit restaurant.deleted failed", err);
    }

    return { data: null, message: "تم حذف المطعم." };
  }
}
