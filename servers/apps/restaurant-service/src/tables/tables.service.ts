import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { randomBytes } from "crypto";
import { RestaurantTable } from "../entities/restaurant-table.entity";
import { Restaurant } from "../entities/restaurant.entity";
import { CreateTableDto, UpdateTableDto } from "../dto/restaurant-table.dto";
import { S3Service } from "../s3.service";

@Injectable()
export class TablesService {
  constructor(
    @InjectRepository(RestaurantTable)
    private readonly tableRepo: Repository<RestaurantTable>,
    @InjectRepository(Restaurant)
    private readonly restaurantRepo: Repository<Restaurant>,
    private readonly s3: S3Service,
  ) {}

  // ─── Internals ────────────────────────────────────────────────────────────

  private generateQrToken(): string {
    // 32 hex chars = 128 bits. Plenty of entropy for a guessable-resistant URL token.
    return randomBytes(16).toString("hex");
  }

  private async resolveOwnedRestaurant(userId: string, role: string): Promise<string> {
    if (role === "manager") {
      throw new BadRequestException("manager must specify restaurantId");
    }
    const restaurant = await this.restaurantRepo.findOne({
      where: { ownerUserId: userId },
    });
    if (!restaurant) throw new NotFoundException("لم يتم العثور على مطعم");
    return restaurant.id;
  }

  private async assertAccess(table: RestaurantTable, userId: string, role: string) {
    if (role === "manager") return;
    const restaurant = await this.restaurantRepo.findOne({
      where: { id: table.restaurantId },
    });
    if (!restaurant || restaurant.ownerUserId !== userId) {
      throw new ForbiddenException("غير مصرح");
    }
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  async list(userId: string, role: string) {
    const restaurantId = await this.resolveOwnedRestaurant(userId, role);
    const tables = await this.tableRepo.find({
      where: { restaurantId },
      order: { number: "ASC" },
    });
    if (!tables.length) return tables;

    // Pull the currently-active POS bills (one per table at most) so the
    // dashboard can render open/closed state and a quick-view of the order
    // without an extra round-trip. Raw SQL: POS orders live in the shared
    // `orders` table (single-table-inheritance) with kind='local'.
    const tableIds = tables.map((t) => t.id);
    const activeOrders: Array<{
      id: string;
      table_id: string;
      order_number: string;
      local_status: string;
      total_amount: string;
      subtotal: string;
      payment_status: string;
      preparing_started_at: Date | null;
      created_at: Date;
      items_count: string;
    }> = await this.tableRepo.manager.query(
      `SELECT o.id, o.table_id, o.order_number, o.local_status,
              o.total_amount, o.subtotal, o.payment_status,
              o.preparing_started_at, o.created_at,
              (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS items_count
         FROM orders o
        WHERE o.kind = 'local'
          AND o.table_id = ANY($1)
          AND o.local_status IN ('pending', 'open', 'preparing')`,
      [tableIds],
    );

    const byTableId = new Map(activeOrders.map((o) => [o.table_id, o]));
    return tables.map((t) => {
      const o = byTableId.get(t.id);
      return {
        ...t,
        activeOrder: o
          ? {
              id: o.id,
              orderNumber: o.order_number,
              localStatus: o.local_status,
              totalAmount: Number(o.total_amount),
              subtotal: Number(o.subtotal),
              paymentStatus: o.payment_status,
              preparingStartedAt: o.preparing_started_at,
              createdAt: o.created_at,
              itemsCount: Number(o.items_count),
            }
          : null,
      };
    });
  }

  async create(userId: string, role: string, dto: CreateTableDto) {
    const restaurantId = await this.resolveOwnedRestaurant(userId, role);

    const existing = await this.tableRepo.findOne({
      where: { restaurantId, number: dto.number },
    });
    if (existing) throw new ConflictException("رقم الطاولة مستخدم بالفعل");

    const table = this.tableRepo.create({
      restaurantId,
      number: dto.number,
      capacity: dto.capacity ?? 4,
      section: dto.section ?? null,
      isActive: dto.isActive ?? true,
      qrToken: this.generateQrToken(),
    });
    return this.tableRepo.save(table);
  }

  async update(id: string, userId: string, role: string, dto: UpdateTableDto) {
    const table = await this.tableRepo.findOne({ where: { id } });
    if (!table) throw new NotFoundException("الطاولة غير موجودة");
    await this.assertAccess(table, userId, role);

    if (dto.number && dto.number !== table.number) {
      const dupe = await this.tableRepo.findOne({
        where: { restaurantId: table.restaurantId, number: dto.number },
      });
      if (dupe) throw new ConflictException("رقم الطاولة مستخدم بالفعل");
    }

    Object.assign(table, {
      number: dto.number ?? table.number,
      capacity: dto.capacity ?? table.capacity,
      section: dto.section ?? table.section,
      isActive: dto.isActive ?? table.isActive,
    });
    return this.tableRepo.save(table);
  }

  async remove(id: string, userId: string, role: string) {
    const table = await this.tableRepo.findOne({ where: { id } });
    if (!table) throw new NotFoundException("الطاولة غير موجودة");
    await this.assertAccess(table, userId, role);
    await this.tableRepo.delete(id);
  }

  async regenerateQr(id: string, userId: string, role: string) {
    const table = await this.tableRepo.findOne({ where: { id } });
    if (!table) throw new NotFoundException("الطاولة غير موجودة");
    await this.assertAccess(table, userId, role);
    table.qrToken = this.generateQrToken();
    return this.tableRepo.save(table);
  }

  // ─── Public (no auth) ────────────────────────────────────────────────────

  async findByQrToken(token: string) {
    const table = await this.tableRepo.findOne({ where: { qrToken: token } });
    if (!table || !table.isActive) {
      throw new NotFoundException("الطاولة غير موجودة أو غير نشطة");
    }
    const restaurant = await this.restaurantRepo.findOne({
      where: { id: table.restaurantId },
    });
    if (!restaurant) throw new NotFoundException("المطعم غير موجود");

    // Presign the image keys so the customer page can actually render them —
    // logoUrl/coverUrl are raw S3 keys in the DB, not loadable URLs.
    const [logoUrl, coverUrl] = await Promise.all([
      this.s3.resolveImageUrl(restaurant.logoUrl),
      this.s3.resolveImageUrl(restaurant.coverUrl),
    ]);

    // Minimal shape for the public QR landing page — no internal fields.
    return {
      table: {
        id: table.id,
        number: table.number,
        section: table.section,
        capacity: table.capacity,
      },
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        logoUrl,
        coverUrl,
        brandColor: restaurant.brandColor ?? null,
      },
    };
  }
}
