import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Restaurant, RestaurantStatus } from '../entities/restaurant.entity';
import { RestaurantRating } from '../entities/restaurant-rating.entity';
import { RateRestaurantDto } from '../dto/rate-restaurant.dto';
import {
  ListRestaurantReviewsDto,
  RestaurantReviewSort,
} from '../dto/list-restaurant-reviews.dto';

export interface RestaurantReviewItem {
  id: string;
  userId: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RestaurantRatingSummary {
  average: number;
  total: number;
  /** Always 5 rows, stars 5→1, zero-filled. */
  distribution: { stars: number; count: number }[];
}

export interface RestaurantReviewsPage {
  items: RestaurantReviewItem[];
  total: number;
  page: number;
  limit: number;
  summary: RestaurantRatingSummary;
}

export interface RateRestaurantResult {
  id: string;
  restaurantId: string;
  rating: number;
  comment: string | null;
  /** Restaurant aggregate after this write — lets the client sync instantly. */
  aggregate: {
    rating: number;
    totalRatings: number;
  };
  updated: boolean; // true when an existing rating was changed (re-rate)
}

/**
 * Standalone restaurant ratings — one rating per customer per restaurant.
 *
 * `restaurant_ratings` is the source of truth. After each write we recompute the
 * denormalised aggregate on `restaurants` (AVG + COUNT) from this table inside
 * the same transaction, so listings/cards stay correct without a join and the
 * average never drifts (re-rating just updates the row and recomputes).
 *
 * Deliberately a small, focused service rather than another method on the
 * 800-line RestaurantServiceService — ratings are a self-contained concern.
 */
@Injectable()
export class RestaurantRatingsService {
  private readonly logger = new Logger(RestaurantRatingsService.name);

