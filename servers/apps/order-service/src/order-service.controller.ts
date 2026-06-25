import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EventPattern, Payload } from '@nestjs/microservices';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { CartService } from './cart/cart.service';
import { AddToCartDto, UpdateCartItemDto } from './cart/cart.dto';
import { OrderService } from './order/order.service';
import {
  CheckoutDto,
  UpdateOrderStatusDto,
  UpdatePaymentStatusDto,
  AssignDeliveryDto,
  RateOrderDto,
  OrderFilterDto,
} from './order/checkout.dto';
import { ChatService } from './chat/chat.service';
import { SendMessageDto } from './chat/chat.dto';
import { PromoService } from './promo/promo.service';
import { CreatePromoCodeDto, UpdatePromoCodeDto, ValidatePromoDto } from './promo/promo.dto';
import { ReceiptService } from './receipt/receipt.service';
import { PosService } from './pos/pos.service';
import { PrinterService } from './printer/printer.service';
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
} from './pos/pos.dto';

@Controller()
export class OrderServiceController {
  constructor(
    private readonly cartService: CartService,
    private readonly orderService: OrderService,
    private readonly chatService: ChatService,
    private readonly promoService: PromoService,
    private readonly receiptService: ReceiptService,
    private readonly posService: PosService,
    private readonly printerService: PrinterService,
  ) {}

  // ─────────────────────────────────────────────
  // CART (customer only)
  // ─────────────────────────────────────────────

  @Get('cart')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer')
  async getCart(@Req() req: any) {
    const cart = await this.cartService.get(req.user.sub);
    return { data: cart ?? { items: [], subtotal: 0 }, message: null };
  }

  @Post('cart/items')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer')
  async addToCart(@Req() req: any, @Body() dto: AddToCartDto) {
    const cart = await this.cartService.add(req.user.sub, dto);
    return { data: cart, message: 'تمت إضافة الوجبة إلى السلة' };
  }

  @Patch('cart/items/:mealId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer')
  async updateCartItem(
    @Req() req: any,
    @Param('mealId') mealId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    const cart = await this.cartService.update(req.user.sub, mealId, dto);
    return { data: cart, message: 'تم تحديث السلة' };
  }

  @Delete('cart/items/:mealId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer')
  async removeCartItem(@Req() req: any, @Param('mealId') mealId: string) {
    const cart = await this.cartService.removeItem(req.user.sub, mealId);
    return { data: cart, message: 'تم حذف الوجبة من السلة' };
  }

  @Delete('cart')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer')
  async clearCart(@Req() req: any) {
    await this.cartService.clear(req.user.sub);
    return { data: null, message: 'تم مسح السلة' };
  }

  // ─────────────────────────────────────────────
  // CHECKOUT
  // ─────────────────────────────────────────────

