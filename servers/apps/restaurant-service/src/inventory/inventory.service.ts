import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { Restaurant } from "../entities/restaurant.entity";
import { InventoryItem } from "../entities/inventory-item.entity";
import { InventoryMovement, MovementType } from "../entities/inventory-movement.entity";
import {
  CreateInventoryItemDto,
  RecordMovementDto,
  UpdateInventoryItemDto,
} from "../dto/inventory.dto";

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryItem)
    private readonly itemRepo: Repository<InventoryItem>,
    @InjectRepository(InventoryMovement)
    private readonly movementRepo: Repository<InventoryMovement>,
    @InjectRepository(Restaurant)
    private readonly restaurantRepo: Repository<Restaurant>,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Scoping ─────────────────────────────────────────────────────────────

  private async resolveOwnedRestaurant(userId: string, role: string): Promise<string> {
    if (role === "manager") {
      throw new BadRequestException("manager must specify restaurantId");
    }
    const r = await this.restaurantRepo.findOne({ where: { ownerUserId: userId } });
    if (!r) throw new NotFoundException("لم يتم العثور على مطعم");
    return r.id;
  }

  private async assertItemAccess(item: InventoryItem, userId: string, role: string) {
    if (role === "manager") return;
    const r = await this.restaurantRepo.findOne({ where: { id: item.restaurantId } });
    if (!r || r.ownerUserId !== userId) {
      throw new ForbiddenException("غير مصرح");
    }
  }

  // ─── Items CRUD ──────────────────────────────────────────────────────────

  async listItems(userId: string, role: string) {
    const restaurantId = await this.resolveOwnedRestaurant(userId, role);
    return this.itemRepo.find({
      where: { restaurantId },
      order: { name: "ASC" },
    });
  }

  async createItem(userId: string, role: string, dto: CreateInventoryItemDto) {
    const restaurantId = await this.resolveOwnedRestaurant(userId, role);

    if (dto.sku) {
      const dupe = await this.itemRepo.findOne({
        where: { restaurantId, sku: dto.sku },
      });
      if (dupe) throw new ConflictException("SKU مستخدم بالفعل");
    }

    const item = this.itemRepo.create({
      restaurantId,
      name: dto.name,
      sku: dto.sku ?? null,
      unit: dto.unit,
      currentQuantity: dto.currentQuantity ?? 0,
      reorderThreshold: dto.reorderThreshold ?? 0,
      unitCost: dto.unitCost ?? 0,
      isActive: dto.isActive ?? true,
    });
    const saved = await this.itemRepo.save(item);

    // Initial stock counts as an opening IN movement so the audit trail
    // is complete from day one.
    if (saved.currentQuantity > 0) {
      await this.movementRepo.save(
        this.movementRepo.create({
          itemId: saved.id,
          restaurantId,
          type: MovementType.IN,
          quantity: saved.currentQuantity,
          unitCost: saved.unitCost,
          note: "Opening stock",
          createdByUserId: userId,
        }),
      );
    }

    return saved;
  }

  async updateItem(id: string, userId: string, role: string, dto: UpdateInventoryItemDto) {
    const item = await this.itemRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException("الصنف غير موجود");
    await this.assertItemAccess(item, userId, role);

    if (dto.sku && dto.sku !== item.sku) {
      const dupe = await this.itemRepo.findOne({
        where: { restaurantId: item.restaurantId, sku: dto.sku },
      });
      if (dupe) throw new ConflictException("SKU مستخدم بالفعل");
    }

    Object.assign(item, {
      name: dto.name ?? item.name,
      sku: dto.sku ?? item.sku,
      unit: dto.unit ?? item.unit,
      reorderThreshold: dto.reorderThreshold ?? item.reorderThreshold,
      unitCost: dto.unitCost ?? item.unitCost,
      isActive: dto.isActive ?? item.isActive,
    });
    return this.itemRepo.save(item);
  }

  async deleteItem(id: string, userId: string, role: string) {
    const item = await this.itemRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException("الصنف غير موجود");
    await this.assertItemAccess(item, userId, role);
    // Movements are kept (audit) — drop just the item row.
    await this.itemRepo.delete(id);
  }

  // ─── Movements ───────────────────────────────────────────────────────────

  async recordMovement(itemId: string, userId: string, role: string, dto: RecordMovementDto) {
    const item = await this.itemRepo.findOne({ where: { id: itemId } });
    if (!item) throw new NotFoundException("الصنف غير موجود");
    await this.assertItemAccess(item, userId, role);

    // Translate dto.quantity (always positive for IN/OUT) into a signed delta.
    let delta: number;
    switch (dto.type) {
      case MovementType.IN:
        if (dto.quantity <= 0) throw new BadRequestException("الكمية يجب أن تكون أكبر من صفر");
        delta = Math.abs(dto.quantity);
        break;
      case MovementType.OUT:
        if (dto.quantity <= 0) throw new BadRequestException("الكمية يجب أن تكون أكبر من صفر");
        delta = -Math.abs(dto.quantity);
        break;
      case MovementType.ADJUSTMENT:
        delta = dto.quantity; // already signed
        break;
    }

    const newQty = Number(item.currentQuantity) + delta;
    if (newQty < 0) {
      throw new BadRequestException("لا يمكن أن يكون المخزون سالباً");
    }

    return this.dataSource.transaction(async (em) => {
      const movement = em.create(InventoryMovement, {
        itemId: item.id,
        restaurantId: item.restaurantId,
        type: dto.type,
        quantity: delta,
        unitCost: dto.unitCost ?? null,
        note: dto.note ?? null,
        createdByUserId: userId,
      });
      await em.save(InventoryMovement, movement);

      // Bump the running on-hand and (for IN) refresh unit_cost on the item
      // so reports use the most recent purchase price.
      const patch: Partial<InventoryItem> = { currentQuantity: newQty };
      if (dto.type === MovementType.IN && dto.unitCost != null) {
        patch.unitCost = dto.unitCost;
      }
      await em.update(InventoryItem, item.id, patch);

      return movement;
    });
  }

  async listMovements(
    itemId: string | undefined,
    userId: string,
    role: string,
    limit = 100,
  ) {
    const restaurantId = await this.resolveOwnedRestaurant(userId, role);
    const where: any = { restaurantId };
    if (itemId) where.itemId = itemId;
    return this.movementRepo.find({
      where,
      order: { createdAt: "DESC" },
      take: Math.min(500, Math.max(1, limit)),
    });
  }

  // ─── Summary ─────────────────────────────────────────────────────────────

  async getSummary(userId: string, role: string) {
    const restaurantId = await this.resolveOwnedRestaurant(userId, role);

    const rows: Array<{
      total_items: string;
      active_items: string;
      low_stock_count: string;
      out_of_stock_count: string;
      stock_value: string;
    }> = await this.itemRepo.manager.query(
      `SELECT
         COUNT(*)                                                                  AS total_items,
         COUNT(*) FILTER (WHERE i.is_active = true)                                AS active_items,
         COUNT(*) FILTER (WHERE i.is_active = true
                             AND i.reorder_threshold > 0
                             AND i.current_quantity <= i.reorder_threshold)        AS low_stock_count,
         COUNT(*) FILTER (WHERE i.is_active = true AND i.current_quantity <= 0)    AS out_of_stock_count,
         COALESCE(SUM(i.current_quantity * i.unit_cost), 0)                        AS stock_value
       FROM inventory_items i
       WHERE i.restaurant_id = $1`,
      [restaurantId],
    );
    const r = rows[0];

    // Items currently at or below reorder threshold — for the alert list.
    const lowStock = await this.itemRepo
      .createQueryBuilder("i")
      .where("i.restaurantId = :rid", { rid: restaurantId })
      .andWhere("i.isActive = true")
      .andWhere("i.reorderThreshold > 0")
      .andWhere("i.currentQuantity <= i.reorderThreshold")
      .orderBy("i.currentQuantity", "ASC")
      .limit(20)
      .getMany();

    return {
      totals: {
        items: Number(r?.total_items ?? 0),
        active: Number(r?.active_items ?? 0),
        lowStock: Number(r?.low_stock_count ?? 0),
        outOfStock: Number(r?.out_of_stock_count ?? 0),
        stockValue: Number(r?.stock_value ?? 0),
      },
      lowStock,
    };
  }
}
