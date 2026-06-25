import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { JwtModule } from '@nestjs/jwt';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { redisStore } from 'cache-manager-redis-yet';

import { ApiGatewayController } from './api-gateway.controller';
import { ApiGatewayService } from './api-gateway.service';
import { SocketGateway } from './gateway/socket.gateway';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

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
  ],
  controllers: [ApiGatewayController],
  providers: [ApiGatewayService, SocketGateway],
})
export class ApiGatewayModule {}
