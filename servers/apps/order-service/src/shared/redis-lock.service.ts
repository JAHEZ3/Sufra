import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

// TTL for the checkout lock — long enough to cover a DB transaction + queue enqueue,
// short enough that a crashed process doesn't block the user for long.
const LOCK_TTL_MS = 8_000;

@Injectable()
export class RedisLockService {
  private readonly client: Redis;
  private readonly logger = new Logger(RedisLockService.name);

  constructor(config: ConfigService) {
    this.client = new Redis({
      host: config.get<string>('REDIS_HOST', 'localhost'),
      port: config.get<number>('REDIS_PORT', 6379),
      // Dedicated connection — never shares the cache connection's pipeline
      lazyConnect: false,
      maxRetriesPerRequest: 1,
    });

    this.client.on('error', (err) =>
      this.logger.error({ msg: 'redis_lock_error', err }),
    );
  }

  /**
   * Attempt to acquire a lock for `key`.
   * Returns the lock token (UUID) on success, null if already locked.
   *
   * Uses SET key token NX PX ttl — atomic, no race condition.
   */
  async acquire(key: string): Promise<string | null> {
    const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const result = await this.client.set(key, token, 'PX', LOCK_TTL_MS, 'NX');
    return result === 'OK' ? token : null;
  }

  /**
   * Release the lock only if we still own it (compare-and-delete via Lua).
   * Prevents a slow process from releasing a lock that already expired and
   * was re-acquired by another request.
   */
  async release(key: string, token: string): Promise<void> {
    const lua = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    await this.client.eval(lua, 1, key, token);
  }

  lockKey(userId: string): string {
    return `checkout_lock:${userId}`;
  }
}
