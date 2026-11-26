import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DELETE as deleteFileRoute, GET as getFileRoute } from '@/app/api/v1/files/[id]/route';
import { POST as postFileRoute } from '@/app/api/v1/files/route';
import { GET as getMyChildrenRoute } from '@/app/api/v1/parents/my-children/route';
import { GET as getStudentRoute } from '@/app/api/v1/students/[id]/route';
import { hashSessionToken } from '@/lib/auth/crypto';
import { D1_BINDINGS, getStorage } from '@/lib/cloudflare/bindings';
import * as bindings from '@/lib/cloudflare/bindings';
import {
  createParentProfileService,
  linkParentStudentService,
  unlinkParentStudentService,
} from '@/modules/parents/parents.service';
import {
  createStudentService,
  getStudentByIdService,
  listStudentsService,
  updateStudentLifecycleService,
  updateStudentService,
} from '@/modules/students/students.service';
import { createMultiD1Proxy } from '../helpers/multi-d1-proxy';

let ctx;
let testEnv;
let dbIdentity;
let dbStudents;
let storage;

const ADMIN_TOKEN = 'b4_admin_session_token_123456';
const STUDENT_TOKEN = 'b4_student_session_token_123456';
const PARENT_TOKEN = 'b4_parent_session_token_123456';
const TEACHER_TOKEN = 'b4_teacher_session_token_123456';

