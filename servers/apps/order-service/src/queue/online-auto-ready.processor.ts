import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { Job } from 'bullmq';
import { randomUUID } from 'crypto';
import { ONLINE_AUTO_READY_QUEUE } from './queue.constants';
import { OnlineOrder } from '../entities/online-order.entity';
import { OrderStatusHistory } from '../entities/order-status-history.entity';
import { OrderStatus } from '../entities/order-enums';

interface AutoReadyJobData {
  orderId: string;
}

/**
 * After ONLINE_PREPARING_AUTO_READY_MS, an online order in PREPARING is
 * auto-flipped to READY_FOR_PICKUP and the customer is notified via the
 * existing NATS event (notification-service consumes order.status.changed).
 * Skipped if the order has already moved away from PREPARING.
 */
@Processor(ONLINE_AUTO_READY_QUEUE)
export class OnlineAutoReadyProcessor extends WorkerHost {
  private readonly logger = new Logger(OnlineAutoReadyProcessor.name);

  constructor(
    @InjectRepository(OnlineOrder) private readonly orderRepo: Repository<OnlineOrder>,
    @InjectRepository(OrderStatusHistory) private readonly historyRepo: Repository<OrderStatusHistory>,
    @Inject('NATS_SERVICE') private readonly nats: ClientProxy,
  ) {
    super();
  }

  async process(job: Job<AutoReadyJobData>): Promise<void> {
    const { orderId } = job.data;
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      this.logger.warn({ msg: 'online_auto_ready_skipped_missing', orderId });
      return;
    }
    if (order.status !== OrderStatus.PREPARING) {
      this.logger.log({
        msg: 'online_auto_ready_skipped_wrong_state',
        orderId,
        currentStatus: order.status,
      });
      return;
    }

    await this.orderRepo.update(orderId, { status: OrderStatus.READY_FOR_PICKUP });
    await this.historyRepo.save(
      this.historyRepo.create({
        orderId,
        status: OrderStatus.READY_FOR_PICKUP,
        changedByUserId: null,
        note: 'Auto-flipped from PREPARING after 15-minute timer',
      }),
    );

    // Same payload shape the OrderService emits — keeps the notification-service
    // contract consistent across manual and auto transitions.
    try {
      this.nats.emit('order.status.changed', {
        eventId: randomUUID(),
        orderId,
        orderNumber: order.orderNumber,
        status: OrderStatus.READY_FOR_PICKUP,
        previousStatus: OrderStatus.PREPARING,
        changedBy: null,
        changedByRole: 'system',
        restaurantId: order.restaurantId,
        customerId: order.customerId,
        deliveryAgentId: order.deliveryAgentId,
        ownerUserId: order.ownerUserId,
      });
    } catch (err) {
      this.logger.warn({ msg: 'online_auto_ready_nats_emit_failed', orderId, err });
    }

    this.logger.log({ msg: 'online_auto_ready_flipped', orderId });
  }
}
