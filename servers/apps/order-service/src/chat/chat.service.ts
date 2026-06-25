import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { ChatMessage, ChatSenderRole } from '../entities/chat-message.entity';
// Chat is online-only (POS bills never need customer chat). Use OnlineOrder so
// access checks against deliveryAgentId/customerId are type-safe.
import { OnlineOrder as Order } from '../entities/online-order.entity';
import { OrderStatus } from '../entities/order-enums';
import { SendMessageDto } from './chat.dto';

const ROLE_TO_SENDER: Record<string, ChatSenderRole> = {
  customer: ChatSenderRole.CUSTOMER,
  restaurant_owner: ChatSenderRole.RESTAURANT,
  delivery: ChatSenderRole.DELIVERY,
  manager: ChatSenderRole.MANAGER,
};

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatMessage) private readonly msgRepo: Repository<ChatMessage>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @Inject('NATS_SERVICE') private readonly nats: ClientProxy,
  ) {}

  async getMessages(orderId: string, userId: string, role: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('الطلب غير موجود');
    this.assertChatAccess(order, userId, role);

    return this.msgRepo.find({
      where: { orderId },
      order: { createdAt: 'ASC' },
    });
  }

  async send(userId: string, userInfo: { name: string; role: string }, dto: SendMessageDto) {
    const order = await this.orderRepo.findOne({ where: { id: dto.orderId } });
    if (!order) throw new NotFoundException('الطلب غير موجود');
    if (order.isLocked) throw new BadRequestException('المحادثة مغلقة — الطلب منتهٍ');
    if (order.status === OrderStatus.CANCELLED)
      throw new BadRequestException('المحادثة مغلقة — الطلب ملغى');

    this.assertChatAccess(order, userId, userInfo.role);

    const senderRole = ROLE_TO_SENDER[userInfo.role] ?? ChatSenderRole.CUSTOMER;
    const message = await this.msgRepo.save(
      this.msgRepo.create({
        orderId: dto.orderId,
        senderId: userId,
        senderRole,
        senderName: userInfo.name,
        content: dto.content,
      }),
    );

    this.nats.emit('chat.message.sent', {
      orderId: dto.orderId,
      messageId: message.id,
      senderId: userId,
      senderRole,
      senderName: userInfo.name,
      content: dto.content,
      createdAt: message.createdAt,
      restaurantId: order.restaurantId,
      customerId: order.customerId,
      deliveryAgentId: order.deliveryAgentId,
    });

    return message;
  }

  async archiveByOrder(orderId: string): Promise<void> {
    await this.msgRepo.update({ orderId }, { isArchived: true });
  }

  private assertChatAccess(order: Order, userId: string, role: string) {
    if (role === 'manager') return;
    if (role === 'customer' && order.customerId === userId) return;
    if (role === 'restaurant_owner' && order.ownerUserId === userId) return;
    if (role === 'delivery' && order.deliveryAgentId === userId) return;
    throw new ForbiddenException('ليس لديك صلاحية الوصول لهذه المحادثة');
  }
}
