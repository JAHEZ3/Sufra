import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { JwtModule } from '@nestjs/jwt';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { BullModule } from '@nestjs/bullmq';
import { redisStore } from 'cache-manager-redis-yet';

import { OrderServiceController } from './order-service.controller';
import { OrderServiceService } from './order-service.service';

// Entities
import { Order } from './entities/order.entity';
import { OnlineOrder } from './entities/online-order.entity';
import { LocalOrder } from './entities/local-order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderItemOption } from './entities/order-item-option.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { OrderRating } from './entities/order-rating.entity';
import { PromoCode } from './entities/promo-code.entity';
import { PromoCodeUsage } from './entities/promo-code-usage.entity';
import { ChatMessage } from './entities/chat-message.entity';

// Services
import { CartService } from './cart/cart.service';
import { OrderService } from './order/order.service';
import { ChatService } from './chat/chat.service';
import { PromoService } from './promo/promo.service';
import { ReceiptService } from './receipt/receipt.service';
import { S3Service } from './shared/s3.service';
import { PosService } from './pos/pos.service';
import { PrinterService } from './printer/printer.service';

// Guards
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

// Queue
import {
  ONLINE_AUTO_READY_QUEUE,
  POS_FINALIZE_QUEUE,
  RECEIPT_QUEUE,
} from './queue/queue.constants';
import { ReceiptProcessor } from './queue/receipt.processor';
import { PosProcessor } from './queue/pos.processor';
import { OnlineAutoReadyProcessor } from './queue/online-auto-ready.processor';

// Shared
import { RedisLockService } from './shared/redis-lock.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USER', 'postgres'),
        password: config.get<string>('DB_PASSWORD', 'postgres'),
        database: config.get<string>('DB_NAME', 'sufra_db'),
        autoLoadEntities: true,
        synchronize: config.get<string>('NODE_ENV') !== 'production',
        logging: config.get<string>('NODE_ENV') === 'development',
        extra: { max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 },
      }),
      inject: [ConfigService],
    }),

    TypeOrmModule.forFeature([
      Order,
      OnlineOrder,
      LocalOrder,
      OrderItem,
      OrderItemOption,
      OrderStatusHistory,
      OrderRating,
      PromoCode,
      PromoCodeUsage,
      ChatMessage,
    ]),

    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async (config: ConfigService) => ({
        store: await redisStore({
          socket: {
            host: config.get<string>('REDIS_HOST', 'localhost'),
            port: config.get<number>('REDIS_PORT', 6379),
          },
        }),
      }),
      inject: [ConfigService],
    }),

    JwtModule.register({}),

    ClientsModule.registerAsync([
      {
        name: 'NATS_SERVICE',
        useFactory: (config: ConfigService) => ({
          transport: Transport.NATS,
          options: { servers: [config.get<string>('NATS_URL', 'nats://localhost:4222')] },
        }),
        inject: [ConfigService],
      },
    ]),

    BullModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 3_000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 500 },
        },
      }),
      inject: [ConfigService],
    }),

    BullModule.registerQueue({ name: RECEIPT_QUEUE }),
    BullModule.registerQueue({ name: POS_FINALIZE_QUEUE }),
    BullModule.registerQueue({ name: ONLINE_AUTO_READY_QUEUE }),
  ],
  controllers: [OrderServiceController],
  providers: [
    OrderServiceService,
    CartService,
    OrderService,
    ChatService,
    PromoService,
    ReceiptService,
    S3Service,
    PosService,
    PrinterService,
    JwtAuthGuard,
    RolesGuard,
    ReceiptProcessor,
    PosProcessor,
    OnlineAutoReadyProcessor,
    RedisLockService,
  ],
})
export class OrderServiceModule {}
