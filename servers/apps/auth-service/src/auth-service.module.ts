import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { CacheModule } from "@nestjs/cache-manager";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { redisStore } from "cache-manager-redis-yet";
import { User } from "./entities/user.entity";
import { AppJwtModule } from "./jwt/jwt.module";
import { OtpService } from "./otp/otp.service";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ".env" }),

    TypeOrmModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        type: "postgres",
        host: config.get<string>("DB_HOST", "localhost"),
        port: config.get<number>("DB_PORT", 5432),
        username: config.get<string>("DB_USER", "postgres"),
        password: config.get<string>("DB_PASSWORD", "postgres"),
        database: config.get<string>("DB_NAME", "sufra_db"),
        autoLoadEntities: true,
        synchronize: config.get<string>("NODE_ENV") !== "production",
        logging: config.get<string>("NODE_ENV") === "development",
        extra: {
          max: 10,
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 5_000,
        },
      }),
      inject: [ConfigService],
    }),

    TypeOrmModule.forFeature([User]),

    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async (config: ConfigService) => ({
        store: await redisStore({
          socket: {
            host: config.get<string>("REDIS_HOST", "localhost"),
            port: config.get<number>("REDIS_PORT", 6379),
          },
        }),
      }),
      inject: [ConfigService],
    }),

    ClientsModule.registerAsync([
      {
        name: "NATS_SERVICE",
        useFactory: (config: ConfigService) => ({
          transport: Transport.NATS,
          options: {
            servers: [config.get<string>("NATS_URL", "nats://localhost:4222")],
          },
        }),
        inject: [ConfigService],
      },
    ]),

    AppJwtModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, OtpService],
})
export class AuthServiceModule {}