  constructor(
    @InjectRepository(Restaurant)
    private readonly restaurantRepo: Repository<Restaurant>,
    @InjectRepository(RestaurantRating)
    private readonly ratingRepo: Repository<RestaurantRating>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create or update the caller's rating for a restaurant, then recompute the
   * restaurant's aggregate. Idempotent per (restaurant, user): re-rating updates
   * the existing row instead of creating a duplicate.
   */
  async rate(
    restaurantId: string,
    userId: string,
    dto: RateRestaurantDto,
  ): Promise<RateRestaurantResult> {
    // Only allow rating real, customer-visible restaurants.
    const restaurant = await this.restaurantRepo.findOne({
      where: { id: restaurantId },
      select: ['id', 'status'],
    });
    if (!restaurant || restaurant.status !== RestaurantStatus.ACTIVE) {
      throw new NotFoundException('المطعم غير موجود.');
    }

    return this.dataSource.transaction(async (em) => {
      const existing = await em.findOne(RestaurantRating, {
        where: { restaurantId, userId },
      });

      const updated = !!existing;
      const row = em.create(RestaurantRating, {
        id: existing?.id,
        restaurantId,
        userId,
        rating: dto.rating,
        comment: dto.comment ?? null,
      });
      const saved = await em.save(RestaurantRating, row);

      // Recompute AVG + COUNT from the live rows — the single source of truth.
      const agg = await em
        .createQueryBuilder(RestaurantRating, 'rr')
        .select('ROUND(AVG(rr.rating)::numeric, 2)', 'avg')
        .addSelect('COUNT(rr.id)', 'count')
        .where('rr.restaurant_id = :restaurantId', { restaurantId })
        .getRawOne<{ avg: string | null; count: string }>();

      const nextRating = agg?.avg != null ? Number(agg.avg) : 0;
      const nextCount = agg ? Number(agg.count) : 0;

      await em.update(Restaurant, restaurantId, {
        rating: nextRating,
        totalRatings: nextCount,
      });

      this.logger.log(
        `Restaurant ${restaurantId} rated ${dto.rating} by ${userId} ` +
          `(${updated ? 'updated' : 'new'}) → avg ${nextRating} over ${nextCount}`,
      );

      return {
        id: saved.id,
        restaurantId,
        rating: saved.rating,
        comment: saved.comment,
        aggregate: { rating: nextRating, totalRatings: nextCount },
        updated,
      };
    });
  }

  /** The caller's own rating for a restaurant, or null if they haven't rated. */
  async getMyRating(
    restaurantId: string,
    userId: string,
  ): Promise<{ rating: number; comment: string | null } | null> {
    const row = await this.ratingRepo.findOne({
      where: { restaurantId, userId },
      select: ['rating', 'comment'],
    });
    return row ? { rating: row.rating, comment: row.comment } : null;
  }

  // ─── Dashboard (owner-facing) ─────────────────────────────────────────────

  /**
   * Paginated, sortable list of a restaurant's standalone customer ratings,
   * scoped to the authenticated owner. Single-table reads on `restaurant_ratings`
   * (indexed on restaurant_id) — no joins, no N+1. The list query, total count,
   * and summary run in parallel.
   */
  async listOwnerReviews(
    userId: string,
    query: ListRestaurantReviewsDto,
  ): Promise<RestaurantReviewsPage> {
    const restaurantId = await this.resolveOwnedRestaurantId(userId);

    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const skip = (page - 1) * limit;
    const sort = query.sort ?? RestaurantReviewSort.LATEST;

    const order = this.buildOrder(sort);

    const [items, total, summary] = await Promise.all([
      this.ratingRepo.find({
        where: { restaurantId },
        order,
        skip,
        take: limit,
        select: ['id', 'userId', 'rating', 'comment', 'createdAt', 'updatedAt'],
      }),
      this.ratingRepo.count({ where: { restaurantId } }),
      this.computeSummary(restaurantId),
    ]);

    return {
      items: items.map((r) => ({
        id: r.id,
        userId: r.userId,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      total,
      page,
      limit,
      summary,
    };
  }

  /** Summary only (average, total, 5→1 distribution) for the owner's restaurant. */
  async getOwnerSummary(userId: string): Promise<RestaurantRatingSummary> {
    const restaurantId = await this.resolveOwnedRestaurantId(userId);
    return this.computeSummary(restaurantId);
  }

  private buildOrder(
    sort: RestaurantReviewSort,
  ): Record<string, 'ASC' | 'DESC'> {
    switch (sort) {
      case RestaurantReviewSort.HIGHEST:
        // Highest score first, newest among equal scores.
        return { rating: 'DESC', createdAt: 'DESC' };
      case RestaurantReviewSort.LOWEST:
        return { rating: 'ASC', createdAt: 'DESC' };
      case RestaurantReviewSort.LATEST:
      default:
        return { createdAt: 'DESC' };
    }
  }

  /**
   * Average + total + full 5→1 distribution, computed in two grouped queries.
   * The distribution is always padded to five buckets so the UI can render bars
   * without client-side gap-filling.
   */
  private async computeSummary(
    restaurantId: string,
  ): Promise<RestaurantRatingSummary> {
    const [totals, dist] = await Promise.all([
      this.ratingRepo
        .createQueryBuilder('rr')
        .select('ROUND(AVG(rr.rating)::numeric, 2)', 'avg')
        .addSelect('COUNT(rr.id)', 'count')
        .where('rr.restaurant_id = :restaurantId', { restaurantId })
        .getRawOne<{ avg: string | null; count: string }>(),
      this.ratingRepo
        .createQueryBuilder('rr')
        .select('rr.rating', 'stars')
        .addSelect('COUNT(rr.id)', 'count')
        .where('rr.restaurant_id = :restaurantId', { restaurantId })
        .groupBy('rr.rating')
        .getRawMany<{ stars: number; count: string }>(),
    ]);

    const byStar = new Map<number, number>();
    for (const row of dist) byStar.set(Number(row.stars), Number(row.count));

    return {
      average: totals?.avg != null ? Number(totals.avg) : 0,
      total: totals ? Number(totals.count) : 0,
      distribution: [5, 4, 3, 2, 1].map((stars) => ({
        stars,
        count: byStar.get(stars) ?? 0,
      })),
    };
  }

  /** Resolve the owner's restaurant id; mirrors the analytics service's guard. */
  private async resolveOwnedRestaurantId(userId: string): Promise<string> {
    const restaurant = await this.restaurantRepo.findOne({
      where: { ownerUserId: userId },
      select: ['id', 'status'],
    });
    if (!restaurant) {
      throw new NotFoundException('لم يتم العثور على المطعم.');
    }
    if (restaurant.status === RestaurantStatus.PENDING_APPROVAL) {
      throw new ForbiddenException('المطعم قيد المراجعة، التقييمات غير متاحة بعد.');
    }
    return restaurant.id;
  }
}
