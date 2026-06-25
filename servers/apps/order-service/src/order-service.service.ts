import { Injectable } from '@nestjs/common';

// Orchestration handled by sub-services (OrderService, CartService, ChatService, PromoService).
// This file is kept as a thin shell to satisfy module registration.
@Injectable()
export class OrderServiceService {}
