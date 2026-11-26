import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  GET as getAcademicSessionRoute,
  PATCH as patchAcademicSessionRoute,
} from '@/app/api/v1/academic-sessions/[id]/route';
import {
  GET as listAcademicSessionsRoute,
  POST as createAcademicSessionRoute,
} from '@/app/api/v1/academic-sessions/route';
import {
  GET as getClassRoute,
  PATCH as patchClassRoute,
} from '@/app/api/v1/classes/[id]/route';
import {
  GET as listClassSubjectsRoute,
  POST as assignClassSubjectRoute,
} from '@/app/api/v1/classes/[id]/subjects/route';
import { DELETE as removeClassSubjectRoute } from '@/app/api/v1/classes/[id]/subjects/[subjectId]/route';
import {
  GET as listClassesRoute,
  POST as createClassRoute,
} from '@/app/api/v1/classes/route';
import {
  GET as getSubjectRoute,
  PATCH as patchSubjectRoute,
} from '@/app/api/v1/subjects/[id]/route';
import {
  GET as listSubjectsRoute,
  POST as createSubjectRoute,
} from '@/app/api/v1/subjects/route';
import { DELETE as deleteTeacherAssignmentRoute } from '@/app/api/v1/teacher-assignments/[id]/route';
import {
  GET as listTeacherAssignmentsRoute,
  POST as createTeacherAssignmentRoute,
} from '@/app/api/v1/teacher-assignments/route';
import {
  GET as getTeacherRoute,
  PATCH as patchTeacherRoute,
} from '@/app/api/v1/teachers/[id]/route';
import { GET as getTeacherRosterRoute } from '@/app/api/v1/teachers/me/classes/[classId]/roster/route';
import {
  GET as listTeachersRoute,
  POST as createTeacherRoute,
} from '@/app/api/v1/teachers/route';
import { hashSessionToken } from '@/lib/auth/crypto';
import { D1_BINDINGS } from '@/lib/cloudflare/bindings';
import * as bindings from '@/lib/cloudflare/bindings';
import { assertTeacherAssignedToClass, assertTeacherAssignedToClassSubject } from '@/modules/teachers/teachers.permissions';
import { createMultiD1Proxy } from '../helpers/multi-d1-proxy';

let ctx;
let testEnv;
let dbIdentity;
let dbStudents;
let dbAcademics;
let dbAudit;
let workerEnvSpy;

const SUPER_ADMIN_TOKEN = 'b5_superadmin_token_123456';
const ADMIN_TOKEN = 'b5_admin_token_123456';
const TEACHER_PRIYA_TOKEN = 'b5_teacher_priya_token_123456';
const TEACHER_VIKRAM_TOKEN = 'b5_teacher_vikram_token_123456';
const STUDENT_TOKEN = 'b5_student_token_123456';
const PARENT_TOKEN = 'b5_parent_token_123456';

const SEED_SESSION_2026 = '16000000-0000-4000-8000-000000000002';
const SEED_CLASS_9 = '17000000-0000-4000-8000-000000000001';
const SEED_CLASS_10 = '17000000-0000-4000-8000-000000000002';
const SEED_CLASS_11 = '17000000-0000-4000-8000-000000000003';
const SEED_MATH_10 = '18000000-0000-4000-8000-000000000001';
const SEED_TEACHER_PRIYA = '1b000000-0000-4000-8000-000000000001';
const SEED_TEACHER_VIKRAM = '1b000000-0000-4000-8000-000000000002';

