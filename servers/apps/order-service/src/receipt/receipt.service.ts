import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { CartItem } from '../cart/cart.service';
import { OnlineOrder as Order } from '../entities/online-order.entity';

@Injectable()
export class ReceiptService {
  private readonly logger = new Logger(ReceiptService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    this.s3 = new S3Client({
      region: config.get<string>('AWS_REGION'),
      credentials: {
        accessKeyId: config.get<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: config.get<string>('AWS_SECRET_ACCESS_KEY'),
      },
    });
    this.bucket = config.get<string>('AWS_S3_BUCKET');
  }

  async generateAndUpload(order: Order, items: CartItem[]): Promise<string> {
    const html = this.buildHtml(order, items);
    const key = `receipts/${order.id}.html`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: Buffer.from(html, 'utf-8'),
        ContentType: 'text/html; charset=utf-8',
        Metadata: {
          orderNumber: order.orderNumber,
          restaurantName: order.restaurantNameSnapshot ?? '',
        },
      }),
    );

    return key;
  }

  async getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn },
    );
  }

  private buildHtml(order: Order, items: CartItem[]): string {
    const itemRows = items
      .map(
        (i) => `
        <tr>
          <td style="padding:6px 4px;border-bottom:1px solid #f0f0f0">${i.mealName}</td>
          <td style="padding:6px 4px;border-bottom:1px solid #f0f0f0;text-align:center">${i.quantity}</td>
          <td style="padding:6px 4px;border-bottom:1px solid #f0f0f0;text-align:right">${Number(i.unitPrice).toFixed(2)} شيكل</td>
          <td style="padding:6px 4px;border-bottom:1px solid #f0f0f0;text-align:right">${Number(i.totalPrice).toFixed(2)} شيكل</td>
        </tr>
        ${
          i.options?.length
            ? `<tr><td colspan="4" style="padding:2px 4px 8px 12px;color:#666;font-size:12px">
                الإضافات: ${i.options.map((o) => o.optionName).join(', ')}
               </td></tr>`
            : ''
        }
      `,
      )
      .join('');

    return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 24px; color: #222; background: #fff; }
    .header { text-align: center; border-bottom: 2px solid #f55905; padding-bottom: 16px; margin-bottom: 16px; }
    .logo { font-size: 28px; font-weight: 900; color: #f55905; }
    .order-num { font-size: 14px; color: #666; margin-top: 4px; }
    .section { margin-bottom: 16px; }
    .section-title { font-weight: 700; font-size: 13px; color: #555; text-transform: uppercase; margin-bottom: 6px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { background: #fafafa; padding: 8px 4px; text-align: right; font-size: 12px; color: #666; }
    .totals td { padding: 4px; font-size: 14px; }
    .totals .total-row td { font-weight: 700; font-size: 16px; border-top: 2px solid #f55905; padding-top: 8px; }
    .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">جاهز</div>
    <div class="order-num">رقم الطلب: ${order.orderNumber}</div>
    <div style="font-size:12px;color:#888;margin-top:4px">${new Date(order.createdAt).toLocaleString('ar-SA')}</div>
  </div>

  <div class="section">
    <div class="section-title">معلومات الطلب</div>
    <table>
      <tr><td style="color:#666;width:40%">المطعم</td><td>${order.restaurantNameSnapshot ?? '—'}</td></tr>
      <tr><td style="color:#666">العميل</td><td>${order.customerNameSnapshot ?? '—'}</td></tr>
      <tr><td style="color:#666">الهاتف</td><td>${order.customerPhoneSnapshot ?? '—'}</td></tr>
      ${order.deliveryAddressSnapshot ? `<tr><td style="color:#666">العنوان</td><td>${order.deliveryAddressSnapshot.street}, ${order.deliveryAddressSnapshot.city}</td></tr>` : ''}
      <tr><td style="color:#666">طريقة الدفع</td><td>${order.paymentMethod}</td></tr>
      ${order.customerNotes ? `<tr><td style="color:#666">ملاحظات</td><td>${order.customerNotes}</td></tr>` : ''}
    </table>
  </div>

  <div class="section">
    <div class="section-title">الطلبات</div>
    <table>
      <thead>
        <tr>
          <th>الوجبة</th>
          <th style="text-align:center">الكمية</th>
          <th style="text-align:right">سعر الوحدة</th>
          <th style="text-align:right">المجموع</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
  </div>

  <div class="section">
    <table class="totals">
      <tr><td style="color:#666">المجموع الجزئي</td><td style="text-align:left">${Number(order.subtotal).toFixed(2)} شيكل</td></tr>
      ${Number(order.deliveryFee) > 0 ? `<tr><td style="color:#666">رسوم التوصيل</td><td style="text-align:left">${Number(order.deliveryFee).toFixed(2)} شيكل</td></tr>` : ''}
      ${Number(order.discountAmount) > 0 ? `<tr><td style="color:#e53">خصم الكوبون</td><td style="text-align:left;color:#e53">- ${Number(order.discountAmount).toFixed(2)} شيكل</td></tr>` : ''}
      <tr class="total-row"><td>الإجمالي</td><td style="text-align:left">${Number(order.totalAmount).toFixed(2)} شيكل</td></tr>
    </table>
  </div>

  <div class="footer">شكراً لطلبك من جاهز — ${new Date().getFullYear()}</div>
</body>
</html>`;
  }
}
