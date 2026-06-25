import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Between, Repository } from "typeorm";
import { Restaurant } from "../entities/restaurant.entity";
import { ExpenseCategory, RestaurantExpense } from "../entities/restaurant-expense.entity";
import {
  AccountingSummaryDto,
  CreateExpenseDto,
  ListExpensesDto,
  UpdateExpenseDto,
} from "../dto/expense.dto";

interface RevenueRow {
  pos_revenue: string;
  online_revenue: string;
  pos_orders: string;
  online_orders: string;
}

@Injectable()
export class AccountingService {
  constructor(
    @InjectRepository(RestaurantExpense)
    private readonly expenseRepo: Repository<RestaurantExpense>,
    @InjectRepository(Restaurant)
    private readonly restaurantRepo: Repository<Restaurant>,
  ) {}

  // ─── Auth / scoping ──────────────────────────────────────────────────────

  private async resolveOwnedRestaurant(userId: string, role: string): Promise<string> {
    if (role === "manager") {
      throw new BadRequestException("manager must specify a restaurantId");
    }
    const r = await this.restaurantRepo.findOne({ where: { ownerUserId: userId } });
    if (!r) throw new NotFoundException("لم يتم العثور على مطعم");
    return r.id;
  }

  private async assertExpenseAccess(expense: RestaurantExpense, userId: string, role: string) {
    if (role === "manager") return;
    const r = await this.restaurantRepo.findOne({ where: { id: expense.restaurantId } });
    if (!r || r.ownerUserId !== userId) {
      throw new ForbiddenException("غير مصرح");
    }
  }

  // ─── Time-range helpers ──────────────────────────────────────────────────

  private resolveRange(dto: AccountingSummaryDto): { from: Date; to: Date } {
    const now = new Date();
    const to = dto.to ? new Date(dto.to) : now;
    let from: Date;

    switch (dto.period ?? "month") {
      case "today": {
        from = new Date(now);
        from.setHours(0, 0, 0, 0);
        break;
      }
      case "week": {
        from = new Date(now);
        from.setDate(now.getDate() - 7);
        break;
      }
      case "custom": {
        if (!dto.from) {
          throw new BadRequestException("`from` مطلوب عند اختيار فترة مخصصة");
        }
        from = new Date(dto.from);
        break;
      }
      case "month":
      default: {
        from = new Date(now);
        from.setDate(now.getDate() - 30);
        break;
      }
    }
    return { from, to };
  }

  // ─── Expenses CRUD ───────────────────────────────────────────────────────

  async listExpenses(userId: string, role: string, query: ListExpensesDto) {
    const restaurantId = await this.resolveOwnedRestaurant(userId, role);
    const where: any = { restaurantId };
    if (query.category) where.category = query.category;
    if (query.from && query.to) {
      where.occurredAt = Between(new Date(query.from), new Date(query.to));
    }
    return this.expenseRepo.find({
      where,
      order: { occurredAt: "DESC" },
      take: 200,
    });
  }

  async createExpense(userId: string, role: string, dto: CreateExpenseDto) {
    const restaurantId = await this.resolveOwnedRestaurant(userId, role);
    const expense = this.expenseRepo.create({
      restaurantId,
      amount: dto.amount,
      category: dto.category,
      description: dto.description ?? null,
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
      createdByUserId: userId,
    });
    return this.expenseRepo.save(expense);
  }

  async updateExpense(id: string, userId: string, role: string, dto: UpdateExpenseDto) {
    const expense = await this.expenseRepo.findOne({ where: { id } });
    if (!expense) throw new NotFoundException("المصروف غير موجود");
    await this.assertExpenseAccess(expense, userId, role);

    Object.assign(expense, {
      amount: dto.amount ?? expense.amount,
      category: dto.category ?? expense.category,
      description: dto.description ?? expense.description,
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : expense.occurredAt,
    });
    return this.expenseRepo.save(expense);
  }

  async deleteExpense(id: string, userId: string, role: string) {
    const expense = await this.expenseRepo.findOne({ where: { id } });
    if (!expense) throw new NotFoundException("المصروف غير موجود");
    await this.assertExpenseAccess(expense, userId, role);
    await this.expenseRepo.delete(id);
  }

  // ─── Summary (revenue from orders + expenses) ────────────────────────────

  async getSummary(userId: string, role: string, dto: AccountingSummaryDto) {
    const restaurantId = await this.resolveOwnedRestaurant(userId, role);
    const { from, to } = this.resolveRange(dto);

    // Revenue: total amount of every non-cancelled order in the window.
    // POS bills exclude 'voided'; online orders exclude 'cancelled' and
    // 'refunded'. Everything else counts as recognized revenue (matches
    // the "all orders count" view requested by staff).
    const revenueRows: RevenueRow[] = await this.expenseRepo.manager.query(
      `SELECT
         COALESCE(SUM(CASE WHEN o.kind = 'local'
                            AND o.local_status NOT IN ('voided')
                           THEN o.total_amount ELSE 0 END), 0)              AS pos_revenue,
         COALESCE(SUM(CASE WHEN o.kind = 'online'
                            AND o.status NOT IN ('cancelled', 'refunded')
                           THEN o.total_amount ELSE 0 END), 0)              AS online_revenue,
         COUNT(*) FILTER (WHERE o.kind = 'local'
                            AND o.local_status NOT IN ('voided'))           AS pos_orders,
         COUNT(*) FILTER (WHERE o.kind = 'online'
                            AND o.status NOT IN ('cancelled', 'refunded'))  AS online_orders
       FROM orders o
       WHERE o.restaurant_id = $1
         AND o.created_at BETWEEN $2 AND $3`,
      [restaurantId, from, to],
    );
    const rev = revenueRows[0];
    const posRevenue = Number(rev?.pos_revenue ?? 0);
    const onlineRevenue = Number(rev?.online_revenue ?? 0);
    const totalRevenue = posRevenue + onlineRevenue;

    // Expenses bucketed by category for the same range.
    const expenseRows: Array<{ category: ExpenseCategory; total: string; count: string }> =
      await this.expenseRepo.manager.query(
        `SELECT e.category,
                COALESCE(SUM(e.amount), 0) AS total,
                COUNT(*) AS count
           FROM restaurant_expenses e
          WHERE e.restaurant_id = $1
            AND e.occurred_at BETWEEN $2 AND $3
          GROUP BY e.category`,
        [restaurantId, from, to],
      );
    const expensesByCategory: Record<ExpenseCategory, number> = {
      [ExpenseCategory.RENT]: 0,
      [ExpenseCategory.SALARIES]: 0,
      [ExpenseCategory.SUPPLIES]: 0,
      [ExpenseCategory.UTILITIES]: 0,
      [ExpenseCategory.OTHER]: 0,
    };
    let totalExpenses = 0;
    let expenseCount = 0;
    for (const row of expenseRows) {
      const amount = Number(row.total);
      expensesByCategory[row.category] = amount;
      totalExpenses += amount;
      expenseCount += Number(row.count);
    }

    const netProfit = totalRevenue - totalExpenses;

    return {
      period: { from, to, label: dto.period ?? "month" },
      revenue: {
        total: totalRevenue,
        pos: posRevenue,
        online: onlineRevenue,
        posOrders: Number(rev?.pos_orders ?? 0),
        onlineOrders: Number(rev?.online_orders ?? 0),
      },
      expenses: {
        total: totalExpenses,
        count: expenseCount,
        byCategory: expensesByCategory,
      },
      netProfit,
    };
  }
}
