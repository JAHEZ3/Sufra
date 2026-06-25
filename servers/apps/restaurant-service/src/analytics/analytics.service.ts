import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Restaurant, RestaurantStatus } from '../entities/restaurant.entity';
import { Menu } from '../entities/menu.entity';
import { MenuSection } from '../entities/menu-section.entity';
import { Meal } from '../entities/meal.entity';
import { OrderRead, OrderStatus, PaymentStatus } from './read-models/order.read';
import { OrderItemRead } from './read-models/order-item.read';
import { DeliveryRead } from './read-models/delivery.read';
import { OrderRatingRead } from './read-models/order-rating.read';
import { ReportPeriod } from '../dto/analytics-report.dto';

const num = (v: string | number | null | undefined) =>
  v == null ? 0 : Number(v);

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const daysAgo = (n: number) => {
  const x = startOfDay(new Date());
  x.setDate(x.getDate() - n);
  return x;
};

const REVENUE_STATUSES = [OrderStatus.DELIVERED];
const NON_CANCELLED = [OrderStatus.CANCELLED, OrderStatus.REFUNDED];

interface PeriodRange {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
  bucket: 'hour' | 'day' | 'day';
  label: string;
}

const buildRange = (period: ReportPeriod): PeriodRange => {
  const now = new Date();
  const end = new Date(now);
  if (period === ReportPeriod.DAILY) {
    const start = startOfDay(now);
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - 1);
    return {
      start,
      end,
      prevStart,
      prevEnd: start,
      bucket: 'hour',
      label: 'اليوم',
    };
  }
  if (period === ReportPeriod.WEEKLY) {
    const start = daysAgo(6);
    const prevEnd = start;
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - 7);
    return { start, end, prevStart, prevEnd, bucket: 'day', label: 'هذا الأسبوع' };
  }
  // monthly
  const start = daysAgo(29);
  const prevEnd = start;
  const prevStart = new Date(start);
  prevStart.setDate(prevStart.getDate() - 30);
  return { start, end, prevStart, prevEnd, bucket: 'day', label: 'هذا الشهر' };
};

const pctChange = (current: number, previous: number): number => {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Number((((current - previous) / previous) * 100).toFixed(2));
};

@Injectable()
export class RestaurantAnalyticsService {
  constructor(
    @InjectRepository(Restaurant) private readonly restaurantRepo: Repository<Restaurant>,
    @InjectRepository(Menu) private readonly menuRepo: Repository<Menu>,
    @InjectRepository(MenuSection) private readonly sectionRepo: Repository<MenuSection>,
    @InjectRepository(Meal) private readonly mealRepo: Repository<Meal>,
    @InjectRepository(OrderRead) private readonly orderRepo: Repository<OrderRead>,
    @InjectRepository(OrderItemRead) private readonly itemRepo: Repository<OrderItemRead>,
    @InjectRepository(DeliveryRead) private readonly deliveryRepo: Repository<DeliveryRead>,
    @InjectRepository(OrderRatingRead) private readonly ratingRepo: Repository<OrderRatingRead>,
  ) {}

  // ─── Resolve owner → restaurant ────────────────────────────────────────────

  private async resolveRestaurantId(userId: string): Promise<string> {
    const restaurant = await this.restaurantRepo.findOne({
      where: { ownerUserId: userId },
      select: ['id', 'status'],
    });
    if (!restaurant) {
      throw new NotFoundException('لم يتم العثور على المطعم.');
    }
    if (restaurant.status === RestaurantStatus.PENDING_APPROVAL) {
      throw new ForbiddenException('المطعم قيد المراجعة، التحليلات غير متاحة بعد.');
    }
    return restaurant.id;
  }

  // ─── Performance report (daily / weekly / monthly) ────────────────────────

