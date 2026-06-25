import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NOTIFICATION_QUEUE, JOBS } from './queue.constants';
import { NotificationServiceService } from '../notification-service.service';
import { UserRole } from '../entities/user.read';

export type NotificationJobType =
  | 'order.created'
  | 'order.status.changed'
  | 'order.delivery.assigned'
  | 'restaurant.application.submitted'
  | 'delivery.application.submitted'
  | 'restaurant.owner.approved';

export interface NotificationJobData {
  type: NotificationJobType;
  payload: Record<string, any>;
}

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'تم قبول طلبك',
  preparing: 'جاري تحضير طلبك',
  ready_for_pickup: 'طلبك جاهز للاستلام',
  out_for_delivery: 'طلبك في الطريق إليك',
  delivered: 'تم تسليم طلبك',
  cancelled: 'تم إلغاء طلبك',
};

@Processor(NOTIFICATION_QUEUE)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private readonly service: NotificationServiceService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== JOBS.SEND_NOTIFICATION) return;

    const { type, payload } = job.data as NotificationJobData;
    this.logger.log({ msg: 'notification_job_started', type, jobId: job.id, attempt: job.attemptsMade });

    switch (type) {
      case 'order.created':
        await this.handleOrderCreated(payload);
        break;
      case 'order.status.changed':
        await this.handleStatusChanged(payload);
        break;
      case 'order.delivery.assigned':
        await this.handleDeliveryAssigned(payload);
        break;
      case 'restaurant.application.submitted':
        await this.handleRestaurantApplicationSubmitted(payload);
        break;
      case 'delivery.application.submitted':
        await this.handleDeliveryApplicationSubmitted(payload);
        break;
      case 'restaurant.owner.approved':
        await this.handleRestaurantOwnerApproved(payload);
        break;
      default:
        this.logger.warn({ msg: 'notification_unknown_type', type, jobId: job.id });
    }

    this.logger.log({ msg: 'notification_job_done', type, jobId: job.id });
  }

  private async handleOrderCreated(data: Record<string, any>) {
    if (data.ownerUserId) {
      await this.service.create(
        data.ownerUserId,
        'order.new',
        'طلب جديد',
        `طلب جديد #${data.orderNumber} بقيمة ${data.totalAmount} شيكل`,
        { orderId: data.orderId, orderNumber: data.orderNumber },
      );
    }
  }

  private async handleStatusChanged(data: Record<string, any>) {
    const title = STATUS_LABELS[data.status] ?? `تحديث الطلب: ${data.status}`;

    if (data.customerId) {
      await this.service.create(
        data.customerId,
        'order.status',
        title,
        `رقم الطلب: ${data.orderNumber}`,
        { orderId: data.orderId, status: data.status },
      );
    }
    if (data.deliveryAgentId && ['ready_for_pickup', 'cancelled'].includes(data.status)) {
      await this.service.create(
        data.deliveryAgentId,
        'order.status',
        data.status === 'ready_for_pickup' ? 'طلب جاهز للتوصيل' : 'تم إلغاء الطلب',
        `رقم الطلب: ${data.orderNumber}`,
        { orderId: data.orderId, status: data.status },
      );
    }
  }

  private async handleDeliveryAssigned(data: Record<string, any>) {
    if (data.deliveryAgentId) {
      await this.service.create(
        data.deliveryAgentId,
        'order.assigned',
        'تم تعيينك لتوصيل طلب',
        `رقم الطلب: ${data.orderId}`,
        { orderId: data.orderId },
      );
    }
    if (data.customerId) {
      await this.service.create(
        data.customerId,
        'order.assigned',
        'تم تعيين مندوب لطلبك',
        undefined,
        { orderId: data.orderId },
      );
    }
  }

  private async handleRestaurantApplicationSubmitted(data: Record<string, any>) {
    const name = data.restaurantName?.trim() || 'مطعم جديد';
    const cityPart = data.city ? ` — ${data.city}` : '';
    await this.service.broadcast({
      role: UserRole.MANAGER,
      type: 'restaurant.application.submitted',
      title: 'طلب انضمام مطعم جديد',
      body: `${name}${cityPart} بانتظار المراجعة`,
      data: {
        requestId: data.requestId,
        restaurantId: data.restaurantId,
        restaurantName: data.restaurantName ?? null,
        ownerName: data.ownerName ?? null,
        city: data.city ?? null,
      },
    });
  }

  private async handleDeliveryApplicationSubmitted(data: Record<string, any>) {
    const name = data.fullName?.trim() || 'مندوب جديد';
    const cityPart = data.city ? ` — ${data.city}` : '';
    await this.service.broadcast({
      role: UserRole.MANAGER,
      type: 'delivery.application.submitted',
      title: 'طلب انضمام مندوب جديد',
      body: `${name}${cityPart} بانتظار المراجعة`,
      data: {
        agentId: data.agentId,
        userId: data.userId,
        fullName: data.fullName ?? null,
        city: data.city ?? null,
        vehicleType: data.vehicleType ?? null,
      },
    });
  }

  private async handleRestaurantOwnerApproved(data: Record<string, any>) {
    if (!data.userId) return;
    const name = data.restaurantName?.trim();
    const body = name
      ? `تم تفعيل مطعمك "${name}" — يمكنك الآن استقبال الطلبات.`
      : 'تم تفعيل مطعمك — يمكنك الآن استقبال الطلبات.';
    await this.service.create(
      data.userId,
      'restaurant.welcome',
      'مرحباً بك في جاهز',
      body,
      {
        restaurantId: data.restaurantId ?? null,
        restaurantName: data.restaurantName ?? null,
        requestId: data.requestId ?? null,
      },
    );
  }
}
