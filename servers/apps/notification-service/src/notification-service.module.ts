import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bullmq';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { redisStore } from 'cache-manager-redis-yet';
import { NotificationServiceController } from './notification-service.controller';
import { NotificationServiceService } from './notification-service.service';
import { Notification } from './entities/notification.entity';
import { UserRead } from './entities/user.read';
import { NOTIFICATION_QUEUE } from './queue/queue.constants';
import { NotificationProcessor } from './queue/notification.processor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USER', 'postgres'),
        password: config.get('DB_PASSWORD', 'postgres'),
        database: config.get('DB_NAME', 'sufra_db'),
        autoLoadEntities: true,
        synchronize: config.get('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),

    TypeOrmModule.forFeature([Notification, UserRead]),

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

    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async (config: ConfigService) => ({
        store: await redisStore({
          socket: {
            host: config.get('REDIS_HOST', 'localhost'),
            port: config.get<number>('REDIS_PORT', 6379),
          },
        }),
      }),
      inject: [ConfigService],
    }),

    JwtModule.register({}),

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

    BullModule.registerQueue({ name: NOTIFICATION_QUEUE }),
  ],
  controllers: [NotificationServiceController],
  providers: [NotificationServiceService, NotificationProcessor],
})
export class NotificationServiceModule {}
