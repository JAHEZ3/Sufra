import { MigrationInterface, QueryRunner } from 'typeorm';
import { tryNormalizePhone } from '../apps/auth-service/src/utils/phone.util';

/**
 * Back-fills existing `users.phone` values into the canonical E.164 form
 * (+970…/+972…) introduced alongside client-side phone normalization.
 *
 * Without this, a returning user whose number was stored loosely (e.g.
 * `0599123456`) would no longer match the now-normalized login lookup and could
 * end up creating a duplicate account. Rows that can't be normalized, or whose
 * normalized value would collide with another existing row, are left untouched
 * and logged so they can be reconciled by hand.
 */
export class NormalizeUserPhones1733700100000 implements MigrationInterface {
  name = 'NormalizeUserPhones1733700100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows: { id: string; phone: string }[] = await queryRunner.query(
      `SELECT id, phone FROM "users" WHERE phone IS NOT NULL`,
    );

    for (const row of rows) {
      const normalized = tryNormalizePhone(row.phone);
      if (!normalized || normalized === row.phone) continue;

      // Skip if another row already owns the normalized number (avoid unique clash).
      const clash: { id: string }[] = await queryRunner.query(
        `SELECT id FROM "users" WHERE phone = $1 AND id <> $2 LIMIT 1`,
        [normalized, row.id],
      );
      if (clash.length > 0) {
        // eslint-disable-next-line no-console
        console.warn(
          `[NormalizeUserPhones] Skipping ${row.id}: "${row.phone}" → "${normalized}" collides with ${clash[0].id}`,
        );
        continue;
      }

      await queryRunner.query(`UPDATE "users" SET phone = $1 WHERE id = $2`, [
        normalized,
        row.id,
      ]);
    }
  }

  public async down(): Promise<void> {
    // Non-reversible data normalization — the original loose formats are not
    // recoverable. Down is a no-op by design.
  }
}
