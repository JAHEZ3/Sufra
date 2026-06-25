import { Controller, Get } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { ApiGatewayService } from './api-gateway.service';
import { SocketGateway } from './gateway/socket.gateway';

@Controller()
export class ApiGatewayController {
  constructor(
    private readonly apiGatewayService: ApiGatewayService,
    private readonly socketGateway: SocketGateway,
  ) {}

  @Get()
  healthCheck() {
    return { status: 'ok', service: 'api-gateway' };
  }

  // ─── Order Events ────────────────────────────────────────────────────

  @EventPattern('order.created')
  async handleOrderCreated(@Payload() data: any) {
    // Cache order metadata for socket join authorization
    await this.socketGateway.cacheOrderMeta(data.orderId, {
      customerId: data.customerId,
      restaurantId: data.restaurantId,
      ownerUserId: data.ownerUserId,
    });

    // Notify restaurant room + all managers
    if (data.restaurantId) {
      this.socketGateway.emitToRoom(`restaurant:${data.restaurantId}`, 'order:new', data);
    }
    if (data.ownerUserId) {
      this.socketGateway.emitToUser(data.ownerUserId, 'order:new', data);
    }
    this.socketGateway.broadcastToManagers('order:new', data);
  }

  @EventPattern('order.status.changed')
  handleOrderStatusChanged(@Payload() data: any) {
    // Notify all parties in the order room
    this.socketGateway.emitToRoom(`order:${data.orderId}`, 'order:status', data);

    // Notify every staff session watching this restaurant (cashier/KDS) — they
    // join `restaurant:<id>` via restaurant:register, not the per-order room.
    if (data.restaurantId) {
      this.socketGateway.emitToRoom(`restaurant:${data.restaurantId}`, 'order:status', data);
    }

    // Also notify each party directly
    if (data.customerId) this.socketGateway.emitToUser(data.customerId, 'order:status', data);
    if (data.ownerUserId) this.socketGateway.emitToUser(data.ownerUserId, 'order:status', data);
    this.socketGateway.broadcastToManagers('order:status', data);
  }

  /**
   * Payment status flip (unpaid ↔ paid) fired by order-service when the
   * cashier/manager marks a local POS order as paid. Broadcasts to the order
   * room so the customer's screen + the restaurant's dashboard both refresh
   * without a manual reload. Also pushed directly to the customer + owner so
   * they get the update even if their socket isn't in the order room yet.
   */
  @EventPattern('order.payment.status.changed')
  handleOrderPaymentStatusChanged(@Payload() data: any) {
    this.socketGateway.emitToRoom(
      `order:${data.orderId}`,
      'order:payment:status',
      data,
    );
    if (data.customerId) {
      this.socketGateway.emitToUser(data.customerId, 'order:payment:status', data);
    }
    if (data.ownerUserId) {
      this.socketGateway.emitToUser(data.ownerUserId, 'order:payment:status', data);
    }
    this.socketGateway.broadcastToManagers('order:payment:status', data);
  }

  // ─── Chat Events ─────────────────────────────────────────────────────

  @EventPattern('chat.message.sent')
  handleChatMessage(@Payload() data: any) {
    this.socketGateway.emitToRoom(`order:${data.orderId}`, 'chat:message', data);
  }

  // ─── Notification Events ──────────────────────────────────────────────

  @EventPattern('notification.push')
  handlePushNotification(@Payload() data: { userId: string; event: string; payload: any }) {
    this.socketGateway.emitToUser(data.userId, data.event, data.payload);
  }
}
