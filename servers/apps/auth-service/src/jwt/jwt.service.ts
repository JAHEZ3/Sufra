import {
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { RefreshToken } from '../entities/refresh-token.entity';

export interface JwtPayload {
  sub: string;
  jti: string;
  role: string;
  phone?: string;
  email?: string;
  /** true once the user has completed their profile (customer activated / delivery-restaurant submitted request). */
  profileCompleted?: boolean;
}

export interface SessionContext {
  ip?: string;
  userAgent?: string;
  deviceInfo?: Record<string, any>;
}

interface RefreshTokenCache {
  userId: string;
  createdAt: number;
  lastUsedAt: number;
  expiresAt: number;
  ip?: string;
  userAgent?: string;
  deviceInfo?: Record<string, any>;
}

export interface SessionSummary {
  id: string;
  createdAt: number;
  lastUsedAt: number;
  ip?: string;
  userAgent?: string;
  deviceInfo?: Record<string, any>;
}

const RT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Issues / verifies / revokes JWT access + refresh tokens.
 *
 * Refresh tokens are persisted in Postgres ({@link RefreshToken}) as the source
 * of truth so sessions survive a Redis flush/restart (true persistent login).
 * Redis is kept as a best-effort hot cache in front of the DB to keep the very
 * common `verifyRefreshToken` path fast and to avoid a DB hit on every request
 * that triggers a token refresh.
 */
@Injectable()
export class AppJwtService implements OnModuleInit {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @InjectRepository(RefreshToken)
    private readonly refreshRepo: Repository<RefreshToken>,
  ) {}

  onModuleInit() {
    const accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET');
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    if (!accessSecret || !refreshSecret) {
      throw new Error(
        'FATAL: JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set in environment variables. Refusing to start.',
      );
    }
  }

  private get accessSecret(): string {
    return this.configService.get<string>('JWT_ACCESS_SECRET')!;
  }

  private get refreshSecret(): string {
    return this.configService.get<string>('JWT_REFRESH_SECRET')!;
  }

  private rtKey(jti: string): string {
    return `rt:${jti}`;
  }

  // ─── Access Token ─────────────────────────────────────────────────────────────

  signAccessToken(payload: Omit<JwtPayload, 'jti'>): string {
    return this.jwtService.sign(payload, {
      secret: this.accessSecret,
      expiresIn: '30m',
    });
  }

  verifyAccessToken(token: string): JwtPayload {
    try {
      return this.jwtService.verify<JwtPayload>(token, { secret: this.accessSecret });
    } catch {
      throw new UnauthorizedException('رمز الوصول غير صالح أو منتهي الصلاحية.');
    }
  }

  // ─── Refresh Token ────────────────────────────────────────────────────────────

  async signRefreshToken(
    payload: Omit<JwtPayload, 'jti'>,
    context?: SessionContext,
  ): Promise<string> {
    const jti = randomUUID();
    const now = Date.now();
    const expiresAt = now + RT_TTL_MS;

    const token = this.jwtService.sign(
      { ...payload, jti },
      { secret: this.refreshSecret, expiresIn: '30d' },
    );

    // Source of truth: persist the session row.
    await this.refreshRepo.save(
      this.refreshRepo.create({
        jti,
        userId: payload.sub,
        ip: context?.ip ?? null,
        userAgent: context?.userAgent ?? null,
        deviceInfo: context?.deviceInfo ?? null,
        lastUsedAt: new Date(now),
        expiresAt: new Date(expiresAt),
      }),
    );

    // Hot cache (best-effort).
    await this.cacheSet(jti, {
      userId: payload.sub,
      createdAt: now,
      lastUsedAt: now,
      expiresAt,
      ...(context?.ip && { ip: context.ip }),
      ...(context?.userAgent && { userAgent: context.userAgent }),
      ...(context?.deviceInfo && { deviceInfo: context.deviceInfo }),
    });

    return token;
  }

  async verifyRefreshToken(token: string): Promise<JwtPayload> {
    let decoded: JwtPayload;
    try {
      decoded = this.jwtService.verify<JwtPayload>(token, { secret: this.refreshSecret });
    } catch {
      throw new UnauthorizedException('رمز التحديث غير صالح أو منتهي الصلاحية.');
    }

    // Fast path: trust the Redis cache when present.
    const cached = await this.cacheGet(decoded.jti);
    if (cached) {
      this.touch(decoded.jti, cached).catch(() => undefined);
      return decoded;
    }

    // Cache miss → fall back to the durable record. This is what makes the
    // session survive a Redis flush: the row is still here.
    const row = await this.refreshRepo.findOne({ where: { jti: decoded.jti } });
    if (!row || row.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('رمز التحديث ملغى أو غير موجود.');
    }

    // Re-warm the cache and stamp last-used.
    const now = Date.now();
    row.lastUsedAt = new Date(now);
    await this.refreshRepo.save(row).catch(() => undefined);
    await this.cacheSet(decoded.jti, {
      userId: row.userId,
      createdAt: row.createdAt.getTime(),
      lastUsedAt: now,
      expiresAt: row.expiresAt.getTime(),
      ...(row.ip && { ip: row.ip }),
      ...(row.userAgent && { userAgent: row.userAgent }),
      ...(row.deviceInfo && { deviceInfo: row.deviceInfo }),
    });

    return decoded;
  }

  async revokeRefreshToken(token: string): Promise<void> {
    let decoded: JwtPayload;
    try {
      decoded = this.jwtService.verify<JwtPayload>(token, { secret: this.refreshSecret });
    } catch {
      return;
    }
    await this.cache.del(this.rtKey(decoded.jti)).catch(() => undefined);
    await this.refreshRepo.delete({ jti: decoded.jti });
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    const rows = await this.refreshRepo.find({ where: { userId } });
    await Promise.all(
      rows.map((r) => this.cache.del(this.rtKey(r.jti)).catch(() => undefined)),
    );
    await this.refreshRepo.delete({ userId });
  }

  // ─── Sessions ─────────────────────────────────────────────────────────────────

  async listSessions(userId: string): Promise<SessionSummary[]> {
    // Best-effort purge of expired rows for this user.
    await this.refreshRepo
      .delete({ userId, expiresAt: LessThan(new Date()) })
      .catch(() => undefined);

    const rows = await this.refreshRepo.find({ where: { userId } });
    return rows
      .map((r) => ({
        id: r.jti,
        createdAt: r.createdAt.getTime(),
        lastUsedAt: r.lastUsedAt.getTime(),
        ...(r.ip && { ip: r.ip }),
        ...(r.userAgent && { userAgent: r.userAgent }),
        ...(r.deviceInfo && { deviceInfo: r.deviceInfo }),
      }))
      .sort((a, b) => b.lastUsedAt - a.lastUsedAt);
  }

  /** Resolve a refresh token to its jti without throwing if it's already revoked. */
  decodeJtiFromRefreshToken(token: string): string | null {
    try {
      const decoded = this.jwtService.verify<JwtPayload>(token, { secret: this.refreshSecret });
      return decoded.jti ?? null;
    } catch {
      return null;
    }
  }

  async revokeSessionByJti(userId: string, jti: string): Promise<void> {
    const row = await this.refreshRepo.findOne({ where: { jti } });
    if (!row || row.userId !== userId) {
      throw new NotFoundException('الجلسة غير موجودة.');
    }
    await this.cache.del(this.rtKey(jti)).catch(() => undefined);
    await this.refreshRepo.delete({ jti });
  }

  async revokeAllUserSessionsExcept(userId: string, keepJti: string): Promise<number> {
    const rows = await this.refreshRepo.find({ where: { userId } });
    const toRevoke = rows.filter((r) => r.jti !== keepJti);
    await Promise.all(
      toRevoke.map((r) => this.cache.del(this.rtKey(r.jti)).catch(() => undefined)),
    );
    if (toRevoke.length > 0) {
      await this.refreshRepo.delete(toRevoke.map((r) => r.jti));
    }
    return toRevoke.length;
  }

  // ─── Cache helpers (best-effort — failures never break auth correctness) ───────

  private async cacheGet(jti: string): Promise<RefreshTokenCache | null> {
    try {
      const rec = await this.cache.get<RefreshTokenCache>(this.rtKey(jti));
      if (rec && rec.expiresAt > Date.now()) return rec;
      return null;
    } catch {
      return null;
    }
  }

  private async cacheSet(jti: string, rec: RefreshTokenCache): Promise<void> {
    try {
      const ttl = Math.max(1, rec.expiresAt - Date.now());
      await this.cache.set(this.rtKey(jti), rec, ttl);
    } catch {
      // ignore — DB remains the source of truth
    }
  }

  private async touch(jti: string, cached: RefreshTokenCache): Promise<void> {
    const now = Date.now();
    await this.cacheSet(jti, { ...cached, lastUsedAt: now });
    await this.refreshRepo.update({ jti }, { lastUsedAt: new Date(now) });
  }
}
