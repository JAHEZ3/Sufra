import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { OrderKind, PaymentMethod } from '../entities/order-enums';

/**
 * Customer's chosen fulfilment mode at checkout.
 *  - `delivery`  — driver brings the order to the saved address.
 *  - `pickup`    — customer collects from the restaurant. `addressId` is still
 *                  required (for tax/billing) but no driver is assigned.
 *  - `scheduled` — same as delivery, but executes at `scheduledFor`.
 */
export enum OrderType {
  DELIVERY = 'delivery',
  PICKUP = 'pickup',
  SCHEDULED = 'scheduled',
}

export class CheckoutDto {
  // Client-generated UUID. The server uses it to detect duplicate submissions
  // without requiring the client to know its own orderId in advance.
  // Passed via the Idempotency-Key header (extracted by the controller).
  @IsOptional()
  @IsUUID()
  idempotencyKey?: string;

  @IsUUID()
  addressId: string;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  // Defaults to `delivery` server-side when omitted, so existing clients
  // that only know about the original checkout shape keep working.
  @IsOptional()
  @IsEnum(OrderType)
  orderType?: OrderType;

  // ISO timestamp; required when `orderType === 'scheduled'`. The order is
  // still persisted as `pending` immediately — the restaurant only sees it
  // appear in their queue close to `scheduledFor`.
  @IsOptional()
  @IsDateString()
  scheduledFor?: string;

  @IsOptional()
  @IsString()
  promoCode?: string;

  @IsOptional()
  @IsString()
  customerNotes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryFee?: number;

  // Snapshot of address passed from client (validated server-side)
  @IsOptional()
  addressSnapshot?: {
    street: string;
    city: string;
    lat: number;
    lng: number;
    label?: string;
  };

  // Snapshots of customer info for the receipt
  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  // Restaurant ownerUserId — for WS room targeting
  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  // Restaurant name snapshot
  @IsOptional()
  @IsString()
  restaurantName?: string;
}

export class UpdateOrderStatusDto {
  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  note?: string;
}

/**
 * Restaurant owner / manager toggles `unpaid` ↔ `paid` after verifying the
 * customer's uploaded bank-transfer / wallet receipt for online payments.
 * `note` is optional but useful for audit purposes ("Verified IBAN", "Wrong
 * amount received", etc.).
 */
export class UpdatePaymentStatusDto {
  @IsEnum(['paid', 'unpaid'], {
    message: 'حالة الدفع يجب أن تكون paid أو unpaid',
  })
  paymentStatus: 'paid' | 'unpaid';

  @IsOptional()
  @IsString()
  note?: string;
}

export class AssignDeliveryDto {
  @IsUUID()
  deliveryAgentId: string;
}

export class RateOrderDto {
  @IsNumber()
  @Min(1)
  foodRating: number;

  @IsNumber()
  @Min(1)
  deliveryRating: number;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class OrderFilterDto {
  // 'online' (delivery) or 'local' (POS). Defaults to 'online' so existing
  // callers see no behavior change.
  @IsOptional()
  @IsEnum(OrderKind)
  kind?: OrderKind;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsUUID()
  restaurantId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}
