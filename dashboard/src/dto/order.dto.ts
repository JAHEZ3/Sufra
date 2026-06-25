import { OrderStatus } from "@/types/order.types";

export interface UpdateOrderStatusDto {
  status: OrderStatus;
  note?: string;
}

export interface OrderQueryDto {
  status?: OrderStatus;
  page?: number;
  limit?: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}
