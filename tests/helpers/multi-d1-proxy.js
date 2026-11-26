import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getPlatformProxy } from 'wrangler';
import { D1_BINDINGS, getAllDomainDbs } from '@/lib/cloudflare/bindings';

const WRANGLER_BIN = path.resolve(process.cwd(), 'node_modules/.bin/wrangler');

export const DOMAIN_D1_SPECS = Object.freeze([
  { key: 'IDENTITY', binding: D1_BINDINGS.IDENTITY, dbName: 'sms-d1-identity', seedFile: './seeds/01_identity.sql', tables: 6 },
  { key: 'STUDENTS', binding: D1_BINDINGS.STUDENTS, dbName: 'sms-d1-students', seedFile: './seeds/02_students.sql', tables: 6 },
  { key: 'ACADEMICS', binding: D1_BINDINGS.ACADEMICS, dbName: 'sms-d1-academics', seedFile: './seeds/03_academics.sql', tables: 6 },
  { key: 'ATTENDANCE', binding: D1_BINDINGS.ATTENDANCE, dbName: 'sms-d1-attendance', seedFile: './seeds/04_attendance.sql', tables: 6 },
  { key: 'PERFORMANCE', binding: D1_BINDINGS.PERFORMANCE, dbName: 'sms-d1-performance', seedFile: './seeds/05_performance.sql', tables: 5 },
  { key: 'FINANCE', binding: D1_BINDINGS.FINANCE, dbName: 'sms-d1-finance', seedFile: './seeds/06_finance.sql', tables: 11 },
  { key: 'TIMETABLE', binding: D1_BINDINGS.TIMETABLE, dbName: 'sms-d1-timetable', seedFile: './seeds/07_timetable.sql', tables: 3 },
  { key: 'AUDIT', binding: D1_BINDINGS.AUDIT, dbName: 'sms-d1-audit', seedFile: './seeds/08_audit.sql', tables: 2 },
]);

function runLocalWrangler(args) {
  execFileSync(WRANGLER_BIN, args, {
    cwd: process.cwd(),
    stdio: 'pipe',
    env: { ...process.env, CI: 'true' },
  });
}

/**
 * Create an isolated local Wrangler `getPlatformProxy` instance exposing all 8 D1 bindings.
 * Uses a temporary persistence directory by default and never touches remote resources.
 *
 * @param {{
 *   applyMigrations?: boolean,
 *   applySeeds?: boolean,
 *   persistDir?: string,
 * }} [options]
 */
export async function createMultiD1Proxy(options = {}) {
  const { applyMigrations = false, applySeeds = false, persistDir } = options;
  const ownsPersistDir = !persistDir;
  const resolvedPersistDir = persistDir || fs.mkdtempSync(path.join(os.tmpdir(), 'sms-8d1-test-'));

  if (applyMigrations) {
    for (const spec of DOMAIN_D1_SPECS) {
      runLocalWrangler([
        'd1',
        'migrations',
        'apply',
        spec.dbName,
        '--local',
        '--force',
        '--persist-to',
        resolvedPersistDir,
      ]);
      if (applySeeds) {
        runLocalWrangler([
          'd1',
          'execute',
          spec.dbName,
          '--local',
          '--persist-to',
          resolvedPersistDir,
          '--file',
          spec.seedFile,
        ]);
      }
    }
  }

  const proxy = await getPlatformProxy({
    configPath: './wrangler.toml',
    persist: { path: path.join(resolvedPersistDir, 'v3') },
  });

  const dbs = getAllDomainDbs(proxy.env);

  return {
    proxy,
    env: proxy.env,
    dbs,
    persistDir: resolvedPersistDir,
    async cleanup() {
      await proxy.dispose();
      if (ownsPersistDir) {
        fs.rmSync(resolvedPersistDir, { recursive: true, force: true });
      }
    },
  };
}
