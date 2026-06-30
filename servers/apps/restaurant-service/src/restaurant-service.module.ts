import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { redisStore } from 'cache-manager-redis-yet';
import { RestaurantServiceController } from './restaurant-service.controller';
import { RestaurantServiceService } from './restaurant-service.service';
import { AiMenuImportService } from './ai-menu-import.service';
import { AiCoverImageService } from './ai-cover-image.service';
import { AiMealImageService } from './ai-meal-image.service';
import { AiTextService } from './ai-text.service';
import { AiMealCopyService } from './ai-meal-copy.service';
import { AiVoiceService } from './ai-voice.service';
import { S3Service } from './s3.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Restaurant } from './entities/restaurant.entity';
import { RestaurantRequest } from './entities/restaurant-request.entity';
import { RestaurantHour } from './entities/restaurant-hour.entity';
import { RestaurantCategory } from './entities/restaurant-category.entity';
import { RestaurantCategoryMap } from './entities/restaurant-category-map.entity';
import { Menu } from './entities/menu.entity';
import { MenuSection } from './entities/menu-section.entity';
import { Meal } from './entities/meal.entity';
import { MealOptionGroup } from './entities/meal-option-group.entity';
import { MealOption } from './entities/meal-option.entity';
import { CategoriesService } from './categories/categories.service';
import { TablesService } from './tables/tables.service';
import { RestaurantTable } from './entities/restaurant-table.entity';
import { AccountingService } from './accounting/accounting.service';
import { RestaurantExpense } from './entities/restaurant-expense.entity';
import { InventoryService } from './inventory/inventory.service';
import { InventoryItem } from './entities/inventory-item.entity';
import { InventoryMovement } from './entities/inventory-movement.entity';
import { MealIngredient } from './entities/meal-ingredient.entity';
import { RestaurantAnalyticsService } from './analytics/analytics.service';
import { OrderRead } from './analytics/read-models/order.read';
import { OrderItemRead } from './analytics/read-models/order-item.read';
import { DeliveryRead } from './analytics/read-models/delivery.read';
import { OrderRatingRead } from './analytics/read-models/order-rating.read';
import { RestaurantRating } from './entities/restaurant-rating.entity';
import { RestaurantRatingsService } from './ratings/restaurant-ratings.service';

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
      }),
      inject: [ConfigService],
    }),

    TypeOrmModule.forFeature([
      Restaurant, RestaurantRequest, RestaurantHour,
      RestaurantCategory, RestaurantCategoryMap,
      Menu, MenuSection, Meal, MealOptionGroup, MealOption,
      RestaurantTable,
      RestaurantExpense,
      InventoryItem,
      InventoryMovement,
      MealIngredient,
      RestaurantRating,
      OrderRead, OrderItemRead, DeliveryRead, OrderRatingRead,
    ]),

    // JWT — secret is read inside JwtAuthGuard per-request
    JwtModule.register({}),

    // NATS client — emits events to auth-service
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
            host: config.get<string>('REDIS_HOST', 'localhost'),
            port: config.get<number>('REDIS_PORT', 6379),
          },
        }),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [RestaurantServiceController],
  providers: [RestaurantServiceService, AiMenuImportService, AiCoverImageService, AiMealImageService, AiTextService, AiMealCopyService, AiVoiceService, RestaurantAnalyticsService, CategoriesService, TablesService, AccountingService, InventoryService, RestaurantRatingsService, JwtAuthGuard, RolesGuard, S3Service],
})
export class RestaurantServiceModule {}