function makeRequest(url, { method = 'GET', token = ADMIN_TOKEN, body } = {}) {
  const headers = new Headers();
  if (token) {
    headers.set('cookie', `sms_session=${token}`);
  }
  if (method !== 'GET' && method !== 'HEAD') {
    headers.set('origin', 'http://localhost:3000');
  }
  if (body !== undefined) {
    headers.set('content-type', 'application/json');
  }
  return new Request(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe('Phase B5 Academics & Teachers Multi-D1 Integration', () => {
  beforeAll(async () => {
    ctx = await createMultiD1Proxy({ applyMigrations: true, applySeeds: true });
    testEnv = {
      ...ctx.env,
      SESSION_SECRET: 'integration_test_session_secret_32chars',
      ENVIRONMENT: 'test',
    };
    dbIdentity = ctx.dbs[D1_BINDINGS.IDENTITY];
    dbStudents = ctx.dbs[D1_BINDINGS.STUDENTS];
    dbAcademics = ctx.dbs[D1_BINDINGS.ACADEMICS];
    dbAudit = ctx.dbs[D1_BINDINGS.AUDIT];

    workerEnvSpy = vi.spyOn(bindings, 'resolveWorkerEnv').mockResolvedValue(testEnv);

    const futureExpiry = new Date(Date.now() + 86_400_000).toISOString();
    const now = new Date().toISOString();
    const sessionSpecs = [
      { userId: '11000000-0000-4000-8000-000000000001', token: SUPER_ADMIN_TOKEN },
      { userId: '11000000-0000-4000-8000-000000000002', token: ADMIN_TOKEN },
      { userId: '11000000-0000-4000-8000-000000000003', token: TEACHER_PRIYA_TOKEN },
      { userId: '11000000-0000-4000-8000-000000000004', token: TEACHER_VIKRAM_TOKEN },
      { userId: '11000000-0000-4000-8000-000000000005', token: STUDENT_TOKEN },
      { userId: '11000000-0000-4000-8000-000000000006', token: PARENT_TOKEN },
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
    workerEnvSpy?.mockRestore();
    if (ctx) {
      await ctx.cleanup();
    }
  });

  it('manages academic sessions: create, list/paginate, get, update, atomic single-active toggle, 409 conflict, and audit_logs', async () => {
    // Create active session 2027-2028 -> deactivates seeded 2026-2027 atomically
    const createRes = await createAcademicSessionRoute(
      makeRequest('http://localhost:3000/api/v1/academic-sessions', {
        method: 'POST',
        token: SUPER_ADMIN_TOKEN,
        body: {
          name: '2027-2028',
          startDate: '2027-04-01',
          endDate: '2028-03-31',
          isActive: true,
        },
      })
    );
    expect(createRes.status).toBe(201);
    const createdBody = await createRes.json();
    const createdId = createdBody.data.id;
    expect(createdBody.data.isActive).toBe(true);

    const activeRows = await dbAcademics
      .prepare('SELECT id FROM academic_sessions WHERE is_active = 1')
      .all();
    expect(activeRows.results).toHaveLength(1);
    expect(activeRows.results[0].id).toBe(createdId);

    // Duplicate name -> 409 CONFLICT
    const dupRes = await createAcademicSessionRoute(
      makeRequest('http://localhost:3000/api/v1/academic-sessions', {
        method: 'POST',
        token: ADMIN_TOKEN,
        body: {
          name: '2027-2028',
          startDate: '2027-04-01',
          endDate: '2028-03-31',
          isActive: false,
        },
      })
    );
    expect(dupRes.status).toBe(409);

    // List with pagination
    const listRes = await listAcademicSessionsRoute(
      makeRequest('http://localhost:3000/api/v1/academic-sessions?page=1&pageSize=2', {
        token: ADMIN_TOKEN,
      })
    );
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.data).toHaveLength(2);
    expect(listBody.pagination.total).toBeGreaterThanOrEqual(3);

    // Get by ID
    const getRes = await getAcademicSessionRoute(
      makeRequest(`http://localhost:3000/api/v1/academic-sessions/${createdId}`, {
        token: ADMIN_TOKEN,
      }),
      { params: { id: createdId } }
    );
    expect(getRes.status).toBe(200);

    // Update name & restore 2026-2027 as active for subsequent tests
    const patchNewRes = await patchAcademicSessionRoute(
      makeRequest(`http://localhost:3000/api/v1/academic-sessions/${createdId}`, {
        method: 'PATCH',
        token: ADMIN_TOKEN,
        body: { name: '2027-2028-Updated', isActive: false },
      }),
      { params: { id: createdId } }
    );
    expect(patchNewRes.status).toBe(200);
    expect((await patchNewRes.json()).data.name).toBe('2027-2028-Updated');

    const reactivateRes = await patchAcademicSessionRoute(
      makeRequest(`http://localhost:3000/api/v1/academic-sessions/${SEED_SESSION_2026}`, {
        method: 'PATCH',
        token: ADMIN_TOKEN,
        body: { isActive: true },
      }),
      { params: { id: SEED_SESSION_2026 } }
    );
    expect(reactivateRes.status).toBe(200);

    // Verify best-effort DB_AUDIT.audit_logs recorded the session creation
    const auditRow = await dbAudit
      .prepare("SELECT action, entity_type FROM audit_logs WHERE entity_type = 'ACADEMIC_SESSION' AND entity_id = ? LIMIT 1")
      .bind(createdId)
      .first();
    expect(auditRow?.action).toBe('CREATE');
  });

  it('manages classes, subjects, and class_subjects mappings with 400/404/409 handling', async () => {
    // Create class
    const clsRes = await createClassRoute(
      makeRequest('http://localhost:3000/api/v1/classes', {
        method: 'POST',
        token: ADMIN_TOKEN,
        body: { name: 'Class 12', gradeLevel: 12, section: 'A' },
      })
    );
    expect(clsRes.status).toBe(201);
    const classId = (await clsRes.json()).data.id;

    // List & get & update class
    const listClsRes = await listClassesRoute(
      makeRequest('http://localhost:3000/api/v1/classes?gradeLevel=12', { token: ADMIN_TOKEN })
    );
    expect(listClsRes.status).toBe(200);
    expect((await listClsRes.json()).data).toHaveLength(1);

    const getClsRes = await getClassRoute(
      makeRequest(`http://localhost:3000/api/v1/classes/${classId}`, { token: ADMIN_TOKEN }),
      { params: { id: classId } }
    );
    expect(getClsRes.status).toBe(200);

    const patchClsRes = await patchClassRoute(
      makeRequest(`http://localhost:3000/api/v1/classes/${classId}`, {
        method: 'PATCH',
        token: ADMIN_TOKEN,
        body: { section: 'B' },
      }),
      { params: { id: classId } }
    );
    expect(patchClsRes.status).toBe(200);
    expect((await patchClsRes.json()).data.section).toBe('B');

    // Create subject
    const subjRes = await createSubjectRoute(
      makeRequest('http://localhost:3000/api/v1/subjects', {
        method: 'POST',
        token: ADMIN_TOKEN,
        body: { name: 'Computer Science', code: 'cs-12' },
      })
    );
    expect(subjRes.status).toBe(201);
    const subjectData = (await subjRes.json()).data;
    expect(subjectData.code).toBe('CS-12');
    const subjectId = subjectData.id;

    const listSubjRes = await listSubjectsRoute(
      makeRequest('http://localhost:3000/api/v1/subjects?search=Computer', { token: ADMIN_TOKEN })
    );
    expect(listSubjRes.status).toBe(200);
    expect((await listSubjRes.json()).data).toHaveLength(1);

    const getSubjRes = await getSubjectRoute(
      makeRequest(`http://localhost:3000/api/v1/subjects/${subjectId}`, { token: ADMIN_TOKEN }),
      { params: { id: subjectId } }
    );
    expect(getSubjRes.status).toBe(200);

    const patchSubjRes = await patchSubjectRoute(
      makeRequest(`http://localhost:3000/api/v1/subjects/${subjectId}`, {
        method: 'PATCH',
        token: ADMIN_TOKEN,
        body: { name: 'Computer Science & AI' },
      }),
      { params: { id: subjectId } }
    );
    expect(patchSubjRes.status).toBe(200);

    // Filter seeded class-subjects by session
    const seededCsRes = await listClassSubjectsRoute(
      makeRequest(`http://localhost:3000/api/v1/classes/${SEED_CLASS_9}/subjects?academicSessionId=${SEED_SESSION_2026}`, {
        token: TEACHER_PRIYA_TOKEN,
      }),
      { params: { id: SEED_CLASS_9 } }
    );
    expect(seededCsRes.status).toBe(200);
    expect((await seededCsRes.json()).data).toHaveLength(2);

    // Assign subject to class -> 201
    const assignRes = await assignClassSubjectRoute(
      makeRequest(`http://localhost:3000/api/v1/classes/${classId}/subjects`, {
        method: 'POST',
        token: ADMIN_TOKEN,
        body: { academicSessionId: SEED_SESSION_2026, subjectId },
      }),
      { params: { id: classId } }
    );
    expect(assignRes.status).toBe(201);

    // Duplicate class-subject -> 409
    const dupAssignRes = await assignClassSubjectRoute(
      makeRequest(`http://localhost:3000/api/v1/classes/${classId}/subjects`, {
        method: 'POST',
        token: ADMIN_TOKEN,
        body: { academicSessionId: SEED_SESSION_2026, subjectId },
      }),
      { params: { id: classId } }
    );
    expect(dupAssignRes.status).toBe(409);

    // Invalid UUID -> 400, nonexistent session/subject -> 404
    const badIdRes = await assignClassSubjectRoute(
      makeRequest('http://localhost:3000/api/v1/classes/not-a-uuid/subjects', {
        method: 'POST',
        token: ADMIN_TOKEN,
        body: { academicSessionId: SEED_SESSION_2026, subjectId },
      }),
      { params: { id: 'not-a-uuid' } }
    );
    expect(badIdRes.status).toBe(400);

    const missingSessionRes = await assignClassSubjectRoute(
      makeRequest(`http://localhost:3000/api/v1/classes/${classId}/subjects`, {
        method: 'POST',
        token: ADMIN_TOKEN,
        body: {
          academicSessionId: '16000000-0000-4000-8000-999999999999',
          subjectId,
        },
      }),
      { params: { id: classId } }
    );
    expect(missingSessionRes.status).toBe(404);

    // Remove class-subject -> 200
    const removeRes = await removeClassSubjectRoute(
      makeRequest(
        `http://localhost:3000/api/v1/classes/${classId}/subjects/${subjectId}?academicSessionId=${SEED_SESSION_2026}`,
        { method: 'DELETE', token: ADMIN_TOKEN }
      ),
      { params: { id: classId, subjectId } }
    );
    expect(removeRes.status).toBe(200);
  });

  it('validates cross-D1 teacher creation, employment status assignment denial, and teacher_assignments CRUD', async () => {
    const now = new Date().toISOString();
    const inactiveUserId = crypto.randomUUID();
    const activeUserId = crypto.randomUUID();
    const photoFileId = crypto.randomUUID();

    await dbIdentity.batch([
      dbIdentity
        .prepare('INSERT INTO users (id, phone_normalized, email, is_active, created_at, updated_at) VALUES (?, ?, NULL, 0, ?, ?)')
        .bind(inactiveUserId, '+919876590001', now, now),
      dbIdentity
        .prepare('INSERT INTO users (id, phone_normalized, email, is_active, created_at, updated_at) VALUES (?, ?, NULL, 1, ?, ?)')
        .bind(activeUserId, '+919876590002', now, now),
    ]);

    await dbStudents
      .prepare(
        `INSERT INTO file_objects (id, r2_object_key, category, mime_type, size_bytes, owner_entity_type, owner_entity_id, uploaded_by_user_id, created_at)
         VALUES (?, ?, 'TEACHER_PHOTO', 'image/png', 128, NULL, NULL, ?, ?)`
      )
      .bind(photoFileId, `uploads/teacher_photo/${photoFileId}.png`, '11000000-0000-4000-8000-000000000002', now)
      .run();

    // Inactive user in DB_IDENTITY -> 400
    const inactiveUserRes = await createTeacherRoute(
      makeRequest('http://localhost:3000/api/v1/teachers', {
        method: 'POST',
        token: ADMIN_TOKEN,
        body: {
          userId: inactiveUserId,
          employeeCode: 'TCH-901',
          fullName: 'Inactive User Teacher',
          joiningDate: '2026-05-01',
        },
      })
    );
    expect(inactiveUserRes.status).toBe(400);

    // Nonexistent photoFileId in DB_STUDENTS -> 400
    const badPhotoRes = await createTeacherRoute(
      makeRequest('http://localhost:3000/api/v1/teachers', {
        method: 'POST',
        token: ADMIN_TOKEN,
        body: {
          userId: activeUserId,
          employeeCode: 'TCH-902',
          fullName: 'Bad Photo Teacher',
          joiningDate: '2026-05-01',
          photoFileId: '99999999-0000-4000-8000-000000000001',
        },
      })
    );
    expect(badPhotoRes.status).toBe(400);

    // Valid active user + valid file_objects -> 201
    const createTeacherRes = await createTeacherRoute(
      makeRequest('http://localhost:3000/api/v1/teachers', {
        method: 'POST',
        token: ADMIN_TOKEN,
        body: {
          userId: activeUserId,
          employeeCode: 'TCH-903',
          fullName: 'Meera Iyer',
          qualification: 'M.A. English',
          specialization: 'Literature',
          joiningDate: '2026-05-01',
          photoFileId,
        },
      })
    );
    expect(createTeacherRes.status).toBe(201);
    const teacherId = (await createTeacherRes.json()).data.id;

    // List teachers
    const listRes = await listTeachersRoute(
      makeRequest('http://localhost:3000/api/v1/teachers?search=Meera', { token: ADMIN_TOKEN })
    );
    expect(listRes.status).toBe(200);
    expect((await listRes.json()).data).toHaveLength(1);

    // Create teacher assignment -> 201
    const assignRes = await createTeacherAssignmentRoute(
      makeRequest('http://localhost:3000/api/v1/teacher-assignments', {
        method: 'POST',
        token: ADMIN_TOKEN,
        body: {
          teacherProfileId: teacherId,
          academicSessionId: SEED_SESSION_2026,
          classId: SEED_CLASS_11,
          subjectId: SEED_MATH_10,
          responsibilityCategory: 'REGULAR_TEACHER',
        },
      })
    );
    expect(assignRes.status).toBe(201);
    const assignmentId = (await assignRes.json()).data.id;

    // Duplicate teacher assignment -> 409
    const dupAssignRes = await createTeacherAssignmentRoute(
      makeRequest('http://localhost:3000/api/v1/teacher-assignments', {
        method: 'POST',
        token: ADMIN_TOKEN,
        body: {
          teacherProfileId: teacherId,
          academicSessionId: SEED_SESSION_2026,
          classId: SEED_CLASS_11,
          subjectId: SEED_MATH_10,
          responsibilityCategory: 'REGULAR_TEACHER',
        },
      })
    );
    expect(dupAssignRes.status).toBe(409);

    // Verify active teacher passes assignment checks
    const teacherSession = { roles: ['TEACHER'], profiles: { teacherProfileId: teacherId } };
    expect(
      await assertTeacherAssignedToClass(dbAcademics, teacherSession, {
        academicSessionId: SEED_SESSION_2026,
        classId: SEED_CLASS_11,
      })
    ).toBeNull();

    // Update employmentStatus to INACTIVE -> assignment checks deny (403)
    const deactivateRes = await patchTeacherRoute(
      makeRequest(`http://localhost:3000/api/v1/teachers/${teacherId}`, {
        method: 'PATCH',
        token: ADMIN_TOKEN,
        body: { employmentStatus: 'INACTIVE' },
      }),
      { params: { id: teacherId } }
    );
    expect(deactivateRes.status).toBe(200);

    expect(
      (
        await assertTeacherAssignedToClass(dbAcademics, teacherSession, {
          academicSessionId: SEED_SESSION_2026,
          classId: SEED_CLASS_11,
        })
      )?.status
    ).toBe(403);
    expect(
      (
        await assertTeacherAssignedToClassSubject(dbAcademics, teacherSession, {
          academicSessionId: SEED_SESSION_2026,
          classId: SEED_CLASS_11,
          subjectId: SEED_MATH_10,
        })
      )?.status
    ).toBe(403);

    // List & delete teacher assignment
    const listAssignRes = await listTeacherAssignmentsRoute(
      makeRequest(`http://localhost:3000/api/v1/teacher-assignments?teacherProfileId=${teacherId}`, {
        token: ADMIN_TOKEN,
      })
    );
    expect(listAssignRes.status).toBe(200);
    expect((await listAssignRes.json()).data).toHaveLength(1);

    const delAssignRes = await deleteTeacherAssignmentRoute(
      makeRequest(`http://localhost:3000/api/v1/teacher-assignments/${assignmentId}`, {
        method: 'DELETE',
        token: ADMIN_TOKEN,
      }),
      { params: { id: assignmentId } }
    );
    expect(delAssignRes.status).toBe(200);
  });

  it('enforces RBAC and teacher class roster scoping across HTTP route handlers', async () => {
    // 1. Unauthenticated -> 401
    expect(
      (await listTeachersRoute(makeRequest('http://localhost:3000/api/v1/teachers', { token: null }))).status
    ).toBe(401);
    expect(
      (
        await getTeacherRosterRoute(
          makeRequest(`http://localhost:3000/api/v1/teachers/me/classes/${SEED_CLASS_10}/roster`, {
            token: null,
          }),
          { params: { classId: SEED_CLASS_10 } }
        )
      ).status
    ).toBe(401);

    // 2. STUDENT / PARENT denied admin endpoints -> 403
    expect(
      (
        await createAcademicSessionRoute(
          makeRequest('http://localhost:3000/api/v1/academic-sessions', {
            method: 'POST',
            token: STUDENT_TOKEN,
            body: { name: '2029-2030', startDate: '2029-04-01', endDate: '2030-03-31' },
          })
        )
      ).status
    ).toBe(403);
    expect(
      (await listTeachersRoute(makeRequest('http://localhost:3000/api/v1/teachers', { token: PARENT_TOKEN }))).status
    ).toBe(403);

    // 3. TEACHER self-profile allowed (200) vs other teacher denied (403)
    const ownProfileRes = await getTeacherRoute(
      makeRequest(`http://localhost:3000/api/v1/teachers/${SEED_TEACHER_PRIYA}`, {
        token: TEACHER_PRIYA_TOKEN,
      }),
      { params: { id: SEED_TEACHER_PRIYA } }
    );
    expect(ownProfileRes.status).toBe(200);

    const otherProfileRes = await getTeacherRoute(
      makeRequest(`http://localhost:3000/api/v1/teachers/${SEED_TEACHER_VIKRAM}`, {
        token: TEACHER_PRIYA_TOKEN,
      }),
      { params: { id: SEED_TEACHER_VIKRAM } }
    );
    expect(otherProfileRes.status).toBe(403);

    // 4. TEACHER assigned class roster returns only active students in that class (bounded pagination)
    const rosterRes = await getTeacherRosterRoute(
      makeRequest(
        `http://localhost:3000/api/v1/teachers/me/classes/${SEED_CLASS_10}/roster?page=1&pageSize=1`,
        { token: TEACHER_PRIYA_TOKEN }
      ),
      { params: { classId: SEED_CLASS_10 } }
    );
    expect(rosterRes.status).toBe(200);
    const rosterBody = await rosterRes.json();
    expect(rosterBody.data).toHaveLength(1);
    expect(rosterBody.pagination.total).toBe(2); // Aarav & Kabir in Class 10
    expect(rosterBody.data[0].lifecycleStatus).toBe('ACTIVE');

    // 5. TEACHER unassigned class roster -> 403
    const unassignedRosterRes = await getTeacherRosterRoute(
      makeRequest(`http://localhost:3000/api/v1/teachers/me/classes/${SEED_CLASS_11}/roster`, {
        token: TEACHER_PRIYA_TOKEN,
      }),
      { params: { classId: SEED_CLASS_11 } }
    );
    expect(unassignedRosterRes.status).toBe(403);
  });
});
