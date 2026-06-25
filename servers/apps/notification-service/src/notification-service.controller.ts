import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NotificationServiceService } from './notification-service.service';
import { NOTIFICATION_QUEUE, JOBS } from './queue/queue.constants';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { SendBroadcastDto } from './dto/send-broadcast.dto';
import { SendToPhoneDto } from './dto/send-to-phone.dto';

@Controller()
export class NotificationServiceController {
  constructor(
    private readonly service: NotificationServiceService,
    @InjectQueue(NOTIFICATION_QUEUE) private readonly notificationQueue: Queue,
  ) {}

  // ─── REST: notifications for the current user ─────────────────────────────

  @Get('notifications')
  @UseGuards(JwtAuthGuard)
  list(
    @Req() req: any,
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.service.getForUser(req.user.sub, page, limit);
  }

  @Patch('notifications/read-all')
  @UseGuards(JwtAuthGuard)
  async markAllRead(@Req() req: any) {
    await this.service.markAllRead(req.user.sub);
    return { message: 'تم تحديد جميع الإشعارات كمقروءة' };
  }

  @Patch('notifications/:id/read')
  @UseGuards(JwtAuthGuard)
  async markRead(@Req() req: any, @Param('id') id: string) {
    await this.service.markRead(req.user.sub, id);
    return { message: 'تم تحديد الإشعار كمقروء' };
  }

  // ─── REST: manager-only send ──────────────────────────────────────────────

  @Post('notifications/broadcast')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager')
  async broadcast(@Body() dto: SendBroadcastDto) {
    const result = await this.service.broadcast(dto);
    return {
      message: `تم إرسال الإشعار إلى ${result.recipients} مستخدم.`,
      ...result,
    };
  }

  @Post('notifications/send-to-phone')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager')
  async sendToPhone(@Body() dto: SendToPhoneDto) {
    const { phone, ...payload } = dto;
    const n = await this.service.sendToPhone(phone, payload);
    return { message: 'تم إرسال الإشعار.', notification: n };
  }

  // ─── NATS event handlers — enqueue rather than process inline ────────────

  @EventPattern('order.created')
  async onOrderCreated(@Payload() data: any) {
    await this.notificationQueue.add(
      JOBS.SEND_NOTIFICATION,
      { type: 'order.created', payload: data },
      { jobId: `notif:order.created:${data.orderId}` },
    );
  }

  @EventPattern('order.status.changed')
  async onStatusChanged(@Payload() data: any) {
    await this.notificationQueue.add(
      JOBS.SEND_NOTIFICATION,
      { type: 'order.status.changed', payload: data },
    );
  }

  @EventPattern('order.delivery.assigned')
  async onDeliveryAssigned(@Payload() data: any) {
    await this.notificationQueue.add(
      JOBS.SEND_NOTIFICATION,
      { type: 'order.delivery.assigned', payload: data },
      { jobId: `notif:delivery.assigned:${data.orderId}` },
    );
  }

  @EventPattern('restaurant.application.submitted')
  async onRestaurantApplicationSubmitted(@Payload() data: any) {
    await this.notificationQueue.add(
      JOBS.SEND_NOTIFICATION,
      { type: 'restaurant.application.submitted', payload: data },
      { jobId: `notif:restaurant.application:${data.requestId}` },
    );
  }

  @EventPattern('delivery.application.submitted')
  async onDeliveryApplicationSubmitted(@Payload() data: any) {
    await this.notificationQueue.add(
      JOBS.SEND_NOTIFICATION,
      { type: 'delivery.application.submitted', payload: data },
      { jobId: `notif:delivery.application:${data.agentId}` },
    );
  }

  @EventPattern('restaurant.owner.approved')
  async onRestaurantOwnerApproved(@Payload() data: any) {
    await this.notificationQueue.add(
      JOBS.SEND_NOTIFICATION,
      { type: 'restaurant.owner.approved', payload: data },
      { jobId: `notif:restaurant.welcome:${data.requestId ?? data.userId}` },
    );
  }
}