  async getPerformanceReport(userId: string, period: ReportPeriod) {
    const restaurantId = await this.resolveRestaurantId(userId);
    const range = buildRange(period);

    const [current, previous, breakdown, statusBreakdown, paymentBreakdown, topMeals, topCustomers, ratings] =
      await Promise.all([
        this.periodMetrics(restaurantId, range.start, range.end),
        this.periodMetrics(restaurantId, range.prevStart, range.prevEnd),
        this.periodTimeSeries(restaurantId, range.start, range.end, range.bucket),
        this.periodOrderByStatus(restaurantId, range.start, range.end),
        this.periodOrderByPayment(restaurantId, range.start, range.end),
        this.periodTopMeals(restaurantId, range.start, range.end, 5),
        this.periodTopCustomers(restaurantId, range.start, range.end, 5),
        this.periodRatings(restaurantId, range.start, range.end),
      ]);

    const completionRate =
      current.orders > 0 ? (current.delivered / current.orders) * 100 : 0;
    const cancellationRate =
      current.orders > 0 ? (current.cancelled / current.orders) * 100 : 0;

    return {
      data: {
        period,
        label: range.label,
        range: { from: range.start.toISOString(), to: range.end.toISOString() },
        previous: {
          from: range.prevStart.toISOString(),
          to: range.prevEnd.toISOString(),
        },
        kpis: {
          orders: current.orders,
          delivered: current.delivered,
          cancelled: current.cancelled,
          revenue: current.revenue,
          avgOrderValue: current.avgOrderValue,
          uniqueCustomers: current.uniqueCustomers,
          completionRate: Number(completionRate.toFixed(2)),
          cancellationRate: Number(cancellationRate.toFixed(2)),
        },
        growth: {
          ordersPct: pctChange(current.orders, previous.orders),
          revenuePct: pctChange(current.revenue, previous.revenue),
          deliveredPct: pctChange(current.delivered, previous.delivered),
          avgOrderValuePct: pctChange(current.avgOrderValue, previous.avgOrderValue),
          customersPct: pctChange(current.uniqueCustomers, previous.uniqueCustomers),
        },
        breakdown,
        byStatus: statusBreakdown,
        byPaymentMethod: paymentBreakdown,
        topMeals,
        topCustomers,
        ratings,
      },
      message: 'تم استرجاع تقرير الأداء.',
    };
  }

  private async periodMetrics(restaurantId: string, start: Date, end: Date) {
    const baseQb = () =>
      this.orderRepo
        .createQueryBuilder('o')
        .where('o.restaurant_id = :rid', { rid: restaurantId })
        .andWhere('o.created_at >= :start', { start })
        .andWhere('o.created_at < :end', { end });

    const [allRow, deliveredRow, cancelledRow, customersRow] = await Promise.all([
      baseQb().select('COUNT(*)', 'count').getRawOne<{ count: string }>(),
      baseQb()
        .andWhere('o.status = :s', { s: OrderStatus.DELIVERED })
        .select('COUNT(*)', 'count')
        .addSelect('COALESCE(SUM(o.total_amount), 0)', 'revenue')
        .getRawOne<{ count: string; revenue: string }>(),
      baseQb()
        .andWhere('o.status = :s', { s: OrderStatus.CANCELLED })
        .select('COUNT(*)', 'count')
        .getRawOne<{ count: string }>(),
      baseQb()
        .andWhere('o.status NOT IN (:...excluded)', { excluded: NON_CANCELLED })
        .select('COUNT(DISTINCT o.customer_id)', 'count')
        .getRawOne<{ count: string }>(),
    ]);

    const orders = num(allRow?.count);
    const delivered = num(deliveredRow?.count);
    const revenue = num(deliveredRow?.revenue);
    const cancelled = num(cancelledRow?.count);
    const uniqueCustomers = num(customersRow?.count);
    const avgOrderValue = delivered > 0 ? Number((revenue / delivered).toFixed(2)) : 0;

    return { orders, delivered, cancelled, revenue, avgOrderValue, uniqueCustomers };
  }

  private async periodTimeSeries(
    restaurantId: string,
    start: Date,
    end: Date,
    bucket: 'hour' | 'day',
  ) {
    const select =
      bucket === 'hour'
        ? "DATE_TRUNC('hour', o.created_at)"
        : 'DATE(o.created_at)';
    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .select(select, 'bucket')
      .addSelect('COUNT(*)', 'orders')
      .addSelect(
        "COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN o.total_amount ELSE 0 END), 0)",
        'revenue',
      )
      .where('o.restaurant_id = :rid', { rid: restaurantId })
      .andWhere('o.created_at >= :start', { start })
      .andWhere('o.created_at < :end', { end })
      .groupBy(select)
      .orderBy(select, 'ASC')
      .getRawMany<{ bucket: string; orders: string; revenue: string }>();
    return rows.map((r) => ({
      bucket: r.bucket,
      orders: num(r.orders),
      revenue: num(r.revenue),
    }));
  }