  @Post('checkout')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer')
  async checkout(
    @Req() req: any,
    @Body() dto: CheckoutDto,
    @Headers('idempotency-key') idempotencyHeader?: string,
  ) {
    // Validate that the header value is a UUID when present
    if (idempotencyHeader !== undefined) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(idempotencyHeader)) {
        throw new BadRequestException('Idempotency-Key يجب أن يكون UUID صالحاً');
      }
      dto.idempotencyKey = idempotencyHeader;
    }

    const user = req.user;
    const order = await this.orderService.checkout(
      user.sub,
      { name: user.fullName ?? user.sub, phone: user.phone ?? '', role: user.role },
      dto,
    );

    const isIdempotent = (order as any)._idempotent === true;
    return {
      data: order,
      message: isIdempotent ? 'تم إرجاع الطلب الموجود' : 'تم إنشاء الطلب بنجاح',
    };
  }

  // ─────────────────────────────────────────────
  // ORDERS
  // ─────────────────────────────────────────────

  @Get('orders')
  @UseGuards(JwtAuthGuard)
  async listOrders(@Req() req: any, @Query() dto: OrderFilterDto) {
    const result = await this.orderService.list(req.user.sub, req.user.role, dto);
    return { data: result, message: null };
  }

  /**
   * GET /api/order/orders/delivery/available
   * Driver dashboard — incoming assignments awaiting this agent's accept/reject
   * (deliveryAcceptance === pending). Declared BEFORE `orders/:id` so the
   * literal `delivery` segment isn't captured by the `:id` param.
   */
  @Get('orders/delivery/available')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('delivery')
  async listAvailableForAgent(@Req() req: any) {
    const data = await this.orderService.getAvailableForAgent(req.user.sub);
    return { data, message: null };
  }

  /**
   * GET /api/order/orders/delivery/active
   * Driver dashboard — the agent's current accepted, in-progress job (or null).
   */
  @Get('orders/delivery/active')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('delivery')
  async getActiveForAgent(@Req() req: any) {
    const data = await this.orderService.getActiveForAgent(req.user.sub);
    return { data, message: null };
  }

  @Get('orders/:id')
  @UseGuards(JwtAuthGuard)
  async getOrder(@Req() req: any, @Param('id') id: string) {
    const order = await this.orderService.findOne(id, req.user.sub, req.user.role);
    return { data: order, message: null };
  }

  @Patch('orders/:id/status')
  @UseGuards(JwtAuthGuard)
  async updateStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    const order = await this.orderService.updateStatus(id, req.user.sub, req.user.role, dto);
    return { data: order, message: 'تم تحديث حالة الطلب' };
  }

  /**
   * PATCH /api/order/orders/:id/payment-status
   *
   * Restaurant owner / manager flips `paymentStatus` after verifying the
   * customer's uploaded bank-transfer / wallet receipt. Body:
   *
   *   { "paymentStatus": "paid" | "unpaid", "note"?: "..." }
   *
   * For online orders, marking paid is rejected until the customer has
   * uploaded a payment proof. Marking back to `unpaid` is allowed regardless.
   */
  @Patch('orders/:id/payment-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('restaurant_owner', 'manager')
  async updatePaymentStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdatePaymentStatusDto,
  ) {
    const order = await this.orderService.updatePaymentStatus(
      id,
      req.user.sub,
      req.user.role,
      dto,
    );
    return { data: order, message: 'تم تحديث حالة الدفع' };
  }

  /**
   * PATCH /api/order/orders/:id/delivery
   *
   * Assign a delivery agent. Available to:
   *   - manager           — any order
   *   - restaurant_owner  — only their own orders
   *   - customer          — only their own order, only before a driver is
   *                         already set, only while early lifecycle (the
   *                         service enforces this so customers can't yank
   *                         a driver mid-delivery).
   */
  @Patch('orders/:id/delivery')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager', 'restaurant_owner', 'customer')
  async assignDelivery(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: AssignDeliveryDto,
  ) {
    const result = await this.orderService.assignDelivery(id, req.user.sub, req.user.role, dto);
    return { data: result, message: 'تم تعيين عامل التوصيل' };
  }

  /**
   * POST /api/order/orders/:id/delivery/accept
   * Delivery agent confirms they'll take the order. Only valid while
   * acceptance is PENDING (customer self-pick path); manager/owner-assigned
   * orders are already auto-accepted and this endpoint is a no-op.
   */
  @Post('orders/:id/delivery/accept')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('delivery')
  async acceptDelivery(@Req() req: any, @Param('id') id: string) {
    const result = await this.orderService.acceptDeliveryAssignment(
      id,
      req.user.sub,
    );
    return { data: result, message: 'تم قبول الطلب' };
  }

  /**
   * POST /api/order/orders/:id/delivery/reject
   * Delivery agent declines. Clears `deliveryAgentId` so the customer can
   * pick someone else. Optional `reason` (max 500 chars) ships in the
   * broadcast event for analytics but isn't persisted on the order.
   */
  @Post('orders/:id/delivery/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('delivery')
  async rejectDelivery(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    const result = await this.orderService.rejectDeliveryAssignment(
      id,
      req.user.sub,
      body?.reason,
    );
    return { data: result, message: 'تم رفض الطلب' };
  }

  @Post('orders/:id/rate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer')
  async rateOrder(@Req() req: any, @Param('id') id: string, @Body() dto: RateOrderDto) {
    const rating = await this.orderService.rate(id, req.user.sub, dto);
    return { data: rating, message: 'شكراً على تقييمك' };
  }

  @Get('orders/:id/receipt')
  @UseGuards(JwtAuthGuard)
  async getReceipt(@Req() req: any, @Param('id') id: string) {
    const order = await this.orderService.findOne(id, req.user.sub, req.user.role);
    if (!order.receiptKey) return { data: null, message: 'الإيصال لم يُنشأ بعد' };
    const url = await this.receiptService.getPresignedUrl(order.receiptKey);
    return { data: { url }, message: null };
  }

  @Post('orders/:id/payment-proof')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadPaymentProof(
    @Req() req: any,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const result = await this.orderService.uploadPaymentProof(
      id,
      req.user.sub,
      req.user.role,
      file,
    );
    return { data: result, message: 'تم رفع إيصال الدفع' };
  }

  @Get('orders/:id/payment-proof')
  @UseGuards(JwtAuthGuard)
  async getPaymentProof(@Req() req: any, @Param('id') id: string) {
    const order = await this.orderService.findOne(id, req.user.sub, req.user.role);
    if (!order.paymentProofKey) return { data: null, message: 'لم يتم رفع إيصال الدفع بعد' };
    const url = await this.receiptService.getPresignedUrl(order.paymentProofKey);
    return { data: { url }, message: null };
  }

  // ─────────────────────────────────────────────
  // CHAT
  // ─────────────────────────────────────────────

  @Get('orders/:id/chat')
  @UseGuards(JwtAuthGuard)
  async getChat(@Req() req: any, @Param('id') id: string) {
    const messages = await this.chatService.getMessages(id, req.user.sub, req.user.role);
    return { data: messages, message: null };
  }

  @Post('orders/:id/chat')
  @UseGuards(JwtAuthGuard)
  async sendMessage(@Req() req: any, @Param('id') id: string, @Body() body: { content: string }) {
    const user = req.user;
    const msg = await this.chatService.send(
      user.sub,
      { name: user.fullName ?? user.sub, role: user.role },
      { orderId: id, content: body.content },
    );
    return { data: msg, message: null };
  }

  // ─────────────────────────────────────────────
  // PROMO CODES
  // ─────────────────────────────────────────────

  @Post('promo/validate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer')
  async validatePromo(@Req() req: any, @Body() dto: ValidatePromoDto) {
    const result = await this.promoService.validate(
      dto.code,
      dto.orderAmount,
      req.user.sub,
      dto.restaurantId,
    );
    return { data: result, message: 'الكوبون صالح' };
  }

  @Get('manager/promo-codes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager')
  async listPromoCodes(@Query('restaurantId') restaurantId?: string) {
    const codes = await this.promoService.list(restaurantId);
    return { data: codes, message: null };
  }

  @Post('manager/promo-codes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager')
  async createPromoCode(@Body() dto: CreatePromoCodeDto) {
    const code = await this.promoService.create(dto);
    return { data: code, message: 'تم إنشاء كود الخصم' };
  }

  @Patch('manager/promo-codes/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager')
  async updatePromoCode(@Param('id') id: string, @Body() dto: UpdatePromoCodeDto) {
    const code = await this.promoService.update(id, dto);
    return { data: code, message: 'تم تحديث كود الخصم' };
  }

  @Delete('manager/promo-codes/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager')
  async deletePromoCode(@Param('id') id: string) {
    await this.promoService.remove(id);
    return { data: null, message: 'تم حذف كود الخصم' };
  }

  // ─── Restaurant-owner scoped (auto-resolves their restaurantId) ──────────

  @Get('restaurant/promo-codes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('restaurant_owner')
  async listOwnerPromoCodes(@Req() req: any) {
    const codes = await this.promoService.listForOwner(req.user.sub);
    return { data: codes, message: null };
  }

  @Post('restaurant/promo-codes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('restaurant_owner')
  async createOwnerPromoCode(@Req() req: any, @Body() dto: CreatePromoCodeDto) {
    const code = await this.promoService.createForOwner(req.user.sub, dto);
    return { data: code, message: 'تم إنشاء كود الخصم' };
  }

  @Patch('restaurant/promo-codes/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('restaurant_owner')
  async updateOwnerPromoCode(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdatePromoCodeDto,
  ) {
    const code = await this.promoService.updateForOwner(req.user.sub, id, dto);
    return { data: code, message: 'تم تحديث كود الخصم' };
  }

  @Delete('restaurant/promo-codes/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('restaurant_owner')
  async deleteOwnerPromoCode(@Req() req: any, @Param('id') id: string) {
    await this.promoService.removeForOwner(req.user.sub, id);
    return { data: null, message: 'تم حذف كود الخصم' };
  }

  // ─────────────────────────────────────────────
  // POS (restaurant_owner / manager only)
  // ─────────────────────────────────────────────

  @Post('pos/orders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('restaurant_owner', 'manager')
  async createPosOrder(@Req() req: any, @Body() dto: CreatePosOrderDto) {
    const order = await this.posService.create(req.user.sub, dto);
    return { data: order, message: 'تم فتح طلب جديد' };
  }

  // Public — no JwtAuthGuard. Customer scans the table QR and submits an
  // anonymous order. Restaurant + table are resolved from the qrToken.
  @Post('pos/scan-order')
  async createPosOrderFromQrScan(@Body() dto: ScanOrderDto) {
    const order = await this.posService.createFromQrScan(dto);
    return { data: order, message: 'تم إرسال الطلب للمطعم' };
  }

  // Public — the anonymous QR customer polls their order's live status.
  // Keyed by the order id returned at scan time. No guard.
  @Get('public/orders/:id/status')
  async publicOrderStatus(@Param('id') id: string) {
    const data = await this.posService.publicStatus(id);
    return { data, message: null };
  }

  // Public — the QR customer checks whether their table already has an open
  // bill (so the page shows it and lets them add more). No guard.
  @Get('public/tables/:qrToken/active-order')
  async publicActiveOrder(@Param('qrToken') qrToken: string) {
    const data = await this.posService.publicActiveOrderByQr(qrToken);
    return { data, message: null };
  }

  @Get('pos/orders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('restaurant_owner', 'manager')
  async listOpenPosOrders(@Req() req: any, @Query('restaurantId') restaurantId: string) {
    if (!restaurantId) throw new BadRequestException('restaurantId مطلوب');
    const data = await this.posService.listOpen(restaurantId, req.user.sub, req.user.role);
    return { data, message: null };
  }

  @Post('pos/orders/:id/items')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('restaurant_owner', 'manager')
  async addPosItem(@Req() req: any, @Param('id') id: string, @Body() dto: PosItemDto) {
    const order = await this.posService.addItem(id, req.user.sub, req.user.role, dto);
    return { data: order, message: 'تمت إضافة الصنف' };
  }

  @Patch('pos/orders/:id/items/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('restaurant_owner', 'manager')
  async updatePosItem(
    @Req() req: any,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdatePosItemDto,
  ) {
    const order = await this.posService.updateItem(id, itemId, req.user.sub, req.user.role, dto);
    return { data: order, message: 'تم تحديث الصنف' };
  }

  @Delete('pos/orders/:id/items/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('restaurant_owner', 'manager')
  async removePosItem(@Req() req: any, @Param('id') id: string, @Param('itemId') itemId: string) {
    const order = await this.posService.removeItem(id, itemId, req.user.sub, req.user.role);
    return { data: order, message: 'تم حذف الصنف' };
  }

  @Patch('pos/orders/:id/discount')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('restaurant_owner', 'manager')
  async setPosDiscount(@Req() req: any, @Param('id') id: string, @Body() dto: SetDiscountDto) {
    const order = await this.posService.setDiscount(id, req.user.sub, req.user.role, dto);
    return { data: order, message: 'تم تطبيق الخصم' };
  }

  @Post('pos/orders/:id/payments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('restaurant_owner', 'manager')
  async addPosPayment(@Req() req: any, @Param('id') id: string, @Body() dto: AddPaymentDto) {
    const order = await this.posService.addPayment(id, req.user.sub, req.user.role, dto);
    return { data: order, message: 'تم تسجيل الدفعة' };
  }

  @Post('pos/orders/:id/close')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('restaurant_owner', 'manager')
  async closePosOrder(@Req() req: any, @Param('id') id: string, @Body() dto: ClosePosOrderDto) {
    const order = await this.posService.close(id, req.user.sub, req.user.role, dto);
    return { data: order, message: 'تم إقفال الطلب' };
  }

  @Post('pos/orders/:id/accept')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('restaurant_owner', 'manager')
  async acceptPosOrder(@Req() req: any, @Param('id') id: string) {
    const order = await this.posService.acceptScanOrder(id, req.user.sub, req.user.role);
    return { data: order, message: 'تم قبول الطلب' };
  }

  @Post('pos/orders/:id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('restaurant_owner', 'manager')
  async rejectPosOrder(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    const order = await this.posService.rejectScanOrder(id, req.user.sub, req.user.role, body?.reason);
    return { data: order, message: 'تم رفض الطلب' };
  }

  @Post('pos/orders/:id/reopen')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('restaurant_owner', 'manager')
  async reopenPosOrder(@Req() req: any, @Param('id') id: string) {
    const order = await this.posService.reopen(id, req.user.sub, req.user.role);
    return { data: order, message: 'تم إعادة فتح الطلب' };
  }

  @Post('pos/orders/:id/finish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('restaurant_owner', 'manager')
  async finishPosOrder(@Req() req: any, @Param('id') id: string) {
    const order = await this.posService.finishEarly(id, req.user.sub, req.user.role);
    return { data: order, message: 'تم إنهاء الطلب' };
  }

  @Post('pos/orders/:id/void')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('restaurant_owner', 'manager')
  async voidPosOrder(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: VoidPosOrderDto,
  ) {
    const order = await this.posService.voidOrder(id, req.user.sub, req.user.role, dto);
    return { data: order, message: 'تم إلغاء الطلب' };
  }

  @Post('pos/orders/:id/print')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('restaurant_owner', 'manager')
  async printPosOrder(
    @Param('id') id: string,
    @Query('target') target?: 'kitchen' | 'cashier' | 'both',
  ) {
    const results = await this.printerService.printForOrder(id, target ?? 'both');
    return { data: results, message: 'تم إرسال الطلب للطباعة' };
  }

  @Patch('pos/orders/:id/payments/:splitId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('restaurant_owner', 'manager')
  async updatePosPayment(
    @Req() req: any,
    @Param('id') id: string,
    @Param('splitId') splitId: string,
    @Body() dto: UpdatePaymentSplitDto,
  ) {
    const order = await this.posService.updatePaymentSplit(
      id,
      splitId,
      req.user.sub,
      req.user.role,
      dto,
    );
    return { data: order, message: 'تم تحديث الدفعة' };
  }

  // ─────────────────────────────────────────────
  // NATS EVENT HANDLERS
  // ─────────────────────────────────────────────

  @EventPattern('order.archive.chat')
  async handleArchiveChat(@Payload() data: { orderId: string }) {
    await this.chatService.archiveByOrder(data.orderId);
  }
}
