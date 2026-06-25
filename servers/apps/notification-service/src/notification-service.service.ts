import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { UserRead, UserRole, UserStatus } from './entities/user.read';

type CreatePayload = {
  userId: string;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
};

@Injectable()
export class NotificationServiceService {
  private readonly logger = new Logger(NotificationServiceService.name);

  // Bulk-insert chunk size — keeps a single INSERT statement under common pg limits.
  private static readonly INSERT_CHUNK = 500;

  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
    @InjectRepository(UserRead)
    private readonly users: Repository<UserRead>,
    @Inject('NATS_SERVICE') private readonly nats: ClientProxy,
  ) {}

  async create(userId: string, type: string, title: string, body?: string, data?: object) {
    const n = await this.repo.save(
      this.repo.create({ userId, type, title, body, data }),
    );
    this.logger.log(`Notification created for ${userId}: ${type}`);
    this.pushToSocket(userId, n);
    return n;
  }

  async getForUser(userId: string, page = 1, limit = 20) {
    const [items, total] = await this.repo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, unread: items.filter((n) => !n.isRead).length };
  }

  async markRead(userId: string, notificationId: string) {
    await this.repo.update({ id: notificationId, userId }, { isRead: true });
  }

  async markAllRead(userId: string) {
    await this.repo.update({ userId, isRead: false }, { isRead: true });
  }

  /**
   * Manager broadcast — fan-out to every active user (optionally filtered by role).
   * Returns the number of recipients written.
   */
  async broadcast(payload: Omit<CreatePayload, 'userId'> & { role?: UserRole }) {
    const where: Record<string, unknown> = { status: UserStatus.ACTIVE };
    if (payload.role) where.role = payload.role;

    const recipients = await this.users.find({ where, select: ['id'] });
    if (recipients.length === 0) {
      return { recipients: 0 };
    }

    const userIds = recipients.map((u) => u.id);
    const rows = userIds.map((userId) =>
      this.repo.create({
        userId,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        data: payload.data ?? null,
      }),
    );

    // Insert in chunks to avoid oversized statements on large fan-outs
    for (let i = 0; i < rows.length; i += NotificationServiceService.INSERT_CHUNK) {
      const chunk = rows.slice(i, i + NotificationServiceService.INSERT_CHUNK);
      await this.repo.save(chunk);
    }

    this.logger.log({ msg: 'notification_broadcast', type: payload.type, recipients: userIds.length });

    // Best-effort live push to anyone currently connected — full row not needed.
    for (const userId of userIds) {
      this.emitPush(userId, {
        type: payload.type,
        title: payload.title,
        body: payload.body ?? null,
        data: payload.data ?? null,
      });
    }

    return { recipients: userIds.length };
  }

  /** Manager send to a single user identified by phone number. */
  async sendToPhone(phone: string, payload: Omit<CreatePayload, 'userId'>) {
    const user = await this.users.findOne({ where: { phone }, select: ['id', 'status'] });
    if (!user) {
      throw new NotFoundException('لا يوجد مستخدم بهذا الرقم.');
    }
    return this.create(user.id, payload.type, payload.title, payload.body, payload.data);
  }

  // ─── internal ─────────────────────────────────────────────────────────────

  private pushToSocket(userId: string, n: Notification) {
    this.emitPush(userId, {
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      data: n.data,
      createdAt: n.createdAt,
    });
  }

  private emitPush(userId: string, payload: Record<string, unknown>) {
    try {
      this.nats.emit('notification.push', {
        userId,
        event: 'notification:new',
        payload,
      });
    } catch (err) {
      this.logger.warn({ msg: 'nats_push_failed', userId, err });
    }
  }
}
