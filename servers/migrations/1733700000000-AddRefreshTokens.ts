import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Durable storage for issued refresh tokens (one row per session / `jti`).
 *
 * Refresh tokens used to live only in Redis, so any cache flush/eviction logged
 * every user out and broke persistent login. This table makes Postgres the
 * source of truth; Redis remains a best-effort hot cache in the JWT service.
 *
 * `synchronize` is enabled outside production, so dev databases get this table
 * automatically from the entity — this migration covers production deploys.
 */
export class AddRefreshTokens1733700000000 implements MigrationInterface {
  name = 'AddRefreshTokens1733700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "refresh_tokens" (
        "jti"          uuid PRIMARY KEY,
        "user_id"      uuid NOT NULL,
        "ip"           varchar(64),
        "user_agent"   text,
        "device_info"  jsonb,
        "last_used_at" timestamptz NOT NULL,
        "expires_at"   timestamptz NOT NULL,
        "created_at"   timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_user_id" ON "refresh_tokens" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_expires_at" ON "refresh_tokens" ("expires_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_refresh_tokens_expires_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_refresh_tokens_user_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens"`);
  }
}
