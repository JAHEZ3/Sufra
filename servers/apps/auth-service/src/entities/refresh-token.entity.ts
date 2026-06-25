import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

/**
 * Durable record of an issued refresh token (one row per session / `jti`).
 *
 * Refresh tokens were previously kept only in Redis, so any cache flush or
 * eviction silently logged every user out — which broke "stay signed in".
 * Postgres is now the source of truth; Redis (in {@link AppJwtService}) is a
 * best-effort hot cache layered on top of this table.
 *
 * The row is hard-deleted on logout / rotation / revoke, so presence of a row
 * (with a future `expiresAt`) means the session is alive.
 */
@Entity("refresh_tokens")
@Index(["userId"])
@Index(["expiresAt"])
export class RefreshToken {
  /** The JWT `jti` claim — unique per issued refresh token. */
  @PrimaryColumn("uuid")
  jti: string;

  @Column({ name: "user_id", type: "uuid" })
  userId: string;

  @Column({ name: "ip", type: "varchar", length: 64, nullable: true })
  ip: string | null;

  @Column({ name: "user_agent", type: "text", nullable: true })
  userAgent: string | null;

  @Column({ name: "device_info", type: "jsonb", nullable: true })
  deviceInfo: Record<string, any> | null;

  @Column({ name: "last_used_at", type: "timestamptz" })
  lastUsedAt: Date;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt: Date;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}
