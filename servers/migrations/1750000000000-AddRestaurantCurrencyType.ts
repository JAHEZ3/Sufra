import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-restaurant display currency for the dashboard (SAR, ILS, USD, AED, EGP).
 *
 * `synchronize` is enabled outside production, so dev databases get this column
 * automatically from the entity — this migration covers production deploys.
 */
export class AddRestaurantCurrencyType1750000000000 implements MigrationInterface {
  name = 'AddRestaurantCurrencyType1750000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "currency_type" varchar(8) NOT NULL DEFAULT 'SAR'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "currency_type"`,
    );
  }
}
