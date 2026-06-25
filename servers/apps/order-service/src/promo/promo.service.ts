import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, IsNull, Or, DataSource } from 'typeorm';
import { PromoCode } from '../entities/promo-code.entity';
import { PromoCodeUsage } from '../entities/promo-code-usage.entity';
import { DiscountType } from '../entities/order-enums';
import { CreatePromoCodeDto, UpdatePromoCodeDto } from './promo.dto';

export interface PromoValidationResult {
  promoCodeId: string;
  discountAmount: number;
  code: string;
}

@Injectable()
export class PromoService {
  constructor(
    @InjectRepository(PromoCode) private readonly promoRepo: Repository<PromoCode>,
    @InjectRepository(PromoCodeUsage) private readonly usageRepo: Repository<PromoCodeUsage>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Look up the restaurant owned by the given user. Restaurants are owned by
   * one user (the registered restaurant_owner). Returns null when the user
   * doesn't own one — callers map that to 403.
   */
  private async resolveOwnedRestaurantId(userId: string): Promise<string | null> {
    const rows = await this.dataSource.query<{ id: string }[]>(
      'SELECT id FROM restaurants WHERE owner_user_id = $1 LIMIT 1',
      [userId],
    );
    return rows[0]?.id ?? null;
  }

  /** Throws 403 unless the promo belongs to the given owner's restaurant. */
  private async assertOwnedByUser(promoId: string, userId: string) {
    const restaurantId = await this.resolveOwnedRestaurantId(userId);
    if (!restaurantId) {
      throw new ForbiddenException('لم يتم العثور على مطعم مرتبط بهذا الحساب');
    }
    const promo = await this.promoRepo.findOne({ where: { id: promoId } });
    if (!promo) throw new NotFoundException('كود الخصم غير موجود');
    if (promo.restaurantId !== restaurantId) {
      throw new ForbiddenException('هذا الكوبون لا ينتمي إلى مطعمك');
    }
    return { promo, restaurantId };
  }

  async validate(
    code: string,
    orderAmount: number,
    customerId: string,
    restaurantId?: string,
  ): Promise<PromoValidationResult> {
    const promo = await this.promoRepo.findOne({ where: { code: code.toUpperCase() } });
    if (!promo) throw new BadRequestException('كود الخصم غير صالح');

    const now = new Date();
    if (promo.validFrom && promo.validFrom > now)
      throw new BadRequestException('كود الخصم لم يبدأ بعد');
    if (promo.validUntil && promo.validUntil < now)
      throw new BadRequestException('انتهت صلاحية كود الخصم');
    if (promo.usageLimit !== null && promo.usageCount >= promo.usageLimit)
      throw new BadRequestException('تم استنفاد كود الخصم');
    if (promo.restaurantId && promo.restaurantId !== restaurantId)
      throw new BadRequestException('كود الخصم غير متاح لهذا المطعم');
    if (Number(promo.minOrderAmount) > 0 && orderAmount < Number(promo.minOrderAmount))
      throw new BadRequestException(
        `الحد الأدنى للطلب هو ${promo.minOrderAmount} شيكل لاستخدام هذا الكود`,
      );

    const userUsageCount = await this.usageRepo.count({
      where: { promoCodeId: promo.id, customerId },
    });
    if (userUsageCount >= promo.perUserLimit)
      throw new BadRequestException('لقد استخدمت هذا الكود بالحد الأقصى المسموح به');

    let discountAmount =
      promo.discountType === DiscountType.PERCENTAGE
        ? (orderAmount * Number(promo.discountValue)) / 100
        : Number(promo.discountValue);

    if (promo.maxDiscountCap && discountAmount > Number(promo.maxDiscountCap)) {
      discountAmount = Number(promo.maxDiscountCap);
    }
    if (discountAmount > orderAmount) discountAmount = orderAmount;

    return { promoCodeId: promo.id, discountAmount, code: promo.code };
  }

  async recordUsage(
    promoCodeId: string,
    customerId: string,
    orderId: string,
    discountAmount: number,
  ): Promise<void> {
    await this.usageRepo.save(
      this.usageRepo.create({ promoCodeId, customerId, orderId, discountAmount }),
    );
    await this.promoRepo.increment({ id: promoCodeId }, 'usageCount', 1);
  }

  async create(dto: CreatePromoCodeDto): Promise<PromoCode> {
    const existing = await this.promoRepo.findOne({
      where: { code: dto.code.toUpperCase() },
    });
    if (existing) throw new ConflictException('كود الخصم موجود مسبقاً');

    return this.promoRepo.save(
      this.promoRepo.create({
        ...dto,
        code: dto.code.toUpperCase(),
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
      }),
    );
  }

  async list(restaurantId?: string) {
    const where = restaurantId ? { restaurantId } : {};
    return this.promoRepo.find({ where, order: { validUntil: 'ASC' } });
  }

  async update(id: string, dto: UpdatePromoCodeDto): Promise<PromoCode> {
    const promo = await this.promoRepo.findOne({ where: { id } });
    if (!promo) throw new NotFoundException('كود الخصم غير موجود');
    Object.assign(promo, {
      ...dto,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : promo.validUntil,
    });
    return this.promoRepo.save(promo);
  }

  async remove(id: string): Promise<void> {
    const promo = await this.promoRepo.findOne({ where: { id } });
    if (!promo) throw new NotFoundException('كود الخصم غير موجود');
    await this.promoRepo.remove(promo);
  }

  // ─── Restaurant-owner scoped variants ────────────────────────────────────
  // These wrap the manager methods with ownership checks against the
  // `restaurants.owner_user_id` column. The owner cannot create a promo for a
  // restaurant they don't own, and can only see / mutate their own promos.

  async listForOwner(userId: string) {
    const restaurantId = await this.resolveOwnedRestaurantId(userId);
    if (!restaurantId) {
      throw new ForbiddenException('لم يتم العثور على مطعم مرتبط بهذا الحساب');
    }
    return this.promoRepo.find({
      where: { restaurantId },
      order: { validUntil: 'ASC' },
    });
  }

  async createForOwner(userId: string, dto: CreatePromoCodeDto) {
    const restaurantId = await this.resolveOwnedRestaurantId(userId);
    if (!restaurantId) {
      throw new ForbiddenException('لم يتم العثور على مطعم مرتبط بهذا الحساب');
    }
    // Force the restaurantId to the owner's restaurant — ignore any value
    // the client sends so a malicious payload can't create a global promo.
    return this.create({ ...dto, restaurantId });
  }

  async updateForOwner(userId: string, id: string, dto: UpdatePromoCodeDto) {
    await this.assertOwnedByUser(id, userId);
    return this.update(id, dto);
  }

  async removeForOwner(userId: string, id: string): Promise<void> {
    await this.assertOwnedByUser(id, userId);
    await this.remove(id);
  }
}
