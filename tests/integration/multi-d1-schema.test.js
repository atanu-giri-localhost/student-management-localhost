import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { D1_BINDINGS } from '@/lib/cloudflare/bindings';
import { createMultiD1Proxy, DOMAIN_D1_SPECS } from '../helpers/multi-d1-proxy';

let ctx;

describe('8-D1 migrations, table ownership, constraints, and seeds', () => {
  beforeAll(async () => {
    ctx = await createMultiD1Proxy({ applyMigrations: true, applySeeds: true });
  }, 60000);

  afterAll(async () => {
    if (ctx) {
      await ctx.cleanup();
    }
  });

  it('initializes all 8 D1 databases with exact table counts (45 tables total)', async () => {
    let totalTables = 0;
    for (const spec of DOMAIN_D1_SPECS) {
      const db = ctx.dbs[spec.binding];
      const row = await db
        .prepare(
          "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('_cf_KV', 'd1_migrations')"
        )
        .first();
      expect(row?.count).toBe(spec.tables);
      totalTables += row?.count ?? 0;
    }
    expect(totalTables).toBe(45);
  });

  it('enforces fee_adjustments signed amount_paise CHECK and DB_FINANCE batch rollback', async () => {
    const dbFinance = ctx.dbs[D1_BINDINGS.FINANCE];

    await expect(
      dbFinance
        .prepare(
          `INSERT INTO fee_adjustments (
            id, student_id, enrollment_id, invoice_id, adjustment_type,
            amount_paise, reason, approved_by_user_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          '99000000-0000-4000-8000-000000000001',
          '14000000-0000-4000-8000-000000000001',
          '1a000000-0000-4000-8000-000000000002',
          '2b000000-0000-4000-8000-000000000001',
          'WAIVER',
          5000,
          'Invalid positive waiver should fail CHECK',
          '11000000-0000-4000-8000-000000000001',
          '2026-11-26T00:00:00.000Z'
        )
        .run()
    ).rejects.toThrow();

    await expect(
      dbFinance.batch([
        dbFinance
          .prepare(
            `INSERT INTO fee_adjustments (
              id, student_id, enrollment_id, invoice_id, adjustment_type,
              amount_paise, reason, approved_by_user_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            '99000000-0000-4000-8000-000000000002',
            '14000000-0000-4000-8000-000000000001',
            '1a000000-0000-4000-8000-000000000002',
            '2b000000-0000-4000-8000-000000000001',
            'WAIVER',
            -5000,
            'Valid negative waiver rolled back by second statement',
            '11000000-0000-4000-8000-000000000001',
            '2026-11-26T00:00:00.000Z'
          ),
        dbFinance
          .prepare(
            'INSERT INTO payment_reversals (id, payment_id, reversed_amount_paise, reason, reversed_by_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
          )
          .bind(
            '99000000-0000-4000-8000-000000000003',
            '00000000-0000-4000-8000-nonexistent',
            1000,
            'Triggers FK rollback',
            '11000000-0000-4000-8000-000000000001',
            '2026-11-26T00:00:00.000Z'
          ),
      ])
    ).rejects.toThrow();

    const rolledBack = await dbFinance
      .prepare('SELECT id FROM fee_adjustments WHERE id = ?')
      .bind('99000000-0000-4000-8000-000000000002')
      .first();
    expect(rolledBack).toBeNull();
  });

  it('enforces file_objects paired owner CHECK and attendance_corrections no-op CHECK', async () => {
    const dbStudents = ctx.dbs[D1_BINDINGS.STUDENTS];
    await expect(
      dbStudents
        .prepare(
          `INSERT INTO file_objects (
            id, r2_object_key, category, mime_type, size_bytes, owner_entity_type, owner_entity_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          '99000000-0000-4000-8000-000000000010',
          'students/test.png',
          'STUDENT_PHOTO',
          'image/png',
          1024,
          'STUDENT',
          null,
          '2026-11-26T00:00:00.000Z'
        )
        .run()
    ).rejects.toThrow();

    const dbAttendance = ctx.dbs[D1_BINDINGS.ATTENDANCE];
    await expect(
      dbAttendance
        .prepare(
          `INSERT INTO attendance_corrections (
            id, register_type, register_id, record_id, enrollment_id,
            previous_status, new_status, reason, corrected_by_user_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          '99000000-0000-4000-8000-000000000011',
          'DAILY',
          '1d000000-0000-4000-8000-000000000001',
          '1e000000-0000-4000-8000-000000000001',
          '1a000000-0000-4000-8000-000000000002',
          'PRESENT',
          'PRESENT',
          'No-op should fail',
          '11000000-0000-4000-8000-000000000001',
          '2026-11-26T00:00:00.000Z'
        )
        .run()
    ).rejects.toThrow();
  });
});