  private async periodOrderByStatus(restaurantId: string, start: Date, end: Date) {
    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('o.restaurant_id = :rid', { rid: restaurantId })
      .andWhere('o.created_at >= :start', { start })
      .andWhere('o.created_at < :end', { end })
      .groupBy('o.status')
      .getRawMany<{ status: string; count: string }>();
    return rows.map((r) => ({ status: r.status, count: num(r.count) }));
  }

  private async periodOrderByPayment(restaurantId: string, start: Date, end: Date) {
    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.payment_method', 'method')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(o.total_amount), 0)', 'total')
      .where('o.restaurant_id = :rid', { rid: restaurantId })
      .andWhere('o.created_at >= :start', { start })
      .andWhere('o.created_at < :end', { end })
      .groupBy('o.payment_method')
      .getRawMany<{ method: string; count: string; total: string }>();
    return rows.map((r) => ({
      method: r.method,
      count: num(r.count),
      total: num(r.total),
    }));
  }

  private async periodTopMeals(
    restaurantId: string,
    start: Date,
    end: Date,
    limit: number,
  ) {
    const rows = await this.itemRepo
      .createQueryBuilder('i')
      .innerJoin(OrderRead, 'o', 'o.id = i.order_id')
      .select('i.meal_id', 'mealId')
      .addSelect('MAX(i.meal_name_snapshot)', 'name')
      .addSelect('SUM(i.quantity)', 'qty')
      .addSelect('SUM(i.total_price)', 'revenue')
      .where('o.restaurant_id = :rid', { rid: restaurantId })
      .andWhere('o.status NOT IN (:...excluded)', { excluded: NON_CANCELLED })
      .andWhere('o.created_at >= :start', { start })
      .andWhere('o.created_at < :end', { end })
      .groupBy('i.meal_id')
      .orderBy('qty', 'DESC')
      .limit(limit)
      .getRawMany<{ mealId: string; name: string; qty: string; revenue: string }>();
    return rows.map((r) => ({
      mealId: r.mealId,
      name: r.name,
      quantity: num(r.qty),
      revenue: num(r.revenue),
    }));
  }

  private async periodTopCustomers(
    restaurantId: string,
    start: Date,
    end: Date,
    limit: number,
  ) {
    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.customer_id', 'customerId')
      .addSelect('COUNT(o.id)', 'orders')
      .addSelect('COALESCE(SUM(o.total_amount), 0)', 'spent')
      .where('o.restaurant_id = :rid', { rid: restaurantId })
      .andWhere('o.status NOT IN (:...excluded)', { excluded: NON_CANCELLED })
      .andWhere('o.created_at >= :start', { start })
      .andWhere('o.created_at < :end', { end })
      .groupBy('o.customer_id')
      .orderBy('orders', 'DESC')
      .limit(limit)
      .getRawMany<{ customerId: string; orders: string; spent: string }>();
    return rows.map((r) => ({
      customerId: r.customerId,
      orders: num(r.orders),
      spent: num(r.spent),
    }));
  }

  private async periodRatings(restaurantId: string, start: Date, end: Date) {
    const row = await this.ratingRepo
      .createQueryBuilder('r')
      .innerJoin(OrderRead, 'o', 'o.id = r.order_id')
      .select('COALESCE(AVG(r.food_rating), 0)', 'avgFood')
      .addSelect('COALESCE(AVG(r.delivery_rating), 0)', 'avgDelivery')
      .addSelect('COUNT(*)', 'count')
      .where('o.restaurant_id = :rid', { rid: restaurantId })
      .andWhere('r.created_at >= :start', { start })
      .andWhere('r.created_at < :end', { end })
      .getRawOne<{ avgFood: string; avgDelivery: string; count: string }>();
    return {
      avgFoodRating: Number(num(row?.avgFood).toFixed(2)),
      avgDeliveryRating: Number(num(row?.avgDelivery).toFixed(2)),
      totalRatings: num(row?.count),
    };
  }

  // ─── Legacy "me" shapes (used by the owner dashboard widgets) ──────────────

  /** GET /api/restaurant/me/stats — flat KPI snapshot for dashboard cards. */
  async getOwnerDashboardStats(userId: string) {
    const restaurantId = await this.resolveRestaurantId(userId);
    const restaurant = await this.restaurantRepo.findOne({
      where: { id: restaurantId },
      select: ['id', 'rating', 'totalRatings'],
    });
    const [orders, revenue] = await Promise.all([
      this.orderCounts(restaurantId),
      this.revenueTotals(restaurantId),
    ]);
    return {
      data: {
        totalOrders: orders.total,
        totalRevenue: revenue.total,
        rating: Number(restaurant?.rating ?? 0),
        totalRatings: restaurant?.totalRatings ?? 0,
        todayOrders: orders.today,
        todayRevenue: revenue.today,
        pendingOrders: orders.pending,
      },
      message: 'تم استرجاع إحصائيات لوحة التحكم.',
    };
  }

  /** GET /api/restaurant/me/sales — daily/weekly/monthly time-series. */
  async getOwnerSales(userId: string, period: 'daily' | 'weekly' | 'monthly') {
    const restaurantId = await this.resolveRestaurantId(userId);
    const days = period === 'daily' ? 1 : period === 'weekly' ? 7 : 30;
    const series = await this.orderTimeSeries(restaurantId, days);
    return {
      data: series.map((p) => ({
        date: p.day,
        revenue: p.revenue,
        orders: p.orders,
      })),
      message: 'تم استرجاع بيانات المبيعات.',
    };
  }

  /** GET /api/restaurant/me/top-meals — top sellers shaped for the widget. */
  async getOwnerTopMeals(userId: string) {
    const restaurantId = await this.resolveRestaurantId(userId);
    const top = await this.topMeals(restaurantId, 10);
    const totalRevenue = top.reduce((sum, m) => sum + (m.revenue || 0), 0);
    const meals = await this.mealRepo.find({
      where: { id: In(top.map((m) => m.mealId)) },
      select: ['id', 'imageUrl'],
    });
    const imageById = new Map(meals.map((m) => [m.id, m.imageUrl ?? null]));
    return {
      data: top.map((m) => ({
        mealId: m.mealId,
        mealName: m.name,
        imageUrl: imageById.get(m.mealId) ?? null,
        totalOrders: m.orders,
        revenue: m.revenue,
        percentageOfTotal:
          totalRevenue > 0
            ? Number(((m.revenue / totalRevenue) * 100).toFixed(2))
            : 0,
      })),
      message: 'تم استرجاع الوجبات الأكثر مبيعًا.',
    };
  }

  // ─── Top-level overview ────────────────────────────────────────────────────

  async getOverview(userId: string) {
    const restaurantId = await this.resolveRestaurantId(userId);
    const [orders, revenue, customers, ratings, menu] = await Promise.all([
      this.orderCounts(restaurantId),
      this.revenueTotals(restaurantId),
      this.customerCounts(restaurantId),
      this.ratingTotals(restaurantId),
      this.menuCounts(restaurantId),
    ]);
    const completionRate =
      orders.total > 0 ? (orders.delivered / orders.total) * 100 : 0;
    const cancellationRate =
      orders.total > 0 ? (orders.cancelled / orders.total) * 100 : 0;
    return {
      data: {
        orders,
        revenue,
        customers,
        ratings,
        menu,
        rates: {
          completionRate: Number(completionRate.toFixed(2)),
          cancellationRate: Number(cancellationRate.toFixed(2)),
        },
      },
      message: 'تم استرجاع نظرة عامة على المطعم.',
    };
  }

  // ─── Orders ────────────────────────────────────────────────────────────────

  async getOrdersAnalytics(userId: string) {
    const restaurantId = await this.resolveRestaurantId(userId);
    const [counts, byStatus, byPaymentMethod, last30Days, byHour] = await Promise.all([
      this.orderCounts(restaurantId),
      this.orderCountByStatus(restaurantId),
      this.orderCountByPaymentMethod(restaurantId),
      this.orderTimeSeries(restaurantId, 30),
      this.orderCountByHour(restaurantId),
    ]);
    return {
      data: { ...counts, byStatus, byPaymentMethod, last30Days, byHour },
      message: 'تم استرجاع تحليلات الطلبات.',
    };
  }

  private async orderCounts(restaurantId: string) {
    const today = startOfDay(new Date());
    const week = daysAgo(7);
    const month = daysAgo(30);

    const baseQb = () =>
      this.orderRepo.createQueryBuilder('o').where('o.restaurant_id = :rid', { rid: restaurantId });

    const [total, todayCount, weekCount, monthCount, delivered, cancelled, pending, preparing] =
      await Promise.all([
        baseQb().getCount(),
        baseQb().andWhere('o.created_at >= :d', { d: today }).getCount(),
        baseQb().andWhere('o.created_at >= :d', { d: week }).getCount(),
        baseQb().andWhere('o.created_at >= :d', { d: month }).getCount(),
        baseQb().andWhere('o.status = :s', { s: OrderStatus.DELIVERED }).getCount(),
        baseQb().andWhere('o.status = :s', { s: OrderStatus.CANCELLED }).getCount(),
        baseQb().andWhere('o.status = :s', { s: OrderStatus.PENDING }).getCount(),
        baseQb().andWhere('o.status = :s', { s: OrderStatus.PREPARING }).getCount(),
      ]);

    return {
      total,
      today: todayCount,
      week: weekCount,
      month: monthCount,
      delivered,
      cancelled,
      pending,
      preparing,
    };
  }

  private async orderCountByStatus(restaurantId: string) {
    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('o.restaurant_id = :rid', { rid: restaurantId })
      .groupBy('o.status')
      .getRawMany<{ status: OrderStatus; count: string }>();
    return rows.map((r) => ({ status: r.status, count: num(r.count) }));
  }

  private async orderCountByPaymentMethod(restaurantId: string) {
    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.payment_method', 'method')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(o.total_amount), 0)', 'total')
      .where('o.restaurant_id = :rid', { rid: restaurantId })
      .groupBy('o.payment_method')
      .getRawMany<{ method: string; count: string; total: string }>();
    return rows.map((r) => ({ method: r.method, count: num(r.count), total: num(r.total) }));
  }

  private async orderTimeSeries(restaurantId: string, days: number) {
    const since = daysAgo(days - 1);
    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .select('DATE(o.created_at)', 'day')
      .addSelect('COUNT(*)', 'orders')
      .addSelect(
        "COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN o.total_amount ELSE 0 END), 0)",
        'revenue',
      )
      .where('o.restaurant_id = :rid', { rid: restaurantId })
      .andWhere('o.created_at >= :since', { since })
      .groupBy('DATE(o.created_at)')
      .orderBy('DATE(o.created_at)', 'ASC')
      .getRawMany<{ day: string; orders: string; revenue: string }>();
    return rows.map((r) => ({ day: r.day, orders: num(r.orders), revenue: num(r.revenue) }));
  }

  private async orderCountByHour(restaurantId: string) {
    const since = daysAgo(30);
    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .select('EXTRACT(HOUR FROM o.created_at)::int', 'hour')
      .addSelect('COUNT(*)', 'count')
      .where('o.restaurant_id = :rid', { rid: restaurantId })
      .andWhere('o.created_at >= :since', { since })
      .groupBy('EXTRACT(HOUR FROM o.created_at)')
      .orderBy('hour', 'ASC')
      .getRawMany<{ hour: number; count: string }>();
    return rows.map((r) => ({ hour: Number(r.hour), count: num(r.count) }));
  }

  // ─── Revenue ───────────────────────────────────────────────────────────────

  async getRevenueAnalytics(userId: string) {
    const restaurantId = await this.resolveRestaurantId(userId);
    const [totals, byPaymentMethod, last30Days] = await Promise.all([
      this.revenueTotals(restaurantId),
      this.orderCountByPaymentMethod(restaurantId),
      this.orderTimeSeries(restaurantId, 30),
    ]);
    return {
      data: { ...totals, byPaymentMethod, last30Days },
      message: 'تم استرجاع تحليلات الإيرادات.',
    };
  }

  private async revenueTotals(restaurantId: string) {
    const today = startOfDay(new Date());
    const week = daysAgo(7);
    const month = daysAgo(30);

    const baseQb = () =>
      this.orderRepo
        .createQueryBuilder('o')
        .where('o.restaurant_id = :rid', { rid: restaurantId })
        .andWhere('o.status IN (:...statuses)', { statuses: REVENUE_STATUSES });

    const [allRow, todayRow, weekRow, monthRow, discountRow] = await Promise.all([
      baseQb()
        .select('COALESCE(SUM(o.total_amount), 0)', 'sum')
        .addSelect('COALESCE(SUM(o.subtotal), 0)', 'subtotal')
        .addSelect('COALESCE(SUM(o.delivery_fee), 0)', 'deliveryFees')
        .addSelect('COUNT(*)', 'count')
        .getRawOne<{ sum: string; subtotal: string; deliveryFees: string; count: string }>(),
      baseQb()
        .andWhere('o.created_at >= :d', { d: today })
        .select('COALESCE(SUM(o.total_amount), 0)', 'sum')
        .getRawOne<{ sum: string }>(),
      baseQb()
        .andWhere('o.created_at >= :d', { d: week })
        .select('COALESCE(SUM(o.total_amount), 0)', 'sum')
        .getRawOne<{ sum: string }>(),
      baseQb()
        .andWhere('o.created_at >= :d', { d: month })
        .select('COALESCE(SUM(o.total_amount), 0)', 'sum')
        .getRawOne<{ sum: string }>(),
      baseQb()
        .select('COALESCE(SUM(o.discount_amount), 0)', 'discount')
        .getRawOne<{ discount: string }>(),
    ]);

    const totalRevenue = num(allRow?.sum);
    const totalDelivered = num(allRow?.count);
    const avgOrder = totalDelivered > 0 ? totalRevenue / totalDelivered : 0;

    return {
      total: totalRevenue,
      today: num(todayRow?.sum),
      week: num(weekRow?.sum),
      month: num(monthRow?.sum),
      subtotal: num(allRow?.subtotal),
      deliveryFees: num(allRow?.deliveryFees),
      discounts: num(discountRow?.discount),
      avgOrderValue: Number(avgOrder.toFixed(2)),
      paidOrders: totalDelivered,
    };
  }

  // ─── Top meals ─────────────────────────────────────────────────────────────

  async getTopMealsAnalytics(userId: string) {
    const restaurantId = await this.resolveRestaurantId(userId);
    const top = await this.topMeals(restaurantId, 10);
    return {
      data: { top },
      message: 'تم استرجاع الوجبات الأكثر مبيعًا.',
    };
  }

  private async topMeals(restaurantId: string, limit: number) {
    const rows = await this.itemRepo
      .createQueryBuilder('i')
      .innerJoin(OrderRead, 'o', 'o.id = i.order_id')
      .select('i.meal_id', 'mealId')
      .addSelect('MAX(i.meal_name_snapshot)', 'name')
      .addSelect('SUM(i.quantity)', 'qty')
      .addSelect('SUM(i.total_price)', 'revenue')
      .addSelect('COUNT(DISTINCT o.id)', 'orders')
      .where('o.restaurant_id = :rid', { rid: restaurantId })
      .andWhere('o.status NOT IN (:...excluded)', { excluded: NON_CANCELLED })
      .groupBy('i.meal_id')
      .orderBy('qty', 'DESC')
      .limit(limit)
      .getRawMany<{ mealId: string; name: string; qty: string; revenue: string; orders: string }>();
    return rows.map((r) => ({
      mealId: r.mealId,
      name: r.name,
      quantity: num(r.qty),
      revenue: num(r.revenue),
      orders: num(r.orders),
    }));
  }

  // ─── Customers ─────────────────────────────────────────────────────────────

  async getCustomersAnalytics(userId: string) {
    const restaurantId = await this.resolveRestaurantId(userId);
    const [counts, top] = await Promise.all([
      this.customerCounts(restaurantId),
      this.topCustomers(restaurantId, 10),
    ]);
    return {
      data: { ...counts, top },
      message: 'تم استرجاع تحليلات العملاء.',
    };
  }

  private async customerCounts(restaurantId: string) {
    const month = daysAgo(30);

    const baseQb = () =>
      this.orderRepo
        .createQueryBuilder('o')
        .where('o.restaurant_id = :rid', { rid: restaurantId })
        .andWhere('o.status NOT IN (:...excluded)', { excluded: NON_CANCELLED });

    const [uniqueRow, last30Row, repeatRow] = await Promise.all([
      baseQb()
        .select('COUNT(DISTINCT o.customer_id)', 'count')
        .getRawOne<{ count: string }>(),
      baseQb()
        .andWhere('o.created_at >= :d', { d: month })
        .select('COUNT(DISTINCT o.customer_id)', 'count')
        .getRawOne<{ count: string }>(),
      this.orderRepo
        .createQueryBuilder('o')
        .select('COUNT(*)', 'count')
        .where(
          (qb) =>
            'o.customer_id IN ' +
            qb
              .subQuery()
              .select('o2.customer_id')
              .from(OrderRead, 'o2')
              .where('o2.restaurant_id = :rid', { rid: restaurantId })
              .andWhere('o2.status NOT IN (:...excluded)', { excluded: NON_CANCELLED })
              .groupBy('o2.customer_id')
              .having('COUNT(o2.id) > 1')
              .getQuery(),
        )
        .andWhere('o.restaurant_id = :rid', { rid: restaurantId })
        .select('COUNT(DISTINCT o.customer_id)', 'count')
        .getRawOne<{ count: string }>(),
    ]);

    const total = num(uniqueRow?.count);
    const repeat = num(repeatRow?.count);
    const repeatRate = total > 0 ? (repeat / total) * 100 : 0;

    return {
      total,
      activeLast30Days: num(last30Row?.count),
      repeatCustomers: repeat,
      repeatRate: Number(repeatRate.toFixed(2)),
    };
  }

  private async topCustomers(restaurantId: string, limit: number) {
    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.customer_id', 'customerId')
      .addSelect('COUNT(o.id)', 'orders')
      .addSelect('COALESCE(SUM(o.total_amount), 0)', 'spent')
      .where('o.restaurant_id = :rid', { rid: restaurantId })
      .andWhere('o.status NOT IN (:...excluded)', { excluded: NON_CANCELLED })
      .groupBy('o.customer_id')
      .orderBy('orders', 'DESC')
      .limit(limit)
      .getRawMany<{ customerId: string; orders: string; spent: string }>();
    return rows.map((r) => ({
      customerId: r.customerId,
      orders: num(r.orders),
      spent: num(r.spent),
    }));
  }

  // ─── Ratings ───────────────────────────────────────────────────────────────

  async getRatingsAnalytics(userId: string) {
    const restaurantId = await this.resolveRestaurantId(userId);
    const [totals, distribution] = await Promise.all([
      this.ratingTotals(restaurantId),
      this.ratingDistribution(restaurantId),
    ]);
    return {
      data: { ...totals, distribution },
      message: 'تم استرجاع تحليلات التقييمات.',
    };
  }

  private async ratingTotals(restaurantId: string) {
    const row = await this.ratingRepo
      .createQueryBuilder('r')
      .innerJoin(OrderRead, 'o', 'o.id = r.order_id')
      .select('COALESCE(AVG(r.food_rating), 0)', 'avgFood')
      .addSelect('COALESCE(AVG(r.delivery_rating), 0)', 'avgDelivery')
      .addSelect('COUNT(*)', 'count')
      .where('o.restaurant_id = :rid', { rid: restaurantId })
      .getRawOne<{ avgFood: string; avgDelivery: string; count: string }>();
    return {
      avgFoodRating: Number(num(row?.avgFood).toFixed(2)),
      avgDeliveryRating: Number(num(row?.avgDelivery).toFixed(2)),
      totalRatings: num(row?.count),
    };
  }

  async listReviews(restaurantId: string, page = 1, limit = 20) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safePage = Math.max(page, 1);
    const skip = (safePage - 1) * safeLimit;

    const [rows, total] = await Promise.all([
      this.ratingRepo
        .createQueryBuilder('r')
        .innerJoin(OrderRead, 'o', 'o.id = r.order_id')
        .select([
          'r.id AS id',
          'r.order_id AS "orderId"',
          'r.customer_id AS "customerId"',
          'r.food_rating AS "foodRating"',
          'r.delivery_rating AS "deliveryRating"',
          'r.comment AS comment',
          'r.created_at AS "createdAt"',
        ])
        .where('o.restaurant_id = :rid', { rid: restaurantId })
        .orderBy('r.created_at', 'DESC')
        .offset(skip)
        .limit(safeLimit)
        .getRawMany<{
          id: string;
          orderId: string;
          customerId: string;
          foodRating: number;
          deliveryRating: number;
          comment: string | null;
          createdAt: Date;
        }>(),
      this.ratingRepo
        .createQueryBuilder('r')
        .innerJoin(OrderRead, 'o', 'o.id = r.order_id')
        .where('o.restaurant_id = :rid', { rid: restaurantId })
        .getCount(),
    ]);

    const [totals, distribution] = await Promise.all([
      this.ratingTotals(restaurantId),
      this.ratingDistribution(restaurantId),
    ]);

    return {
      data: {
        items: rows.map((r) => ({
          id: r.id,
          orderId: r.orderId,
          customerId: r.customerId,
          foodRating: Number(r.foodRating),
          deliveryRating: Number(r.deliveryRating),
          comment: r.comment ?? null,
          createdAt: r.createdAt,
        })),
        total,
        page: safePage,
        limit: safeLimit,
        summary: { ...totals, distribution },
      },
      message: 'تم استرجاع التقييمات.',
    };
  }

  async listOwnerReviews(userId: string, page = 1, limit = 20) {
    const restaurantId = await this.resolveRestaurantId(userId);
    return this.listReviews(restaurantId, page, limit);
  }

  private async ratingDistribution(restaurantId: string) {
    const rows = await this.ratingRepo
      .createQueryBuilder('r')
      .innerJoin(OrderRead, 'o', 'o.id = r.order_id')
      .select('r.food_rating', 'stars')
      .addSelect('COUNT(*)', 'count')
      .where('o.restaurant_id = :rid', { rid: restaurantId })
      .groupBy('r.food_rating')
      .orderBy('r.food_rating', 'DESC')
      .getRawMany<{ stars: number; count: string }>();
    return rows.map((r) => ({ stars: Number(r.stars), count: num(r.count) }));
  }

  // ─── Delivery ──────────────────────────────────────────────────────────────

  async getDeliveryAnalytics(userId: string) {
    const restaurantId = await this.resolveRestaurantId(userId);
    const row = await this.deliveryRepo
      .createQueryBuilder('d')
      .innerJoin(OrderRead, 'o', 'o.id = d.order_id')
      .select('d.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('o.restaurant_id = :rid', { rid: restaurantId })
      .groupBy('d.status')
      .getRawMany<{ status: string; count: string }>();

    const totalsRow = await this.deliveryRepo
      .createQueryBuilder('d')
      .innerJoin(OrderRead, 'o', 'o.id = d.order_id')
      .select('COUNT(*)', 'total')
      .addSelect(
        "SUM(CASE WHEN d.status = 'delivered' THEN 1 ELSE 0 END)",
        'completed',
      )
      .addSelect("SUM(CASE WHEN d.status = 'failed' THEN 1 ELSE 0 END)", 'failed')
      .addSelect('COALESCE(AVG(d.distance_km), 0)', 'avgDistance')
      .where('o.restaurant_id = :rid', { rid: restaurantId })
      .getRawOne<{ total: string; completed: string; failed: string; avgDistance: string }>();

    return {
      data: {
        total: num(totalsRow?.total),
        completed: num(totalsRow?.completed),
        failed: num(totalsRow?.failed),
        avgDistanceKm: Number(num(totalsRow?.avgDistance).toFixed(2)),
        byStatus: row.map((r) => ({ status: r.status, count: num(r.count) })),
      },
      message: 'تم استرجاع تحليلات التوصيل.',
    };
  }

  // ─── Menu ──────────────────────────────────────────────────────────────────

  private async menuCounts(restaurantId: string) {
    const [menus, sections, meals, available, featured] = await Promise.all([
      this.menuRepo.count({ where: { restaurantId } }),
      this.sectionRepo
        .createQueryBuilder('s')
        .innerJoin(Menu, 'm', 'm.id = s.menu_id')
        .where('m.restaurant_id = :rid', { rid: restaurantId })
        .getCount(),
      this.mealRepo.count({ where: { restaurantId } }),
      this.mealRepo.count({ where: { restaurantId, isAvailable: true } }),
      this.mealRepo.count({ where: { restaurantId, isFeatured: true } }),
    ]);
    return { menus, sections, meals, available, featured };
  }

  // ─── Payments ──────────────────────────────────────────────────────────────

  async getPaymentsAnalytics(userId: string) {
    const restaurantId = await this.resolveRestaurantId(userId);
    const [paid, unpaid, refunded, byMethod] = await Promise.all([
      this.orderRepo.count({ where: { restaurantId, paymentStatus: PaymentStatus.PAID } }),
      this.orderRepo.count({ where: { restaurantId, paymentStatus: PaymentStatus.UNPAID } }),
      this.orderRepo.count({ where: { restaurantId, paymentStatus: PaymentStatus.REFUNDED } }),
      this.orderCountByPaymentMethod(restaurantId),
    ]);
    return {
      data: { paid, unpaid, refunded, byMethod },
      message: 'تم استرجاع تحليلات المدفوعات.',
    };
  }
}
