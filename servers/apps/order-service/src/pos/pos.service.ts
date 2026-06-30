import {
  Injectable,
  Inject,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { LocalOrder } from '../entities/local-order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { OrderItemOption } from '../entities/order-item-option.entity';
import { OrderStatusHistory } from '../entities/order-status-history.entity';
import {
  LocalOrderStatus,
  LocalServiceType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../entities/order-enums';
import {
  JOBS,
  POS_FINALIZE_QUEUE,
  PREPARING_AUTO_DONE_MS,
} from '../queue/queue.constants';
import {
  AddPaymentDto,
  ClosePosOrderDto,
  CreatePosOrderDto,
  PosItemDto,
  ScanOrderDto,
  SetDiscountDto,
  UpdatePaymentSplitDto,
  UpdatePosItemDto,
  VoidPosOrderDto,
} from './pos.dto';
import { PrinterService } from '../printer/printer.service';

@Injectable()
export class PosService {
  constructor(
    @InjectRepository(LocalOrder) private readonly orderRepo: Repository<LocalOrder>,
    @InjectRepository(OrderItem) private readonly itemRepo: Repository<OrderItem>,
    @InjectRepository(OrderItemOption) private readonly optionRepo: Repository<OrderItemOption>,
    private readonly dataSource: DataSource,
    @InjectQueue(POS_FINALIZE_QUEUE) private readonly finalizeQueue: Queue,
    private readonly printerService: PrinterService,
    @Inject('NATS_SERVICE') private readonly natsClient: ClientProxy,
  ) {}

  // ─── Realtime: notify api-gateway (→ dashboard sockets) ────────────────────
  // Best-effort: a NATS hiccup must never fail the order operation itself.
  private emitCreated(o: LocalOrder) {
    try {
      this.natsClient.emit('order.created', {
        orderId: o.id, orderNumber: o.orderNumber,
        restaurantId: o.restaurantId, ownerUserId: o.ownerUserId,
        customerId: o.customerId ?? null,
        table: o.tableNumber ?? null, total: Number(o.totalAmount),
        status: o.localStatus, kind: 'local',
      });
    } catch { /* realtime is best-effort */ }
  }
  private emitStatus(o: LocalOrder, status: string) {
    try {
      this.natsClient.emit('order.status.changed', {
        orderId: o.id, orderNumber: o.orderNumber,
        restaurantId: o.restaurantId, ownerUserId: o.ownerUserId,
        customerId: o.customerId ?? null,
        table: o.tableNumber ?? null, status, kind: 'local',
      });
    } catch { /* realtime is best-effort */ }
  }

  // ─── Create open POS order ────────────────────────────────────────────────

  async create(userId: string, dto: CreatePosOrderDto): Promise<LocalOrder> {
    if (dto.serviceType === LocalServiceType.DINE_IN && !dto.tableNumber) {
      throw new BadRequestException('رقم الطاولة مطلوب لطلبات الصالة');
    }
    if (!dto.items?.length) throw new BadRequestException('يجب إضافة وجبة واحدة على الأقل');

    // Resolve owner from the restaurants table to keep dashboard scoping consistent
    const ownerRow = await this.dataSource.query(
      'SELECT owner_user_id FROM restaurants WHERE id = $1',
      [dto.restaurantId],
    );
    const ownerUserId = ownerRow?.[0]?.owner_user_id ?? null;

    const orderNumber = `POS${Date.now().toString(36).toUpperCase()}${randomUUID()
      .replace(/-/g, '')
      .slice(0, 4)
      .toUpperCase()}`;

    const order = await this.dataSource.transaction(async (em) => {
      const subtotal = this.computeSubtotal(dto.items);
      const newOrder = em.create(LocalOrder, {
        orderNumber,
        customerId: null, // walk-in: no registered customer
        cashierUserId: userId,
        restaurantId: dto.restaurantId,
        ownerUserId,
        restaurantNameSnapshot: dto.restaurantName,
        customerNameSnapshot: dto.customerName ?? null,
        customerPhoneSnapshot: dto.customerPhone ?? null,
        subtotal,
        discountAmount: 0,
        totalAmount: subtotal,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY, // placeholder until close
        paymentStatus: PaymentStatus.UNPAID,
        serviceType: dto.serviceType,
        tableNumber: dto.tableNumber ?? null,
        tableId: dto.tableId ?? null,
        // New POS orders go straight to PREPARING — kitchen starts immediately
        // and the 15-min auto-DONE timer begins. Items / discount / payment
        // remain editable during PREPARING; "إقفال الفاتورة" flips to DONE.
        localStatus: LocalOrderStatus.PREPARING,
        preparingStartedAt: new Date(),
        paymentSplits: [],
      });
      const saved = await em.save(LocalOrder, newOrder);

      for (const it of dto.items) {
        await this.persistItem(em, saved.id, it);
      }

      await em.save(OrderStatusHistory, em.create(OrderStatusHistory, {
        orderId: saved.id,
        status: OrderStatus.PREPARING, // history uses the shared enum
        changedByUserId: userId,
        note: `POS ${dto.serviceType} opened in PREPARING`,
      }));

      return saved;
    });

    // Auto-finalize PREPARING → DONE after the 15-min timer. Cancelled when
    // staff manually closes the bill.
    await this.finalizeQueue
      .add(
        JOBS.POS_FINALIZE,
        { orderId: order.id },
        { delay: PREPARING_AUTO_DONE_MS, jobId: `pos-finalize-${order.id}` },
      )
      .catch(() => undefined);

    // POS orders intentionally skip the NATS push-notification path — staff
    // are physically present at the counter; we do not want the customer
    // dashboards, manager broadcasts, or notification-service to fire.

    return this.findOneFull(order.id);
  }

  // ─── Anonymous customer order via QR scan ────────────────────────────────

  async createFromQrScan(dto: ScanOrderDto): Promise<LocalOrder> {
    if (!dto.items?.length) {
      throw new BadRequestException('يجب إضافة وجبة واحدة على الأقل');
    }

    // Cross-service lookup via raw SQL — same pattern create() uses for the
    // restaurants table. Avoids dragging the RestaurantTable entity into
    // order-service.
    const tableRows = await this.dataSource.query(
      `SELECT t.id        AS table_id,
              t.number    AS table_number,
              t.is_active AS table_is_active,
              t.restaurant_id,
              r.name      AS restaurant_name,
              r.owner_user_id
         FROM restaurant_tables t
         JOIN restaurants r ON r.id = t.restaurant_id
        WHERE t.qr_token = $1
        LIMIT 1`,
      [dto.qrToken],
    );
    const row = tableRows?.[0];
    if (!row || row.table_is_active === false) {
      throw new NotFoundException('الطاولة غير متاحة');
    }

    // If the table already has an active bill (PENDING/OPEN/PREPARING) the
    // customer is *adding* to it — append the new items to the existing order
    // instead of starting a second bill the cashier could miss. Customers can
    // only add; already-sent items stay on the bill (no public remove).
    const active = await this.orderRepo.findOne({
      where: [
        { tableId: row.table_id, localStatus: LocalOrderStatus.PENDING },
        { tableId: row.table_id, localStatus: LocalOrderStatus.OPEN },
        { tableId: row.table_id, localStatus: LocalOrderStatus.PREPARING },
      ],
    });
    if (active) {
      return this.appendQrItems(active, dto.items, row.table_number);
    }

    const orderNumber = `QR${Date.now().toString(36).toUpperCase()}${randomUUID()
      .replace(/-/g, '')
      .slice(0, 4)
      .toUpperCase()}`;

    const order = await this.dataSource.transaction(async (em) => {
      const subtotal = this.computeSubtotal(dto.items);
      const newOrder = em.create(LocalOrder, {
        orderNumber,
        customerId: null,
        cashierUserId: null, // QR scan: no logged-in staff at create time
        restaurantId: row.restaurant_id,
        ownerUserId: row.owner_user_id,
        restaurantNameSnapshot: row.restaurant_name,
        customerNameSnapshot: dto.customerName ?? null,
        customerPhoneSnapshot: dto.customerPhone ?? null,
        subtotal,
        discountAmount: 0,
        totalAmount: subtotal,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
        paymentStatus: PaymentStatus.UNPAID,
        serviceType: LocalServiceType.DINE_IN,
        tableNumber: row.table_number,
        tableId: row.table_id,
        // QR submissions land in PENDING — staff must accept (or reject)
        // before the kitchen starts preparing. No timer or print yet.
        localStatus: LocalOrderStatus.PENDING,
        preparingStartedAt: null,
        paymentSplits: [],
      });
      const saved = await em.save(LocalOrder, newOrder);
      for (const it of dto.items) {
        await this.persistItem(em, saved.id, it);
      }
      await em.save(
        OrderStatusHistory,
        em.create(OrderStatusHistory, {
          orderId: saved.id,
          status: OrderStatus.PENDING,
          changedByUserId: null,
          note: `POS bill submitted via QR scan, awaiting staff accept (table ${row.table_number})`,
        }),
      );
      return saved;
    });

    this.emitCreated(order); // ring the restaurant dashboard / KDS
    return this.findOneFull(order.id) as Promise<LocalOrder>;
  }

  // ─── Public: anonymous QR customer polls their order's live status ─────────
  // Keyed by the order id (an unguessable UUID handed back at scan time), so no
  // auth is needed. Returns only the minimal status — never items or totals.
  async publicStatus(
    id: string,
  ): Promise<{ id: string; orderNumber: string; status: LocalOrderStatus }> {
    const order = await this.orderRepo.findOne({
      where: { id },
      select: { id: true, orderNumber: true, localStatus: true },
    });
    if (!order) throw new NotFoundException('الطلب غير موجود');
    return { id: order.id, orderNumber: order.orderNumber, status: order.localStatus };
  }

  // ─── Public: the table's current open order (so the QR customer can see it) ─
  // Returns the active bill on the table (or null) with its already-sent items
  // — read-only. The customer can add more but never remove these lines.
  async publicActiveOrderByQr(qrToken: string): Promise<{
    id: string;
    orderNumber: string;
    status: LocalOrderStatus;
    subtotal: number;
    totalAmount: number;
    items: { name: string; quantity: number; totalPrice: number }[];
  } | null> {
    const rows = await this.dataSource.query(
      `SELECT id FROM restaurant_tables WHERE qr_token = $1 LIMIT 1`,
      [qrToken],
    );
    const tableId = rows?.[0]?.id;
    if (!tableId) return null;

    const order = await this.orderRepo.findOne({
      where: [
        { tableId, localStatus: LocalOrderStatus.PENDING },
        { tableId, localStatus: LocalOrderStatus.OPEN },
        { tableId, localStatus: LocalOrderStatus.PREPARING },
      ],
    });
    if (!order) return null;

    const items = await this.itemRepo.find({ where: { orderId: order.id } });
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.localStatus,
      subtotal: Number(order.subtotal),
      totalAmount: Number(order.totalAmount),
      items: items.map((i) => ({
        name: i.mealNameSnapshot,
        quantity: i.quantity,
        totalPrice: Number(i.totalPrice),
      })),
    };
  }

  // Append QR-submitted items to an existing active bill on the same table.
  private async appendQrItems(
    order: LocalOrder,
    items: ScanOrderDto['items'],
    tableNumber: string,
  ): Promise<LocalOrder> {
    await this.dataSource.transaction(async (em) => {
      for (const it of items) {
        await this.persistItem(em, order.id, it);
      }
      await this.recompute(em, order.id);
      const histStatus =
        order.localStatus === LocalOrderStatus.PREPARING
          ? OrderStatus.PREPARING
          : OrderStatus.PENDING;
      await em.save(
        OrderStatusHistory,
        em.create(OrderStatusHistory, {
          orderId: order.id,
          status: histStatus,
          changedByUserId: null,
          note: `Customer added ${items.length} item(s) via QR scan (table ${tableNumber})`,
        }),
      );
    });

    const full = (await this.findOneFull(order.id)) as LocalOrder;
    // Ring the kitchen/dashboard so staff see the newly added items.
    this.emitCreated(full);
    return full;
  }

  // ─── Items ───────────────────────────────────────────────────────────────

  async addItem(orderId: string, userId: string, role: string, dto: PosItemDto) {
    const order = await this.requireOpen(orderId, userId, role);
    await this.dataSource.transaction(async (em) => {
      await this.persistItem(em, order.id, dto);
      await this.recompute(em, order.id);
    });
    return this.findOneFull(orderId);
  }

  async updateItem(orderId: string, itemId: string, userId: string, role: string, dto: UpdatePosItemDto) {
    const order = await this.requireOpen(orderId, userId, role);
    const item = await this.itemRepo.findOne({ where: { id: itemId, orderId: order.id } });
    if (!item) throw new NotFoundException('الصنف غير موجود');

    if (typeof dto.quantity === 'number') {
      if (dto.quantity === 0) {
        await this.itemRepo.delete(itemId);
      } else {
        const optionsTotal = await this.itemOptionsTotal(itemId);
        const newTotal = (Number(item.unitPriceSnapshot) + optionsTotal) * dto.quantity;
        await this.itemRepo.update(itemId, {
          quantity: dto.quantity,
          totalPrice: newTotal,
          specialInstructions: dto.specialInstructions ?? item.specialInstructions,
        });
      }
    } else if (dto.specialInstructions !== undefined) {
      await this.itemRepo.update(itemId, { specialInstructions: dto.specialInstructions });
    }

    await this.recompute(this.dataSource.manager, order.id);
    return this.findOneFull(orderId);
  }

  async removeItem(orderId: string, itemId: string, userId: string, role: string) {
    const order = await this.requireOpen(orderId, userId, role);
    const item = await this.itemRepo.findOne({ where: { id: itemId, orderId: order.id } });
    if (!item) throw new NotFoundException('الصنف غير موجود');
    await this.itemRepo.delete(itemId);
    await this.recompute(this.dataSource.manager, order.id);
    return this.findOneFull(orderId);
  }

  // ─── Discount + split payments ───────────────────────────────────────────

  async setDiscount(orderId: string, userId: string, role: string, dto: SetDiscountDto) {
    const order = await this.requireOpen(orderId, userId, role);
    const subtotal = Number(order.subtotal);
    if (dto.discountAmount > subtotal)
      throw new BadRequestException('الخصم أكبر من المجموع');
    await this.orderRepo.update(order.id, {
      discountAmount: dto.discountAmount,
      totalAmount: Math.max(0, subtotal - dto.discountAmount),
    });
    return this.findOneFull(orderId);
  }

  async addPayment(orderId: string, userId: string, role: string, dto: AddPaymentDto) {
    const order = await this.requireOpen(orderId, userId, role);
    const splits = order.paymentSplits ?? [];
    const paid = splits.reduce((s, p) => s + Number(p.amount), 0);
    const total = Number(order.totalAmount);
    if (paid + dto.amount > total + 0.001)
      throw new BadRequestException('المبلغ المدفوع أكبر من الإجمالي');
    splits.push({
      id: randomUUID(),
      amount: dto.amount,
      method: dto.method,
      paidAt: dto.paidAt ?? new Date().toISOString(),
      reference: dto.reference,
      payerName: dto.payerName,
    });
    await this.orderRepo.update(order.id, { paymentSplits: splits });
    return this.findOneFull(orderId);
  }

  async updatePaymentSplit(
    orderId: string,
    splitId: string,
    userId: string,
    role: string,
    dto: UpdatePaymentSplitDto,
  ) {
    // Edits to recorded payment metadata are allowed in OPEN *and* PREPARING:
    // staff often need to add the transaction ref after the bill is closed.
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('الطلب غير موجود');
    this.assertAllowedActor(order, userId, role);
    if (
      order.localStatus !== LocalOrderStatus.OPEN &&
      order.localStatus !== LocalOrderStatus.PREPARING
    ) {
      throw new BadRequestException('لا يمكن تعديل الدفعات في هذه الحالة');
    }

    const splits = order.paymentSplits ?? [];
    const idx = splits.findIndex((s) => s.id === splitId);
    if (idx === -1) throw new NotFoundException('الدفعة غير موجودة');

    splits[idx] = {
      ...splits[idx],
      reference: dto.reference ?? splits[idx].reference,
      payerName: dto.payerName ?? splits[idx].payerName,
      paidAt: dto.paidAt ?? splits[idx].paidAt,
    };
    await this.orderRepo.update(order.id, { paymentSplits: splits });
    return this.findOneFull(orderId);
  }

  // ─── Close (finalize) order ──────────────────────────────────────────────

  async close(orderId: string, userId: string, role: string, dto: ClosePosOrderDto) {
    const order = await this.requireOpen(orderId, userId, role);

    if (typeof dto.discountAmount === 'number') {
      await this.setDiscount(orderId, userId, role, { discountAmount: dto.discountAmount });
    }
    const fresh = await this.orderRepo.findOne({ where: { id: order.id } });
    if (!fresh) throw new NotFoundException('الطلب غير موجود');

    const splits = fresh.paymentSplits ?? [];
    const paid = splits.reduce((s, p) => s + Number(p.amount), 0);
    const total = Number(fresh.totalAmount);

    if (paid < total - 0.001) {
      if (!dto.paymentMethod) {
        throw new BadRequestException(
          'لم يتم تسجيل دفعات كافية. حدد paymentMethod لإقفال الطلب أو سجل دفعات منفصلة',
        );
      }
      splits.push({
        id: randomUUID(),
        amount: total - paid,
        method: dto.paymentMethod,
        paidAt: dto.paidAt ?? new Date().toISOString(),
        reference: dto.reference,
        payerName: dto.payerName,
      });
    }

    // Primary method = the method of the largest split (best-guess for the legacy single-method field)
    const primary = splits.reduce(
      (max, p) => (Number(p.amount) > Number(max.amount) ? p : max),
      splits[0] ?? { method: PaymentMethod.CASH_ON_DELIVERY, amount: 0 },
    );

    // Bill closed → DONE directly. PREPARING is the *live* state (kitchen
    // is already preparing); closing means payment is collected and the bill
    // is finalized. Cancel the pending auto-DONE timer so it doesn't try to
    // re-flip an already-DONE order.
    await this.finalizeQueue.remove(`pos-finalize-${order.id}`).catch(() => undefined);

    await this.orderRepo.update(order.id, {
      localStatus: LocalOrderStatus.DONE,
      paymentSplits: splits,
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: primary.method as PaymentMethod,
      isLocked: true,
    });

    await this.dataSource.getRepository(OrderStatusHistory).save(
      this.dataSource.getRepository(OrderStatusHistory).create({
        orderId: order.id,
        status: OrderStatus.DELIVERED,
        changedByUserId: userId,
        note: 'POS bill closed (DONE)',
      }),
    );

    // Bill is paid → consume each meal's recipe ingredients from inventory.
    await this.applyInventory(order.id, order.restaurantId, order.orderNumber, 'deduct', userId);

    // Fire kitchen + cashier prints in the background. Failures are logged
    // but never bubble up — a printer outage shouldn't fail bill-close.
    this.printerService.printForOrderSafe(order.id, 'both');

    // Push the final status to the QR customer's live tracker.
    this.emitStatus(order, LocalOrderStatus.DONE);

    return this.findOneFull(orderId);
  }

  // ─── Re-open a DONE bill so staff can correct items or refund ────────────
  // Brings it back to PREPARING (the editable state) and restarts the timer.

  async reopen(orderId: string, userId: string, role: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('الطلب غير موجود');
    if (order.localStatus !== LocalOrderStatus.DONE) {
      throw new BadRequestException('لا يمكن إعادة فتح الطلب في هذه الحالة');
    }
    this.assertAllowedActor(order, userId, role);

    await this.orderRepo.update(order.id, {
      localStatus: LocalOrderStatus.PREPARING,
      isLocked: false,
      paymentStatus: PaymentStatus.UNPAID,
      preparingStartedAt: new Date(),
    });

    // Re-opening an already-paid bill returns its ingredients to stock; the
    // next close deducts them again (guarded by inventory_applied).
    await this.applyInventory(order.id, order.restaurantId, order.orderNumber, 'restock', userId);

    // Fresh 15-minute timer once the bill is editable again.
    await this.finalizeQueue
      .add(
        JOBS.POS_FINALIZE,
        { orderId: order.id },
        { delay: PREPARING_AUTO_DONE_MS, jobId: `pos-finalize-${order.id}` },
      )
      .catch(() => undefined);

    await this.dataSource.getRepository(OrderStatusHistory).save(
      this.dataSource.getRepository(OrderStatusHistory).create({
        orderId: order.id,
        status: OrderStatus.PREPARING,
        changedByUserId: userId,
        note: 'POS bill re-opened from DONE',
      }),
    );

    return this.findOneFull(orderId);
  }

  // ─── Accept / reject a PENDING QR-scan order ──────────────────────────────

  async acceptScanOrder(orderId: string, userId: string, role: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('الطلب غير موجود');
    if (order.localStatus !== LocalOrderStatus.PENDING) {
      throw new BadRequestException('الطلب ليس في حالة انتظار القبول');
    }
    this.assertAllowedActor(order, userId, role);

    await this.orderRepo.update(order.id, {
      localStatus: LocalOrderStatus.PREPARING,
      preparingStartedAt: new Date(),
      cashierUserId: order.cashierUserId ?? userId, // first staff to accept becomes the cashier
    });

    // Visual 15-min countdown timer (the processor no longer auto-finalizes).
    await this.finalizeQueue
      .add(
        JOBS.POS_FINALIZE,
        { orderId: order.id },
        { delay: PREPARING_AUTO_DONE_MS, jobId: `pos-finalize-${order.id}` },
      )
      .catch(() => undefined);

    await this.dataSource.getRepository(OrderStatusHistory).save(
      this.dataSource.getRepository(OrderStatusHistory).create({
        orderId: order.id,
        status: OrderStatus.PREPARING,
        changedByUserId: userId,
        note: 'POS pending bill accepted; kitchen started',
      }),
    );

    // Kitchen ticket fires now — accept is the gate, not submit.
    this.printerService.printForOrderSafe(order.id, 'kitchen');

    this.emitStatus(order, LocalOrderStatus.PREPARING);
    return this.findOneFull(orderId);
  }

  async rejectScanOrder(orderId: string, userId: string, role: string, reason?: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('الطلب غير موجود');
    if (order.localStatus !== LocalOrderStatus.PENDING) {
      throw new BadRequestException('الطلب ليس في حالة انتظار القبول');
    }
    this.assertAllowedActor(order, userId, role);

    await this.orderRepo.update(order.id, {
      localStatus: LocalOrderStatus.VOIDED,
      isLocked: true,
    });

    await this.dataSource.getRepository(OrderStatusHistory).save(
      this.dataSource.getRepository(OrderStatusHistory).create({
        orderId: order.id,
        status: OrderStatus.CANCELLED,
        changedByUserId: userId,
        note: reason ? `POS pending bill rejected: ${reason}` : 'POS pending bill rejected',
      }),
    );

    this.emitStatus(order, LocalOrderStatus.VOIDED);
    return this.findOneFull(orderId);
  }

  // ─── Finish a PREPARING bill early (skip the 15-min countdown) ───────────

  async finishEarly(orderId: string, userId: string, role: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('الطلب غير موجود');
    if (order.localStatus !== LocalOrderStatus.PREPARING) {
      throw new BadRequestException('لا يمكن إنهاء الطلب في هذه الحالة');
    }
    this.assertAllowedActor(order, userId, role);

    await this.finalizeQueue.remove(`pos-finalize-${order.id}`).catch(() => undefined);
    await this.orderRepo.update(order.id, { localStatus: LocalOrderStatus.DONE });

    // Finishing early also closes the bill → deduct recipe ingredients.
    await this.applyInventory(order.id, order.restaurantId, order.orderNumber, 'deduct', userId);

    await this.dataSource.getRepository(OrderStatusHistory).save(
      this.dataSource.getRepository(OrderStatusHistory).create({
        orderId: order.id,
        status: OrderStatus.DELIVERED,
        changedByUserId: userId,
        note: 'POS bill finished early',
      }),
    );

    this.emitStatus(order, LocalOrderStatus.DONE);
    return this.findOneFull(orderId);
  }

  // ─── Void an OPEN or PREPARING bill ──────────────────────────────────────

  async voidOrder(orderId: string, userId: string, role: string, dto: VoidPosOrderDto) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('الطلب غير موجود');
    if (
      order.localStatus !== LocalOrderStatus.OPEN &&
      order.localStatus !== LocalOrderStatus.PREPARING
    ) {
      throw new BadRequestException('لا يمكن إلغاء الطلب في هذه الحالة');
    }
    this.assertAllowedActor(order, userId, role);

    if (order.localStatus === LocalOrderStatus.PREPARING) {
      await this.finalizeQueue.remove(`pos-finalize-${order.id}`).catch(() => undefined);
    }
    await this.orderRepo.update(order.id, {
      localStatus: LocalOrderStatus.VOIDED,
      isLocked: true,
    });

    await this.dataSource.getRepository(OrderStatusHistory).save(
      this.dataSource.getRepository(OrderStatusHistory).create({
        orderId: order.id,
        status: OrderStatus.CANCELLED,
        changedByUserId: userId,
        note: dto.reason ? `POS voided: ${dto.reason}` : 'POS voided',
      }),
    );

    return this.findOneFull(orderId);
  }

  // ─── Listing ─────────────────────────────────────────────────────────────

  async listOpen(restaurantId: string, userId: string, role: string) {
    if (role !== 'manager' && role !== 'restaurant_owner') {
      throw new ForbiddenException('غير مصرح');
    }
    // Include PENDING (awaiting staff accept), OPEN (legacy editable), and
    // PREPARING (live kitchen). DONE and VOIDED are terminal — not shown.
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'items')
      .where('o.restaurantId = :rid AND o.localStatus IN (:...states)', {
        rid: restaurantId,
        states: [
          LocalOrderStatus.PENDING,
          LocalOrderStatus.OPEN,
          LocalOrderStatus.PREPARING,
        ],
      })
      .orderBy('o.createdAt', 'DESC');
    if (role === 'restaurant_owner') qb.andWhere('o.ownerUserId = :uid', { uid: userId });
    return qb.getMany();
  }

  // ─── Internals ───────────────────────────────────────────────────────────

  // Editable states: OPEN (legacy bills created before PREPARING-on-create)
  // and PREPARING (the new live state). DONE and VOIDED are terminal.
  private async requireOpen(orderId: string, userId: string, role: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('الطلب غير موجود');
    if (
      order.localStatus !== LocalOrderStatus.OPEN &&
      order.localStatus !== LocalOrderStatus.PREPARING
    ) {
      throw new BadRequestException('الطلب مغلق ولا يمكن تعديله');
    }
    this.assertAllowedActor(order, userId, role);
    return order;
  }

  // manager (any), restaurant_owner-of-order, or the original cashier
  private assertAllowedActor(order: LocalOrder, userId: string, role: string) {
    const allowed =
      role === 'manager' ||
      (role === 'restaurant_owner' && order.ownerUserId === userId) ||
      order.cashierUserId === userId;
    if (!allowed) throw new ForbiddenException('غير مصرح');
  }

  private async findOneFull(orderId: string) {
    return this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['items', 'items.options'],
    });
  }

  private async persistItem(em: any, orderId: string, dto: PosItemDto) {
    const optsTotal = (dto.options ?? []).reduce((s, o) => s + Number(o.extraPrice), 0);
    const unit = Number(dto.basePrice);
    const total = (unit + optsTotal) * dto.quantity;
    const savedItem = await em.save(
      OrderItem,
      em.create(OrderItem, {
        orderId,
        mealId: dto.mealId,
        mealNameSnapshot: dto.mealName,
        unitPriceSnapshot: unit,
        quantity: dto.quantity,
        totalPrice: total,
        specialInstructions: dto.specialInstructions ?? null,
      }),
    );
    for (const opt of dto.options ?? []) {
      await em.save(
        OrderItemOption,
        em.create(OrderItemOption, {
          orderItemId: savedItem.id,
          optionId: opt.optionId,
          optionNameSnapshot: opt.optionName,
          extraPriceSnapshot: opt.extraPrice,
        }),
      );
    }
  }

  private async recompute(em: any, orderId: string) {
    const items = await em.find(OrderItem, { where: { orderId } });
    const subtotal = items.reduce((s: number, i: OrderItem) => s + Number(i.totalPrice), 0);
    const order = await em.findOne(LocalOrder, { where: { id: orderId } });
    const discount = Number(order?.discountAmount ?? 0);
    await em.update(LocalOrder, orderId, {
      subtotal,
      totalAmount: Math.max(0, subtotal - discount),
    });
  }

  private async itemOptionsTotal(itemId: string): Promise<number> {
    const opts = await this.optionRepo.find({ where: { orderItemId: itemId } });
    return opts.reduce((s, o) => s + Number(o.extraPriceSnapshot), 0);
  }

  private computeSubtotal(items: PosItemDto[]): number {
    return items.reduce((s, i) => {
      const opts = (i.options ?? []).reduce((a, o) => a + Number(o.extraPrice), 0);
      return s + (Number(i.basePrice) + opts) * i.quantity;
    }, 0);
  }

  // ─── Inventory sync (recipe-based stock deduction) ────────────────────────
  //
  // Inventory lives in restaurant-service but shares this database, so we
  // touch its tables directly via raw SQL — the same cross-service pattern
  // create()/createFromQrScan() use for `restaurants` / `restaurant_tables`.
  //
  // `deduct`  → bill paid: subtract each meal's recipe ingredients (OUT).
  // `restock` → bill re-opened: add them back (IN).
  //
  // Idempotent via orders.inventory_applied, guarded by a row lock so a
  // double-close or concurrent timer can't deduct twice. Best-effort: a
  // failure here is logged but never bubbles up to fail the POS operation —
  // the flag stays unset on rollback so a later close/reopen retries cleanly.
  // Stock is allowed to go negative (a shortage shows as an alert) rather than
  // ever blocking a cashier from closing a paid bill.
  private async applyInventory(
    orderId: string,
    restaurantId: string,
    orderNumber: string,
    direction: 'deduct' | 'restock',
    userId: string | null,
  ): Promise<void> {
    try {
      await this.dataSource.transaction(async (em) => {
        const lock: Array<{ inventory_applied: boolean }> = await em.query(
          'SELECT inventory_applied FROM orders WHERE id = $1 FOR UPDATE',
          [orderId],
        );
        if (!lock.length) return;
        const applied = lock[0].inventory_applied === true;
        if (direction === 'deduct' && applied) return; // already deducted
        if (direction === 'restock' && !applied) return; // nothing to return

        // Sum each ingredient across all line items: recipe-per-unit × sold qty.
        const usage: Array<{ inventory_item_id: string; total: string }> =
          await em.query(
            `SELECT mi.inventory_item_id AS inventory_item_id,
                    SUM(mi.quantity * oi.quantity) AS total
               FROM order_items oi
               JOIN meal_ingredients mi ON mi.meal_id = oi.meal_id
              WHERE oi.order_id = $1
              GROUP BY mi.inventory_item_id`,
            [orderId],
          );

        const sign = direction === 'deduct' ? -1 : 1;
        const movementType = direction === 'deduct' ? 'out' : 'in';
        const note =
          direction === 'deduct'
            ? `POS sale ${orderNumber}`
            : `POS reversal ${orderNumber}`;

        for (const u of usage) {
          const amount = Number(u.total);
          if (!Number.isFinite(amount) || amount === 0) continue;
          const delta = sign * Math.abs(amount);
          await em.query(
            `INSERT INTO inventory_movements
               (id, item_id, restaurant_id, type, quantity, unit_cost, note, created_by_user_id, created_at)
             VALUES ($1, $2, $3, $4::inventory_movement_type, $5, NULL, $6, $7, NOW())`,
            [randomUUID(), u.inventory_item_id, restaurantId, movementType, delta, note, userId],
          );
          await em.query(
            `UPDATE inventory_items
                SET current_quantity = current_quantity + $1, updated_at = NOW()
              WHERE id = $2`,
            [delta, u.inventory_item_id],
          );
        }

        await em.query('UPDATE orders SET inventory_applied = $1 WHERE id = $2', [
          direction === 'deduct',
          orderId,
        ]);
      });
    } catch {
      // Inventory sync is best-effort — never fail the bill operation over it.
    }
  }

}
