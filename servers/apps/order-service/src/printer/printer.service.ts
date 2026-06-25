import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { printer as ThermalPrinter, types as PrinterTypes } from 'node-thermal-printer';
import { LocalOrder } from '../entities/local-order.entity';

interface RestaurantPrinterConfig {
  name: string;
  logo_url: string | null;
  kitchen_printer_ip: string | null;
  kitchen_printer_port: number;
  cashier_printer_ip: string | null;
  cashier_printer_port: number;
}

type PrintTarget = 'kitchen' | 'cashier' | 'both';

export interface PrintResult {
  target: 'kitchen' | 'cashier';
  attempted: boolean;
  success: boolean;
  error?: string;
}

/**
 * Sends ESC/POS commands to LAN-attached thermal printers over TCP 9100.
 * One restaurant can have two printers: a kitchen printer (items only, large
 * font, no prices) and a cashier printer (priced receipt for the customer).
 * Both are optional — when a target's IP is null the print is silently
 * skipped so the bill-close flow keeps working without printers configured.
 *
 * Library: node-thermal-printer in EPSON mode. Works with Epson TM-T20,
 * XPrinter, Bixolon, Sunmi, and most ESC/POS-compliant network printers.
 */
@Injectable()
export class PrinterService {
  private readonly logger = new Logger(PrinterService.name);

  constructor(
    @InjectRepository(LocalOrder) private readonly orderRepo: Repository<LocalOrder>,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Public entry points ──────────────────────────────────────────────────

  async printForOrder(orderId: string, target: PrintTarget): Promise<PrintResult[]> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['items', 'items.options'],
    });
    if (!order) throw new NotFoundException('الطلب غير موجود');

    const cfgRows: RestaurantPrinterConfig[] = await this.dataSource.query(
      `SELECT name, logo_url,
              kitchen_printer_ip, kitchen_printer_port,
              cashier_printer_ip, cashier_printer_port
         FROM restaurants
        WHERE id = $1
        LIMIT 1`,
      [order.restaurantId],
    );
    const cfg = cfgRows?.[0];
    if (!cfg) throw new NotFoundException('المطعم غير موجود');

    const results: PrintResult[] = [];
    if (target === 'kitchen' || target === 'both') {
      results.push(await this.printKitchen(order, cfg));
    }
    if (target === 'cashier' || target === 'both') {
      results.push(await this.printCashier(order, cfg));
    }
    return results;
  }

  // Fire-and-forget convenience for the close() flow — logs failures but
  // never throws so a printer outage doesn't fail the bill close.
  async printForOrderSafe(orderId: string, target: PrintTarget): Promise<void> {
    try {
      const results = await this.printForOrder(orderId, target);
      for (const r of results) {
        if (r.attempted && !r.success) {
          this.logger.warn({ msg: 'print_failed', orderId, target: r.target, error: r.error });
        }
      }
    } catch (err) {
      this.logger.warn({ msg: 'print_dispatch_failed', orderId, err });
    }
  }

  // ─── Per-printer formatting ───────────────────────────────────────────────

  private async printKitchen(order: LocalOrder, cfg: RestaurantPrinterConfig): Promise<PrintResult> {
    if (!cfg.kitchen_printer_ip) {
      return { target: 'kitchen', attempted: false, success: false };
    }
    return this.printTo('kitchen', cfg.kitchen_printer_ip, cfg.kitchen_printer_port, (p) => {
      p.alignCenter();
      p.setTextDoubleHeight();
      p.bold(true);
      p.println('-- KITCHEN --');
      p.bold(false);
      p.setTextNormal();
      p.alignCenter();
      p.println(cfg.name ?? '');
      p.drawLine();
      p.alignLeft();
      p.println(`Order: ${order.orderNumber}`);
      const stamp = new Date().toLocaleString('ar');
      p.println(`Time:  ${stamp}`);
      const service = order.serviceType === 'dine_in'
        ? `صالة · طاولة ${order.tableNumber ?? '—'}`
        : 'استلام';
      p.println(`Type:  ${service}`);
      if (order.customerNameSnapshot) p.println(`Cust:  ${order.customerNameSnapshot}`);
      p.drawLine();
      // Kitchen ticket: large items, NO prices.
      p.setTextDoubleHeight();
      for (const it of order.items ?? []) {
        p.bold(true);
        p.println(`${it.quantity} × ${it.mealNameSnapshot}`);
        p.bold(false);
        if (it.specialInstructions) {
          p.setTextNormal();
          p.println(`   * ${it.specialInstructions}`);
          p.setTextDoubleHeight();
        }
      }
      p.setTextNormal();
      p.drawLine();
      p.cut();
    });
  }

  private async printCashier(order: LocalOrder, cfg: RestaurantPrinterConfig): Promise<PrintResult> {
    if (!cfg.cashier_printer_ip) {
      return { target: 'cashier', attempted: false, success: false };
    }
    return this.printTo('cashier', cfg.cashier_printer_ip, cfg.cashier_printer_port, (p) => {
      p.alignCenter();
      p.setTextDoubleHeight();
      p.bold(true);
      p.println(cfg.name ?? '');
      p.bold(false);
      p.setTextNormal();
      const service = order.serviceType === 'dine_in'
        ? `صالة · طاولة ${order.tableNumber ?? '—'}`
        : 'استلام';
      p.println(service);
      p.drawLine();
      p.alignLeft();
      p.println(`Order: ${order.orderNumber}`);
      const stamp = new Date().toLocaleString('ar');
      p.println(`Date:  ${stamp}`);
      p.drawLine();
      for (const it of order.items ?? []) {
        const unit = Number(it.unitPriceSnapshot);
        const total = Number(it.totalPrice);
        // Two-line format keeps Arabic item names readable.
        p.leftRight(`${it.quantity} × ${unit.toFixed(2)}`, total.toFixed(2));
        p.println(it.mealNameSnapshot);
      }
      p.drawLine();
      p.alignRight();
      const subtotal = Number(order.subtotal);
      const discount = Number(order.discountAmount);
      const totalAmount = Number(order.totalAmount);
      p.leftRight('Subtotal', subtotal.toFixed(2));
      if (discount > 0) p.leftRight('Discount', `-${discount.toFixed(2)}`);
      p.bold(true);
      p.setTextDoubleHeight();
      p.leftRight('TOTAL', totalAmount.toFixed(2));
      p.setTextNormal();
      p.bold(false);
      p.alignCenter();
      p.println(' ');
      p.println('شكراً لزيارتكم');
      p.cut();
    });
  }

  // ─── Low-level: open TCP, run formatter, execute ──────────────────────────

  private async printTo(
    target: 'kitchen' | 'cashier',
    ip: string,
    port: number,
    format: (p: any) => void,
  ): Promise<PrintResult> {
    const printer = new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: `tcp://${ip}:${port || 9100}`,
      options: { timeout: 3000 },
    });

    try {
      const reachable = await printer.isPrinterConnected().catch(() => false);
      if (!reachable) {
        return {
          target,
          attempted: true,
          success: false,
          error: `Printer ${ip}:${port} unreachable`,
        };
      }
      format(printer);
      await printer.execute();
      this.logger.log({ msg: 'print_ok', target, ip });
      return { target, attempted: true, success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { target, attempted: true, success: false, error: message };
    }
  }
}
