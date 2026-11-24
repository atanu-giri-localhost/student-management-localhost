import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPlatformProxy } from 'wrangler';
import { getDb, getStorage } from '@/lib/cloudflare/bindings';
import { deriveInvoiceStatus } from '@/lib/money/format';

const WRANGLER_BIN = path.resolve(process.cwd(), 'node_modules/.bin/wrangler');

let tmpPersistDir;
let proxy;
let db;
let storage;

/**
 * Execute local Wrangler D1 CLI commands against an isolated temporary persistence directory.
 *
 * @param {string[]} args
 */
function runWrangler(args) {
  execFileSync(WRANGLER_BIN, args, {
    cwd: process.cwd(),
    stdio: 'pipe',
    env: { ...process.env, CI: 'true' },
  });
}

describe('Cloudflare D1 migrations, foreign keys, synthetic seed, and atomic batch', () => {
  beforeAll(async () => {
    tmpPersistDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sms-d1-test-'));

    runWrangler([
      'd1',
      'migrations',
      'apply',
      'sms-coaching-d1',
      '--local',
      '--force',
      '--persist-to',
      tmpPersistDir,
    ]);

    runWrangler([
      'd1',
      'execute',
      'sms-coaching-d1',
      '--local',
      '--persist-to',
      tmpPersistDir,
      '--file',
      './seeds/seed.sql',
    ]);

    proxy = await getPlatformProxy({
      configPath: './wrangler.toml',
      persist: { path: path.join(tmpPersistDir, 'v3') },
    });

    db = getDb(proxy.env);
    storage = getStorage(proxy.env);
  }, 30000);

  afterAll(async () => {
    if (proxy) {
      await proxy.dispose();
    }
    if (tmpPersistDir) {
      fs.rmSync(tmpPersistDir, { recursive: true, force: true });
    }
  });

  it('applies 0001_initial_schema.sql cleanly with all 36 domain tables and seeded data', async () => {
    const tableRow = await db
      .prepare(
        "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '_cf_KV' AND name != 'd1_migrations'"
      )
      .first();
    expect(tableRow?.count).toBe(36);

    const migrationRow = await db
      .prepare('SELECT name FROM d1_migrations WHERE name = ?')
      .bind('0001_initial_schema.sql')
      .first();
    expect(migrationRow?.name).toBe('0001_initial_schema.sql');

    const rolesCount = await db.prepare('SELECT COUNT(*) AS count FROM roles').first();
    expect(rolesCount?.count).toBe(5);

    const activeSession = await db
      .prepare('SELECT name FROM academic_sessions WHERE is_active = ?')
      .bind(1)
      .first();
    expect(activeSession?.name).toBe('2026-2027');

    const healthCheck = await db.prepare('SELECT 1 AS ok').first();
    expect(healthCheck?.ok).toBe(1);
  });

  it('enforces PRAGMA foreign_keys = ON and ON DELETE RESTRICT on historical records', async () => {
    const fkPragma = await db.prepare('PRAGMA foreign_keys').first();
    expect(fkPragma?.foreign_keys).toBe(1);

    await expect(
      db
        .prepare(
          'INSERT INTO enrollments (id, student_id, academic_session_id, class_id, roll_number, enrollment_status, start_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(
          '99000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-999999999999',
          '16000000-0000-4000-8000-000000000002',
          '17000000-0000-4000-8000-000000000002',
          '10A-99',
          'ACTIVE',
          '2026-04-01',
          '2026-11-24T00:00:00.000Z'
        )
        .run()
    ).rejects.toThrow(/FOREIGN KEY constraint failed/i);

    await expect(
      db
        .prepare('DELETE FROM students WHERE id = ?')
        .bind('14000000-0000-4000-8000-000000000001')
        .run()
    ).rejects.toThrow(/FOREIGN KEY constraint failed/i);
  });

  it('prevents duplicate monthly invoices via UNIQUE constraint', async () => {
    await expect(
      db
        .prepare(
          'INSERT INTO invoices (id, invoice_number, student_id, enrollment_id, billing_month, billing_year, invoice_type, total_amount_paise, due_date, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(
          '99000000-0000-4000-8000-000000000002',
          'INV-202611-9999',
          '14000000-0000-4000-8000-000000000001',
          '1a000000-0000-4000-8000-000000000002',
          11,
          2026,
          'COMBINED',
          360000,
          '2026-11-10',
          'UNPAID',
          '2026-11-24T00:00:00.000Z'
        )
        .run()
    ).rejects.toThrow(/UNIQUE constraint failed/i);
  });

  it('commits multi-statement payment + allocation + receipt + invoice status atomically via env.DB.batch()', async () => {
    const diyaInvoiceId = '2b000000-0000-4000-8000-000000000003';
    const diyaStudentId = '14000000-0000-4000-8000-000000000002';
    const paymentId = '9d000000-0000-4000-8000-000000000001';
    const allocationId = '9e000000-0000-4000-8000-000000000001';
    const receiptId = '9f000000-0000-4000-8000-000000000001';
    const nextStatus = deriveInvoiceStatus(310000, 310000);

    const results = await db.batch([
      db
        .prepare(
          'INSERT INTO payments (id, student_id, amount_paid_paise, payment_method, transaction_reference, payment_date, notes, recorded_by_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(
          paymentId,
          diyaStudentId,
          310000,
          'UPI',
          'UPI/20261124/888111',
          '2026-11-24',
          'Full payment settlement test',
          '11000000-0000-4000-8000-000000000002',
          '2026-11-24T10:00:00.000Z'
        ),
      db
        .prepare(
          'INSERT INTO payment_allocations (id, payment_id, invoice_id, allocated_amount_paise, created_at) VALUES (?, ?, ?, ?, ?)'
        )
        .bind(allocationId, paymentId, diyaInvoiceId, 310000, '2026-11-24T10:00:00.000Z'),
      db
        .prepare(
          'INSERT INTO receipts (id, receipt_number, payment_id, issued_date, created_at) VALUES (?, ?, ?, ?, ?)'
        )
        .bind(
          receiptId,
          'REC-202611-9001',
          paymentId,
          '2026-11-24',
          '2026-11-24T10:00:00.000Z'
        ),
      db.prepare('UPDATE invoices SET status = ? WHERE id = ?').bind(nextStatus, diyaInvoiceId),
    ]);

    expect(results).toHaveLength(4);
    expect(results.every((entry) => entry.success)).toBe(true);

    const updatedInvoice = await db
      .prepare('SELECT status FROM invoices WHERE id = ?')
      .bind(diyaInvoiceId)
      .first();
    expect(updatedInvoice?.status).toBe('PAID');

    const receipt = await db
      .prepare('SELECT receipt_number FROM receipts WHERE id = ?')
      .bind(receiptId)
      .first();
    expect(receipt?.receipt_number).toBe('REC-202611-9001');
  });

  it('rolls back the entire env.DB.batch() transaction when a downstream constraint fails', async () => {
    const kabirInvoiceId = '2b000000-0000-4000-8000-000000000002';
    const kabirStudentId = '14000000-0000-4000-8000-000000000003';
    const failedPaymentId = '9d000000-0000-4000-8000-000000000099';
    const failedAllocationId = '9e000000-0000-4000-8000-000000000099';
    const failedReceiptId = '9f000000-0000-4000-8000-000000000099';

    // Statement 3 intentionally collides with existing receipt_number 'REC-202611-0001'.
    await expect(
      db.batch([
        db
          .prepare(
            'INSERT INTO payments (id, student_id, amount_paid_paise, payment_method, transaction_reference, payment_date, notes, recorded_by_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
          )
          .bind(
            failedPaymentId,
            kabirStudentId,
            160000,
            'CASH',
            null,
            '2026-11-24',
            'Should roll back',
            '11000000-0000-4000-8000-000000000002',
            '2026-11-24T10:05:00.000Z'
          ),
        db
          .prepare(
            'INSERT INTO payment_allocations (id, payment_id, invoice_id, allocated_amount_paise, created_at) VALUES (?, ?, ?, ?, ?)'
          )
          .bind(
            failedAllocationId,
            failedPaymentId,
            kabirInvoiceId,
            160000,
            '2026-11-24T10:05:00.000Z'
          ),
        db
          .prepare(
            'INSERT INTO receipts (id, receipt_number, payment_id, issued_date, created_at) VALUES (?, ?, ?, ?, ?)'
          )
          .bind(
            failedReceiptId,
            'REC-202611-0001',
            failedPaymentId,
            '2026-11-24',
            '2026-11-24T10:05:00.000Z'
          ),
        db.prepare('UPDATE invoices SET status = ? WHERE id = ?').bind('PAID', kabirInvoiceId),
      ])
    ).rejects.toThrow(/UNIQUE constraint failed/i);

    const paymentCheck = await db
      .prepare('SELECT id FROM payments WHERE id = ?')
      .bind(failedPaymentId)
      .first();
    expect(paymentCheck).toBeNull();

    const allocationCheck = await db
      .prepare('SELECT id FROM payment_allocations WHERE id = ?')
      .bind(failedAllocationId)
      .first();
    expect(allocationCheck).toBeNull();

    const receiptCheck = await db
      .prepare('SELECT id FROM receipts WHERE id = ?')
      .bind(failedReceiptId)
      .first();
    expect(receiptCheck).toBeNull();

    const kabirInvoice = await db
      .prepare('SELECT status FROM invoices WHERE id = ?')
      .bind(kabirInvoiceId)
      .first();
    expect(kabirInvoice?.status).toBe('PARTIALLY_PAID');
  });

  it('provides request-scoped R2 storage binding (env.STORAGE)', async () => {
    const key = 'phase1-smoke/test.txt';
    const payload = new TextEncoder().encode('sms-r2-ok');
    await storage.put(key, payload, {
      httpMetadata: { contentType: 'text/plain' },
    });
    const obj = await storage.get(key);
    expect(obj).not.toBeNull();
    expect(await obj.text()).toBe('sms-r2-ok');
  });
});
