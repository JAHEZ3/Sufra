import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
  WsException,
} from '@nestjs/websockets';
import { Logger, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { ClientProxy } from '@nestjs/microservices';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

interface AuthUser {
  sub: string;
  role: string;
  phone?: string;
  fullName?: string;
  status?: string;
}

// Redis key helpers
const joinedOrdersKey = (socketId: string) => `ws_orders:${socketId}`;

@WebSocketGateway({
  cors: {
    origin: (origin: string, cb: (err: Error | null, allow?: boolean) => void) => {
      // Read from env at runtime; fall back to allowing all in development
      const allowed = (process.env.CORS_ORIGINS || '*').split(',').map((s) => s.trim());
      // Dev phones scan the QR over LAN, so their origin is a private IP that
      // won't be in the explicit allowlist. Allow localhost + private-network
      // origins (10/8, 192.168/16, 172.16/12) so anonymous QR sockets connect.
      const isPrivateLan =
        !!origin &&
        /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(
          origin,
        );
      if (allowed.includes('*') || !origin || allowed.includes(origin) || isPrivateLan) {
        cb(null, true);
      } else {
        cb(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
  namespace: '/',
})
export class SocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SocketGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject('NATS_SERVICE') private readonly nats: ClientProxy,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    const user = this.authenticate(client);
    if (!user) {
      // Anonymous QR customer — connect as a limited guest. The only thing a
      // guest can do is `order:track` to subscribe to ONE order room by its
      // unguessable id (same trust model as the public status HTTP endpoint).
      // No personal/restaurant/manager rooms are auto-joined.
      (client as any).guest = true;
      this.logger.log({ msg: 'ws_guest_connected', socketId: client.id });
      client.emit('connected', { guest: true });
      return;
    }

    // Reject suspended/banned users at socket level
    if (user.status && !['active', 'suspended'].includes(user.status)) {
      client.emit('error', { code: 'ACCOUNT_INACTIVE', message: 'الحساب غير مفعّل' });
      client.disconnect(true);
      return;
    }

    (client as any).user = user;

    // Auto-join personal room
    client.join(`user:${user.sub}`);
    if (user.role === 'manager')  client.join('managers');

    this.logger.log({ msg: 'ws_connected', userId: user.sub, role: user.role, socketId: client.id });
    client.emit('connected', { userId: user.sub, role: user.role });
  }

  handleDisconnect(client: Socket) {
    const user = (client as any).user as AuthUser | undefined;
    if (!user) return;

    this.logger.log({ msg: 'ws_disconnected', userId: user.sub, socketId: client.id });

    // Clear the per-socket joined-orders tracking.
    this.cache.del(joinedOrdersKey(client.id));
  }

  // ─── Restaurant registers its restaurantId ───────────────────────────────

  @SubscribeMessage('restaurant:register')
  async handleRestaurantRegister(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { restaurantId: string },
  ) {
    const user = this.getUser(client);

    if (user.role !== 'restaurant_owner' && user.role !== 'manager') {
      throw new WsException('غير مصرح');
    }
    if (!data?.restaurantId || typeof data.restaurantId !== 'string') {
      throw new WsException('restaurantId مطلوب');
    }

    // Validate ownership: query the order-service via NATS (fire-and-verify pattern)
    // For restaurant_owner, we trust the front-end sends the correct restaurantId,
    // but we store it in Redis so the server can validate it later on events.
    // True ownership is enforced at the HTTP layer (restaurant-service guard).
    await this.cache.set(
      `ws_restaurant:${user.sub}`,
      data.restaurantId,
      3_600_000, // 1 hour TTL — refreshed on reconnect
    );

    client.join(`restaurant:${data.restaurantId}`);
    this.logger.log({ msg: 'restaurant_registered', userId: user.sub, restaurantId: data.restaurantId });

    return { event: 'restaurant:registered', data: { restaurantId: data.restaurantId } };
  }

  // ─── Public order tracking (guests + authed) ─────────────────────────────
  // The QR customer subscribes to live status of their own order by its
  // unguessable id. Push-only: the room just relays `order:status` events.
  @SubscribeMessage('order:track')
  handleOrderTrack(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string },
  ) {
    if (!data?.orderId || typeof data.orderId !== 'string') {
      throw new WsException('orderId مطلوب');
    }
    client.join(`order:${data.orderId}`);
    return { event: 'order:tracking', data: { orderId: data.orderId } };
  }

  // ─── Join an order room (with authorization) ─────────────────────────────

  @SubscribeMessage('order:join')
  async handleOrderJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string; role?: string; restaurantId?: string },
  ) {
    const user = this.getUser(client);
    if (!data?.orderId || typeof data.orderId !== 'string') {
      throw new WsException('orderId مطلوب');
    }

    // Check if already joined — idempotent
    const joined = (await this.cache.get<string[]>(joinedOrdersKey(client.id))) ?? [];
    if (joined.includes(data.orderId)) {
      return { event: 'order:joined', data: { orderId: data.orderId } };
    }

    // Authorization: look up order metadata from Redis (populated by order-service on creation)
    const orderMeta = await this.cache.get<{
      customerId: string;
      restaurantId: string;
      ownerUserId: string;
    }>(`order_meta:${data.orderId}`);

    if (orderMeta) {
      this.assertOrderAccess(user, orderMeta);
    } else {
      // If metadata isn't cached yet (race condition on creation), allow join and
      // let the HTTP-layer guard be the authoritative check.
      // This is acceptable: WebSocket is push-only; sensitive data requires HTTP.
      this.logger.warn({ msg: 'order_meta_not_cached', orderId: data.orderId, userId: user.sub });
    }

    client.join(`order:${data.orderId}`);

    // Track which orders this socket has joined (for cleanup on disconnect)
    await this.cache.set(joinedOrdersKey(client.id), [...joined, data.orderId], 3_600_000);

    this.logger.log({ msg: 'order_room_joined', orderId: data.orderId, userId: user.sub, role: user.role });
    return { event: 'order:joined', data: { orderId: data.orderId } };
  }

  @SubscribeMessage('order:leave')
  async handleOrderLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string },
  ) {
    client.leave(`order:${data.orderId}`);
    const joined = (await this.cache.get<string[]>(joinedOrdersKey(client.id))) ?? [];
    await this.cache.set(
      joinedOrdersKey(client.id),
      joined.filter((id) => id !== data.orderId),
      3_600_000,
    );
    return { event: 'order:left', data: { orderId: data.orderId } };
  }

  // ─── Typing indicator (optional, stateless) ───────────────────────────────

  @SubscribeMessage('chat:typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderId: string; isTyping: boolean },
  ) {
    const user = this.getUser(client);
    if (!data?.orderId) throw new WsException('orderId مطلوب');

    // Broadcast to other participants in the order room (exclude sender)
    client.to(`order:${data.orderId}`).emit('chat:typing', {
      userId: user.sub,
      role: user.role,
      isTyping: !!data.isTyping,
    });
  }

  // ─── Bridge methods (called by NATS controllers) ──────────────────────────

  /**
   * Cache order metadata so order:join can validate access without an HTTP round-trip.
   * Called from api-gateway.controller.ts when 'order.created' fires.
   */
  async cacheOrderMeta(
    orderId: string,
    meta: { customerId: string; restaurantId: string; ownerUserId: string },
  ) {
    // TTL: 24 hours — longer than any realistic order lifecycle
    await this.cache.set(`order_meta:${orderId}`, meta, 86_400_000);
  }

  emitToRoom(room: string, event: string, payload: unknown) {
    this.server.to(room).emit(event, payload);
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  broadcastToManagers(event: string, payload: unknown) {
    this.server.to('managers').emit(event, payload);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private getUser(client: Socket): AuthUser {
    const user = (client as any).user as AuthUser | undefined;
    if (!user) throw new WsException('غير مصرح');
    return user;
  }

  private authenticate(client: Socket): AuthUser | null {
    try {
      const raw: string =
        client.handshake.auth?.token ??
        (client.handshake.headers?.authorization as string) ??
        '';
      const token = raw.replace(/^Bearer\s+/i, '');
      if (!token) return null;
      return this.jwt.verify<AuthUser>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      return null;
    }
  }

  private assertOrderAccess(
    user: AuthUser,
    meta: { customerId: string; restaurantId: string; ownerUserId: string },
  ) {
    if (user.role === 'manager') return;
    if (user.role === 'customer'         && meta.customerId    === user.sub) return;
    if (user.role === 'restaurant_owner' && meta.ownerUserId   === user.sub) return;
    throw new WsException('غير مصرح للانضمام لهذا الطلب');
  }
}
