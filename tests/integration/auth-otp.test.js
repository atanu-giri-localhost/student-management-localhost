import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { hashOtp, hashSessionToken } from '@/lib/auth/crypto';
import { hydrateUserProfiles } from '@/lib/auth/profile-hydration';
import { requireAuth } from '@/lib/auth/session';
import { D1_BINDINGS } from '@/lib/cloudflare/bindings';
import { findActiveSessionByTokenHash } from '@/modules/auth/auth.repository';
import { assertCanRevokeSessions } from '@/modules/auth/auth.permissions';
import {
  logoutService,
  requestOtpService,
  revokeUserSessionsService,
  verifyOtpService,
} from '@/modules/auth/auth.service';
import { assertCanManageUsers } from '@/modules/users/users.permissions';
import {
  createUserService,
  deactivateUserService,
  getUserByIdService,
  listUsersService,
  updateUserService,
} from '@/modules/users/users.service';
import { createMultiD1Proxy } from '../helpers/multi-d1-proxy';

const TEST_SECRET = 'integration_test_session_secret_32chars';

let ctx;
let identityDb;
let testEnv;

describe('Phase B2 WhatsApp OTP, Session Lifecycle, Cross-D1 Hydration, Audit Outbox & Users RBAC', () => {
  beforeAll(async () => {
    ctx = await createMultiD1Proxy({ applyMigrations: true, applySeeds: true });
    identityDb = ctx.dbs[D1_BINDINGS.IDENTITY];
    testEnv = {
      ...ctx.env,
      SESSION_SECRET: TEST_SECRET,
      WHATSAPP_PROVIDER: 'MOCK',
      ENVIRONMENT: 'test',
      OTP_EXPIRY_MINUTES: '5',
      OTP_MAX_ATTEMPTS: '3',
      OTP_RESEND_COOLDOWN_SECONDS: '60',
    };
  }, 60000);

  afterAll(async () => {
    vi.restoreAllMocks();
    if (ctx) {
      await ctx.cleanup();
    }
  });

  it('includes provider_job_id column on DB_IDENTITY otp_challenges and audit_outbox table', async () => {
    const cols = await identityDb.prepare('PRAGMA table_info(otp_challenges)').all();
    const names = (cols.results || []).map((c) => c.name);
    expect(names).toContain('provider_job_id');

    const outboxTable = await identityDb
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'audit_outbox'")
      .first();
    expect(outboxTable?.name).toBe('audit_outbox');
  });

  it('prevents account enumeration and never dispatches WhatsApp for unregistered phones', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const resUnregistered = await requestOtpService(
      identityDb,
      { ...testEnv, WHATSAPP_PROVIDER: 'OGENSYNC', WHATSAPP_API_KEY: 'trn_live_dummy' },
      { phoneNormalized: '+919000099999', clientIp: '10.0.0.10' }
    );
    const resRegistered = await requestOtpService(
      identityDb,
      testEnv,
      { phoneNormalized: '+919999900001', clientIp: '10.0.0.11' }
    );

    expect(resUnregistered).toEqual(resRegistered);
    expect(resUnregistered.cooldownSeconds).toBe(60);
    expect(fetchSpy).not.toHaveBeenCalled();

    const row = await identityDb
      .prepare('SELECT delivery_status, provider_job_id FROM otp_challenges WHERE phone_normalized = ?')
      .bind('+919000099999')
      .first();
    expect(row?.delivery_status).toBe('FAILED');
    expect(row?.provider_job_id).toBeNull();
  });

  it('dispatches via Ogensync adapter for active users and persists provider_job_id + hashed OTP', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          jobId: 'job_ogensync_demo_1',
          status: 'queued',
          statusUrl: '/v1/messages/job_ogensync_demo_1',
          replayed: false,
          chargePaise: 80,
        }),
        { status: 202 }
      )
    );

    await requestOtpService(
      identityDb,
      {
        ...testEnv,
        WHATSAPP_PROVIDER: 'OGENSYNC',
        WHATSAPP_API_KEY: 'trn_live_secret_123',
        OGENSYNC_BASE_URL: 'https://transport.ogensync.com',
      },
      { phoneNormalized: '+919999900002', clientIp: '10.0.0.12' }
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const challenge = await identityDb
      .prepare(
        'SELECT otp_hash, delivery_status, provider_job_id FROM otp_challenges WHERE phone_normalized = ? ORDER BY created_at DESC LIMIT 1'
      )
      .bind('+919999900002')
      .first();

    expect(challenge?.delivery_status).toBe('DELIVERED');
    expect(challenge?.provider_job_id).toBe('job_ogensync_demo_1');
    expect(challenge?.otp_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('enforces 60s per-phone cooldown and 5/hour per-IP rate limits', async () => {
    const phone = '+919876500001';
    const baseTime = new Date('2026-11-25T10:00:00.000Z');

    await requestOtpService(identityDb, testEnv, {
      phoneNormalized: phone,
      clientIp: '10.0.0.50',
      nowDate: baseTime,
    });

    await expect(
      requestOtpService(identityDb, testEnv, {
        phoneNormalized: phone,
        clientIp: '10.0.0.51',
        nowDate: new Date(baseTime.getTime() + 30_000),
      })
    ).rejects.toMatchObject({ code: 'RATE_LIMITED', status: 429 });

    for (let i = 0; i < 5; i++) {
      await requestOtpService(identityDb, testEnv, {
        phoneNormalized: `+91980000010${i}`,
        clientIp: '10.0.0.99',
        nowDate: new Date(baseTime.getTime() + i * 1000),
      });
    }

    await expect(
      requestOtpService(identityDb, testEnv, {
        phoneNormalized: '+919800000199',
        clientIp: '10.0.0.99',
        nowDate: new Date(baseTime.getTime() + 10_000),
      })
    ).rejects.toMatchObject({ code: 'RATE_LIMITED', status: 429 });
  });

  it('enforces OTP expiry, max 3 attempts, replay protection, cross-D1 profile hydration, and logout', async () => {
    const phone = '+919876510001'; // Aarav Sharma (STUDENT)
    const issuedAt = new Date('2026-11-25T12:00:00.000Z');
    const knownOtp = '654321';
    const challengeId = crypto.randomUUID();
    const otpHash = await hashOtp(TEST_SECRET, challengeId, phone, knownOtp);

    await identityDb
      .prepare(
        `INSERT INTO otp_challenges (
          id, phone_normalized, otp_hash, expires_at, attempts, consumed_at,
          delivery_status, request_ip, provider_job_id, created_at
        ) VALUES (?, ?, ?, ?, 0, NULL, 'DELIVERED', '10.0.0.60', 'mock_job_1', ?)`
      )
      .bind(
        challengeId,
        phone,
        otpHash,
        new Date(issuedAt.getTime() + 5 * 60_000).toISOString(),
        issuedAt.toISOString()
      )
      .run();

    // 1. Expired OTP rejected
    await expect(
      verifyOtpService(identityDb, testEnv, {
        phoneNormalized: phone,
        otp: knownOtp,
        userAgent: 'Vitest',
        clientIp: '10.0.0.60',
        nowDate: new Date(issuedAt.getTime() + 6 * 60_000),
      })
    ).rejects.toMatchObject({ code: 'INVALID_OTP', status: 401 });

    // 2. Wrong OTP increments attempts twice, then valid OTP succeeds on 3rd try
    for (let wrong = 0; wrong < 2; wrong++) {
      await expect(
        verifyOtpService(identityDb, testEnv, {
          phoneNormalized: phone,
          otp: '000000',
          userAgent: 'Vitest',
          clientIp: '10.0.0.60',
          nowDate: new Date(issuedAt.getTime() + 60_000),
        })
      ).rejects.toMatchObject({ code: 'INVALID_OTP', status: 401 });
    }

    const verified = await verifyOtpService(identityDb, testEnv, {
      phoneNormalized: phone,
      otp: knownOtp,
      userAgent: 'Vitest',
      clientIp: '10.0.0.60',
      nowDate: new Date(issuedAt.getTime() + 90_000),
    });

    expect(verified.session.roles).toContain('STUDENT');
    expect(verified.session.profiles.studentId).toBe('14000000-0000-4000-8000-000000000001');
    expect(verified.session.profiles.parentProfileId).toBeNull();
    expect(verified.session.profiles.teacherProfileId).toBeNull();

    // 3. Replay with the same OTP fails
    await expect(
      verifyOtpService(identityDb, testEnv, {
        phoneNormalized: phone,
        otp: knownOtp,
        userAgent: 'Vitest',
        clientIp: '10.0.0.60',
        nowDate: new Date(issuedAt.getTime() + 100_000),
      })
    ).rejects.toMatchObject({ code: 'INVALID_OTP', status: 401 });

    // 4. Logout revokes active session
    await logoutService(identityDb, {
      sessionId: verified.session.sessionId,
      nowDate: new Date(issuedAt.getTime() + 120_000),
    });
    const afterLogout = await findActiveSessionByTokenHash(
      identityDb,
      await hashSessionToken(verified.rawSessionToken),
      new Date(issuedAt.getTime() + 125_000).toISOString()
    );
    expect(afterLogout).toBeNull();

    // 5. Attempt limit lockout after 3 wrong guesses
    const lockChallengeId = crypto.randomUUID();
    const lockHash = await hashOtp(TEST_SECRET, lockChallengeId, phone, '111222');
    await identityDb
      .prepare(
        `INSERT INTO otp_challenges (
          id, phone_normalized, otp_hash, expires_at, attempts, consumed_at,
          delivery_status, request_ip, provider_job_id, created_at
        ) VALUES (?, ?, ?, ?, 0, NULL, 'DELIVERED', '10.0.0.61', 'mock_job_2', ?)`
      )
      .bind(
        lockChallengeId,
        phone,
        lockHash,
        new Date(issuedAt.getTime() + 15 * 60_000).toISOString(),
        new Date(issuedAt.getTime() + 200_000).toISOString()
      )
      .run();

    for (let i = 0; i < 3; i++) {
      await expect(
        verifyOtpService(identityDb, testEnv, {
          phoneNormalized: phone,
          otp: '999999',
          userAgent: 'Vitest',
          clientIp: '10.0.0.61',
          nowDate: new Date(issuedAt.getTime() + 210_000),
        })
      ).rejects.toMatchObject({ code: 'INVALID_OTP', status: 401 });
    }

    await expect(
      verifyOtpService(identityDb, testEnv, {
        phoneNormalized: phone,
        otp: '111222',
        userAgent: 'Vitest',
        clientIp: '10.0.0.61',
        nowDate: new Date(issuedAt.getTime() + 220_000),
      })
    ).rejects.toMatchObject({ code: 'INVALID_OTP', status: 401 });
  });

  it('hydrates TEACHER and PARENT profiles across DB_ACADEMICS and DB_STUDENTS and degrades gracefully if profile DBs are unavailable', async () => {
    const teacherProfiles = await hydrateUserProfiles(testEnv, {
      userId: '11000000-0000-4000-8000-000000000003',
      roles: ['TEACHER'],
    });
    expect(teacherProfiles).toEqual({
      parentProfileId: null,
      teacherProfileId: '1b000000-0000-4000-8000-000000000001',
      studentId: null,
    });

    const parentProfiles = await hydrateUserProfiles(testEnv, {
      userId: '11000000-0000-4000-8000-000000000006',
      roles: ['PARENT'],
    });
    expect(parentProfiles).toEqual({
      parentProfileId: '13000000-0000-4000-8000-000000000001',
      teacherProfileId: null,
      studentId: null,
    });

    // Degraded DB_STUDENTS / DB_ACADEMICS returns null profile IDs without breaking identity
    const degradedEnv = { ...testEnv, DB_STUDENTS: undefined, DB_ACADEMICS: undefined };
    const degradedTeacher = await hydrateUserProfiles(degradedEnv, {
      userId: '11000000-0000-4000-8000-000000000003',
      roles: ['TEACHER'],
    });
    expect(degradedTeacher).toEqual({
      parentProfileId: null,
      teacherProfileId: null,
      studentId: null,
    });
  });

  it('enforces SUPER_ADMIN RBAC on users/revoke, revokes sessions on role change or deactivation, hydrates user detail, and writes DB_IDENTITY.audit_outbox', async () => {
    const superAdminSession = {
      userId: '11000000-0000-4000-8000-000000000001',
      roles: ['SUPER_ADMIN'],
    };
    const coachingAdminSession = {
      userId: '11000000-0000-4000-8000-000000000002',
      roles: ['COACHING_ADMIN'],
    };

    expect(assertCanManageUsers(superAdminSession)).toBeNull();
    expect(assertCanManageUsers(coachingAdminSession)?.status).toBe(403);
    expect(assertCanRevokeSessions({ roles: ['TEACHER'] })?.status).toBe(403);

    // Seeded teacher detail hydrates teacherProfileId across DB_ACADEMICS
    const seededTeacher = await getUserByIdService(
      identityDb,
      '11000000-0000-4000-8000-000000000003',
      testEnv
    );
    expect(seededTeacher.profiles.teacherProfileId).toBe('1b000000-0000-4000-8000-000000000001');

    // Create user + duplicate conflict check
    const created = await createUserService(
      identityDb,
      superAdminSession,
      { phone: '+919811122233', email: 'newstaff@apex.test', roles: ['TEACHER'], isActive: true },
      { clientIp: '10.0.0.70', requestId: 'req_usr_1', workerEnv: testEnv }
    );
    expect(created.phoneNormalized).toBe('+919811122233');
    expect(created.roles).toEqual(['TEACHER']);

    await expect(
      createUserService(
        identityDb,
        superAdminSession,
        { phone: '+919811122233', roles: ['TEACHER'], isActive: true },
        { clientIp: '10.0.0.70', requestId: 'req_usr_dup', workerEnv: testEnv }
      )
    ).rejects.toMatchObject({ code: 'CONFLICT', status: 409 });

    // Create active + expired sessions and test requireAuth
    const rawToken = 'test_raw_session_token_value_123456';
    const tokenHash = await hashSessionToken(rawToken);
    const futureExpiry = new Date(Date.now() + 86_400_000).toISOString();
    await identityDb
      .prepare(
        `INSERT INTO sessions (id, user_id, token_hash, expires_at, revoked_at, user_agent, ip_address, created_at)
         VALUES (?, ?, ?, ?, NULL, 'Vitest', '10.0.0.70', ?)`
      )
      .bind(crypto.randomUUID(), created.id, tokenHash, futureExpiry, new Date().toISOString())
      .run();

    const expiredRawToken = 'test_expired_session_token_value_123';
    await identityDb
      .prepare(
        `INSERT INTO sessions (id, user_id, token_hash, expires_at, revoked_at, user_agent, ip_address, created_at)
         VALUES (?, ?, ?, ?, NULL, 'Vitest', '10.0.0.70', ?)`
      )
      .bind(
        crypto.randomUUID(),
        created.id,
        await hashSessionToken(expiredRawToken),
        '2020-01-01T00:00:00.000Z',
        new Date().toISOString()
      )
      .run();

    const expiredReq = new Request('http://localhost:3000/api/v1/auth/session', {
      headers: { cookie: `sms_session=${expiredRawToken}` },
    });
    const expiredAuth = await requireAuth(expiredReq, { explicitEnv: testEnv });
    expect(expiredAuth.ok).toBe(false);
    expect(expiredAuth.response.status).toBe(401);

    const authedReq = new Request('http://localhost:3000/api/v1/auth/session', {
      headers: { cookie: `sms_session=${rawToken}` },
    });
    const authRes = await requireAuth(authedReq, { explicitEnv: testEnv });
    expect(authRes.ok).toBe(true);
    expect(authRes.session.userId).toBe(created.id);

    // Role update atomically revokes active sessions
    const updated = await updateUserService(
      identityDb,
      superAdminSession,
      created.id,
      { roles: ['COACHING_ADMIN'] },
      { clientIp: '10.0.0.70', requestId: 'req_usr_upd', workerEnv: testEnv }
    );
    expect(updated.roles).toEqual(['COACHING_ADMIN']);

    const authAfterRoleChange = await requireAuth(authedReq, { explicitEnv: testEnv });
    expect(authAfterRoleChange.ok).toBe(false);
    expect(authAfterRoleChange.response.status).toBe(401);

    // Administrative revoke + deactivation + DB_IDENTITY.audit_outbox check
    await revokeUserSessionsService(identityDb, {
      actorSession: superAdminSession,
      targetUserId: created.id,
      clientIp: '10.0.0.70',
      requestId: 'req_usr_rev',
    });
    const deactivated = await deactivateUserService(identityDb, superAdminSession, created.id, {
      clientIp: '10.0.0.70',
      requestId: 'req_usr_deact',
      workerEnv: testEnv,
    });
    expect(deactivated.isActive).toBe(false);

    const listRes = await listUsersService(identityDb, { page: 1, pageSize: 25, search: '+919811122233' });
    expect(listRes.total).toBe(1);

    const outboxRows = await identityDb
      .prepare('SELECT action, status FROM audit_outbox WHERE entity_id = ? ORDER BY created_at ASC')
      .bind(created.id)
      .all();
    expect((outboxRows.results || []).length).toBeGreaterThanOrEqual(4);
    expect((outboxRows.results || []).every((r) => r.status === 'PENDING')).toBe(true);
  });
});