describe('Phase B4 Students, Parents, R2 Files & Audit Outbox Integration', () => {
  beforeAll(async () => {
    ctx = await createMultiD1Proxy({ applyMigrations: true, applySeeds: true });
    testEnv = {
      ...ctx.env,
      SESSION_SECRET: 'integration_test_session_secret_32chars',
      ENVIRONMENT: 'test',
    };
    dbIdentity = ctx.dbs[D1_BINDINGS.IDENTITY];
    dbStudents = ctx.dbs[D1_BINDINGS.STUDENTS];
    storage = getStorage(ctx.env);

    const futureExpiry = new Date(Date.now() + 86_400_000).toISOString();
    const now = new Date().toISOString();
    const sessionSpecs = [
      { userId: '11000000-0000-4000-8000-000000000002', token: ADMIN_TOKEN }, // COACHING_ADMIN
      { userId: '11000000-0000-4000-8000-000000000005', token: STUDENT_TOKEN }, // Aarav (STUDENT)
      { userId: '11000000-0000-4000-8000-000000000006', token: PARENT_TOKEN }, // Sunita (PARENT)
      { userId: '11000000-0000-4000-8000-000000000003', token: TEACHER_TOKEN }, // Priya (TEACHER)
    ];

    await dbIdentity.batch(
      await Promise.all(
        sessionSpecs.map(async (s) =>
          dbIdentity
            .prepare(
              `INSERT INTO sessions (id, user_id, token_hash, expires_at, revoked_at, user_agent, ip_address, created_at)
               VALUES (?, ?, ?, ?, NULL, 'Vitest', '127.0.0.1', ?)`
            )
            .bind(crypto.randomUUID(), s.userId, await hashSessionToken(s.token), futureExpiry, now)
        )
      )
    );
  }, 60000);

  afterAll(async () => {
    vi.restoreAllMocks();
    if (ctx) {
      await ctx.cleanup();
    }
  });

  it('creates, lists, searches, updates, and changes lifecycle of students while preserving enrollments and audit_outbox', async () => {
    const adminSession = { userId: '11000000-0000-4000-8000-000000000002', roles: ['COACHING_ADMIN'] };

    const created = await createStudentService(
      dbStudents,
      testEnv,
      adminSession,
      {
        admissionNumber: 'ADM-2026-0099',
        fullName: 'Riya Verma',
        dateOfBirth: '2011-09-12',
        gender: 'Female',
        emergencyContactName: 'Anil Verma',
        emergencyContactPhone: '+919876599900',
        admissionDate: '2026-04-15',
      },
      { clientIp: '10.0.0.1', requestId: 'req_st_1' }
    );
    expect(created.admissionNumber).toBe('ADM-2026-0099');
    expect(created.lifecycleStatus).toBe('ACTIVE');

    // Duplicate admissionNumber -> 409 CONFLICT
    await expect(
      createStudentService(
        dbStudents,
        testEnv,
        adminSession,
        {
          admissionNumber: 'ADM-2026-0099',
          fullName: 'Duplicate',
          dateOfBirth: '2011-01-01',
          gender: 'Male',
          emergencyContactName: 'Parent',
          emergencyContactPhone: '+919876599901',
          admissionDate: '2026-04-15',
        },
        { clientIp: '10.0.0.1', requestId: 'req_st_dup' }
      )
    ).rejects.toMatchObject({ code: 'CONFLICT', status: 409 });

    const listed = await listStudentsService(dbStudents, {
      page: 1,
      pageSize: 10,
      search: 'Riya',
      lifecycleStatus: 'ACTIVE',
    });
    expect(listed.total).toBe(1);

    const updated = await updateStudentService(
      dbStudents,
      adminSession,
      created.id,
      { residentialAddress: '101 Civil Lines, Jaipur' },
      { clientIp: '10.0.0.1', requestId: 'req_st_upd' }
    );
    expect(updated.residentialAddress).toBe('101 Civil Lines, Jaipur');

    // Lifecycle change on seeded Aarav Sharma preserves historical enrollments
    const aaravId = '14000000-0000-4000-8000-000000000001';
    const afterLifecycle = await updateStudentLifecycleService(
      dbStudents,
      adminSession,
      aaravId,
      'ALUMNI',
      { clientIp: '10.0.0.1', requestId: 'req_st_life' }
    );
    expect(afterLifecycle.lifecycleStatus).toBe('ALUMNI');
    expect(afterLifecycle.enrollments.length).toBeGreaterThanOrEqual(2);

    // Restore Aarav to ACTIVE for subsequent tests
    await updateStudentLifecycleService(dbStudents, adminSession, aaravId, 'ACTIVE', {
      clientIp: '10.0.0.1',
      requestId: 'req_st_restore',
    });

    const outboxCount = await dbStudents
      .prepare("SELECT COUNT(*) AS cnt FROM audit_outbox WHERE entity_id = ? AND status = 'PENDING'")
      .bind(created.id)
      .first();
    expect(outboxCount?.cnt).toBe(2);
  });

  it('manages parent profiles, parent-student links, duplicate link prevention, and unlinking', async () => {
    const adminSession = { userId: '11000000-0000-4000-8000-000000000002', roles: ['COACHING_ADMIN'] };

    // Create a new user in DB_IDENTITY for a new guardian
    const guardianUserId = crypto.randomUUID();
    const now = new Date().toISOString();
    await dbIdentity
      .prepare(
        'INSERT INTO users (id, phone_normalized, email, is_active, created_at, updated_at) VALUES (?, ?, NULL, 1, ?, ?)'
      )
      .bind(guardianUserId, '+919876544444', now, now)
      .run();

    const parent = await createParentProfileService(
      dbStudents,
      testEnv,
      adminSession,
      {
        userId: guardianUserId,
        fullName: 'Ramesh Patel',
        phoneNormalized: '+919876544444',
        relationshipType: 'Father',
      },
      { clientIp: '10.0.0.2', requestId: 'req_par_1' }
    );
    expect(parent.fullName).toBe('Ramesh Patel');

    const kabirId = '14000000-0000-4000-8000-000000000003';
    const linked = await linkParentStudentService(
      dbStudents,
      adminSession,
      parent.id,
      { studentId: kabirId, isPrimary: true, verificationStatus: 'VERIFIED' },
      { clientIp: '10.0.0.2', requestId: 'req_par_link' }
    );
    expect(linked.children).toHaveLength(1);

    await expect(
      linkParentStudentService(
        dbStudents,
        adminSession,
        parent.id,
        { studentId: kabirId, isPrimary: true, verificationStatus: 'VERIFIED' },
        { clientIp: '10.0.0.2', requestId: 'req_par_dup' }
      )
    ).rejects.toMatchObject({ code: 'CONFLICT', status: 409 });

    const unlinked = await unlinkParentStudentService(
      dbStudents,
      adminSession,
      parent.id,
      kabirId,
      { clientIp: '10.0.0.2', requestId: 'req_par_unlink' }
    );
    expect(unlinked.unlinked).toBe(true);

    const unlinkAudit = await dbStudents
      .prepare("SELECT action FROM audit_outbox WHERE action = 'UNLINK' AND entity_type = 'PARENT_STUDENT'")
      .first();
    expect(unlinkAudit?.action).toBe('UNLINK');
  });

  it('enforces student/parent/teacher RBAC and R2 file upload, download, and delete across HTTP routes', async () => {
    const spy = vi.spyOn(bindings, 'resolveWorkerEnv').mockResolvedValue(testEnv);

    try {
      const aaravId = '14000000-0000-4000-8000-000000000001';
      const kabirId = '14000000-0000-4000-8000-000000000003';

      // 1. Student accesses own record (200) vs Kabir's record (403)
      const ownRes = await getStudentRoute(
        new Request(`http://localhost:3000/api/v1/students/${aaravId}`, {
          headers: { cookie: `sms_session=${STUDENT_TOKEN}` },
        }),
        { params: { id: aaravId } }
      );
      expect(ownRes.status).toBe(200);

      const otherRes = await getStudentRoute(
        new Request(`http://localhost:3000/api/v1/students/${kabirId}`, {
          headers: { cookie: `sms_session=${STUDENT_TOKEN}` },
        }),
        { params: { id: kabirId } }
      );
      expect(otherRes.status).toBe(403);

      // 2. Parent accesses linked children (Aarav + Diya = 2) and is denied Kabir (403)
      const myChildrenRes = await getMyChildrenRoute(
        new Request('http://localhost:3000/api/v1/parents/my-children', {
          headers: { cookie: `sms_session=${PARENT_TOKEN}` },
        })
      );
      expect(myChildrenRes.status).toBe(200);
      const myChildrenBody = await myChildrenRes.json();
      expect(myChildrenBody.data).toHaveLength(2);

      const parentKabirRes = await getStudentRoute(
        new Request(`http://localhost:3000/api/v1/students/${kabirId}`, {
          headers: { cookie: `sms_session=${PARENT_TOKEN}` },
        }),
        { params: { id: kabirId } }
      );
      expect(parentKabirRes.status).toBe(403);

      // 3. Teacher is denied broad student access in B4 (403)
      const teacherRes = await getStudentRoute(
        new Request(`http://localhost:3000/api/v1/students/${aaravId}`, {
          headers: { cookie: `sms_session=${TEACHER_TOKEN}` },
        }),
        { params: { id: aaravId } }
      );
      expect(teacherRes.status).toBe(403);

      // 4. R2 upload for Aarav (PNG) -> metadata -> authorized downloads -> delete
      const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);
      const form = new FormData();
      form.append('file', new File([pngBytes], '../../evil.png', { type: 'image/png' }));
      form.append('category', 'STUDENT_PHOTO');
      form.append('ownerEntityType', 'STUDENT');
      form.append('ownerEntityId', aaravId);

      const uploadRes = await postFileRoute(
        new Request('http://localhost:3000/api/v1/files', {
          method: 'POST',
          headers: {
            origin: 'http://localhost:3000',
            cookie: `sms_session=${ADMIN_TOKEN}`,
          },
          body: form,
        })
      );
      expect(uploadRes.status).toBe(201);
      const uploadBody = await uploadRes.json();
      const fileId = uploadBody.data.id;
      expect(uploadBody.data).not.toHaveProperty('r2ObjectKey');

      // Linked parent can download Aarav's photo
      const parentFileRes = await getFileRoute(
        new Request(`http://localhost:3000/api/v1/files/${fileId}`, {
          headers: { cookie: `sms_session=${PARENT_TOKEN}` },
        }),
        { params: { id: fileId } }
      );
      expect(parentFileRes.status).toBe(200);
      expect(parentFileRes.headers.get('content-type')).toBe('image/png');

      // Student can read metadata of own file (?meta=1)
      const studentMetaRes = await getFileRoute(
        new Request(`http://localhost:3000/api/v1/files/${fileId}?meta=1`, {
          headers: { cookie: `sms_session=${STUDENT_TOKEN}` },
        }),
        { params: { id: fileId } }
      );
      expect(studentMetaRes.status).toBe(200);

      // Teacher cannot download student file in B4 (403)
      const teacherFileRes = await getFileRoute(
        new Request(`http://localhost:3000/api/v1/files/${fileId}`, {
          headers: { cookie: `sms_session=${TEACHER_TOKEN}` },
        }),
        { params: { id: fileId } }
      );
      expect(teacherFileRes.status).toBe(403);

      // Admin deletes file -> removes from R2 & D1
      const delRes = await deleteFileRoute(
        new Request(`http://localhost:3000/api/v1/files/${fileId}`, {
          method: 'DELETE',
          headers: {
            origin: 'http://localhost:3000',
            cookie: `sms_session=${ADMIN_TOKEN}`,
          },
        }),
        { params: { id: fileId } }
      );
      expect(delRes.status).toBe(200);

      const studentObj = await getStudentByIdService(dbStudents, aaravId);
      expect(studentObj.id).toBe(aaravId);
      expect(storage).toBeTruthy();
    } finally {
      spy.mockRestore();
    }
  });
});
