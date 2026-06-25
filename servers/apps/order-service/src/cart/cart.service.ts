import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { AddToCartDto, UpdateCartItemDto } from './cart.dto';

export interface CartOption {
  optionId: string;
  optionName: string;
  extraPrice: number;
}

export interface CartItem {
  mealId: string;
  mealName: string;
  mealImage: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  specialInstructions?: string;
  options: CartOption[];
}

export interface Cart {
  restaurantId: string;
  restaurantName: string;
  items: CartItem[];
  subtotal: number;
}

const CART_TTL_MS = 86_400_000; // 24 hours

@Injectable()
export class CartService {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  private key(userId: string) {
    return `cart:${userId}`;
  }

  async get(userId: string): Promise<Cart | null> {
    return this.cache.get<Cart>(this.key(userId));
  }

  async add(userId: string, dto: AddToCartDto): Promise<Cart> {
    let cart = await this.get(userId);

    if (cart && cart.restaurantId !== dto.restaurantId) {
      throw new BadRequestException(
        'لا يمكنك إضافة وجبات من مطعم مختلف — يرجى مسح السلة أولاً',
      );
    }

    const options: CartOption[] = (dto.options ?? []).map((o) => ({
      optionId: o.optionId,
      optionName: o.optionName,
      extraPrice: Number(o.extraPrice),
    }));
    const unitPrice = Number(dto.basePrice) + options.reduce((s, o) => s + o.extraPrice, 0);

    if (!cart) {
      cart = { restaurantId: dto.restaurantId, restaurantName: dto.restaurantName, items: [], subtotal: 0 };
    }

    const existingIdx = cart.items.findIndex(
      (i) =>
        i.mealId === dto.mealId &&
        JSON.stringify(i.options.map((o) => o.optionId).sort()) ===
          JSON.stringify(options.map((o) => o.optionId).sort()),
    );

    if (existingIdx !== -1) {
      const item = cart.items[existingIdx];
      item.quantity += dto.quantity;
      item.totalPrice = item.unitPrice * item.quantity;
    } else {
      cart.items.push({
        mealId: dto.mealId,
        mealName: dto.mealName,
        mealImage: dto.mealImage ?? '',
        unitPrice,
        quantity: dto.quantity,
        totalPrice: unitPrice * dto.quantity,
        specialInstructions: dto.specialInstructions,
        options,
      });
    }

    cart.subtotal = cart.items.reduce((s, i) => s + i.totalPrice, 0);
    await this.cache.set(this.key(userId), cart, CART_TTL_MS);
    return cart;
  }

  async update(userId: string, mealId: string, dto: UpdateCartItemDto): Promise<Cart> {
    const cart = await this.get(userId);
    if (!cart) throw new BadRequestException('السلة فارغة');

    const idx = cart.items.findIndex((i) => i.mealId === mealId);
    if (idx === -1) throw new BadRequestException('الوجبة غير موجودة في السلة');

    if (dto.quantity === 0) {
      cart.items.splice(idx, 1);
    } else {
      cart.items[idx].quantity = dto.quantity;
      cart.items[idx].totalPrice = cart.items[idx].unitPrice * dto.quantity;
      if (dto.specialInstructions !== undefined) {
        cart.items[idx].specialInstructions = dto.specialInstructions;
      }
    }

    cart.subtotal = cart.items.reduce((s, i) => s + i.totalPrice, 0);

    if (cart.items.length === 0) {
      await this.cache.del(this.key(userId));
      return { ...cart, items: [] };
    }

    await this.cache.set(this.key(userId), cart, CART_TTL_MS);
    return cart;
  }

  async removeItem(userId: string, mealId: string): Promise<Cart> {
    return this.update(userId, mealId, { quantity: 0 });
  }

  async clear(userId: string): Promise<void> {
    await this.cache.del(this.key(userId));
  }
}
