import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  GET as listCorrectionsRoute,
  POST as createCorrectionRoute,
} from '@/app/api/v1/attendance/corrections/route';
import { PUT as markDailyRecordsRoute } from '@/app/api/v1/attendance/daily/registers/[id]/records/route';
import { GET as getDailyRegisterRoute } from '@/app/api/v1/attendance/daily/registers/[id]/route';
import {
  GET as listDailyRegistersRoute,
  POST as createDailyRegisterRoute,
} from '@/app/api/v1/attendance/daily/registers/route';
import { PUT as markPeriodRecordsRoute } from '@/app/api/v1/attendance/period/registers/[id]/records/route';
import { GET as getPeriodRegisterRoute } from '@/app/api/v1/attendance/period/registers/[id]/route';
import {
  GET as listPeriodRegistersRoute,
  POST as createPeriodRegisterRoute,
} from '@/app/api/v1/attendance/period/registers/route';
import { GET as getStudentAttendanceRoute } from '@/app/api/v1/attendance/students/[studentId]/route';
import { GET as getAttendanceSummaryRoute } from '@/app/api/v1/attendance/summary/route';
import { hashSessionToken } from '@/lib/auth/crypto';
import * as bindings from '@/lib/cloudflare/bindings';
import { D1_BINDINGS } from '@/lib/cloudflare/bindings';
import { createMultiD1Proxy } from '../helpers/multi-d1-proxy';

let ctx;
let testEnv;
let dbIdentity;
let dbAcademics;
let dbAttendance;
let workerEnvSpy;

const SUPER_ADMIN_TOKEN = 'b6_superadmin_token_123456';
const ADMIN_TOKEN = 'b6_admin_token_123456';
const TEACHER_PRIYA_TOKEN = 'b6_teacher_priya_token_123456';
const TEACHER_VIKRAM_TOKEN = 'b6_teacher_vikram_token_123456';
const STUDENT_TOKEN = 'b6_student_token_123456';
const PARENT_TOKEN = 'b6_parent_token_123456';

const SEED_SESSION_2026 = '16000000-0000-4000-8000-000000000002';
const SEED_CLASS_9 = '17000000-0000-4000-8000-000000000001';
const SEED_CLASS_10 = '17000000-0000-4000-8000-000000000002';
const SEED_CLASS_11 = '17000000-0000-4000-8000-000000000003';

const SEED_MATH_10 = '18000000-0000-4000-8000-000000000001';
const SEED_SCI_10 = '18000000-0000-4000-8000-000000000002';
const SEED_SCI_09 = '18000000-0000-4000-8000-000000000005';

const SEED_TEACHER_PRIYA = '1b000000-0000-4000-8000-000000000001';
const SEED_STUDENT_AARAV = '14000000-0000-4000-8000-000000000001';
const SEED_STUDENT_DIYA = '14000000-0000-4000-8000-000000000002';
const SEED_STUDENT_KABIR = '14000000-0000-4000-8000-000000000003';

const SEED_ENROLLMENT_AARAV_10 = '1a000000-0000-4000-8000-000000000002';
const SEED_ENROLLMENT_DIYA_09 = '1a000000-0000-4000-8000-000000000003';
const SEED_ENROLLMENT_KABIR_10 = '1a000000-0000-4000-8000-000000000004';

const SEED_DAILY_REGISTER = '1d000000-0000-4000-8000-000000000001';

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

describe('Phase B6 Attendance Multi-D1 Integration', () => {
  beforeAll(async () => {
    ctx = await createMultiD1Proxy({ applyMigrations: true, applySeeds: true });
    testEnv = {
      ...ctx.env,
      SESSION_SECRET: 'integration_test_session_secret_32chars',
      ENVIRONMENT: 'test',
    };
    dbIdentity = ctx.dbs[D1_BINDINGS.IDENTITY];
    dbAcademics = ctx.dbs[D1_BINDINGS.ACADEMICS];
    dbAttendance = ctx.dbs[D1_BINDINGS.ATTENDANCE];

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
              `INSERT INTO sessions (id, user_id, token_hash, ip_address, user_agent, expires_at, created_at)
               VALUES (?, ?, ?, '127.0.0.1', 'vitest', ?, ?)`
            )
            .bind(
              crypto.randomUUID(),
              s.userId,
              await hashSessionToken(s.token, testEnv.SESSION_SECRET),
              futureExpiry,
              now
            )
        )
      )
    );
  }, 60_000);

  afterAll(async () => {
    workerEnvSpy?.mockRestore();
    if (ctx) {
      await ctx.cleanup();
    }
  }, 30_000);

  it('supports daily attendance register creation, duplicate 409, record marking/updating, validation, retrieval, student history, and summary', async () => {
    // Assigned teacher (Priya -> Class 10) creates a daily register for 2026-11-24
    const createRes = await createDailyRegisterRoute(
      makeRequest('http://localhost:3000/api/v1/attendance/daily/registers', {
        method: 'POST',
        token: TEACHER_PRIYA_TOKEN,
        body: {
          academicSessionId: SEED_SESSION_2026,
          classId: SEED_CLASS_10,
          attendanceDate: '2026-11-24',
        },
      })
    );
    expect(createRes.status).toBe(201);
    const createdBody = await createRes.json();
    const registerId = createdBody.data.id;
    expect(createdBody.data.markedByTeacherId).toBe(SEED_TEACHER_PRIYA);
    expect(createdBody.data.records).toEqual([]);

    // Duplicate scope returns 409
    const dupRes = await createDailyRegisterRoute(
      makeRequest('http://localhost:3000/api/v1/attendance/daily/registers', {
        method: 'POST',
        token: ADMIN_TOKEN,
        body: {
          academicSessionId: SEED_SESSION_2026,
          classId: SEED_CLASS_10,
          attendanceDate: '2026-11-24',
        },
      })
    );
    expect(dupRes.status).toBe(409);

    // Invalid academic session or class rejected (400)
    const badSessionRes = await createDailyRegisterRoute(
      makeRequest('http://localhost:3000/api/v1/attendance/daily/registers', {
        method: 'POST',
        token: ADMIN_TOKEN,
        body: {
          academicSessionId: '99999999-0000-4000-8000-000000000001',
          classId: SEED_CLASS_10,
          attendanceDate: '2026-11-24',
        },
      })
    );
    expect(badSessionRes.status).toBe(400);

    const badClassRes = await createDailyRegisterRoute(
      makeRequest('http://localhost:3000/api/v1/attendance/daily/registers', {
        method: 'POST',
        token: ADMIN_TOKEN,
        body: {
          academicSessionId: SEED_SESSION_2026,
          classId: '99999999-0000-4000-8000-000000000002',
          attendanceDate: '2026-11-24',
        },
      })
    );
    expect(badClassRes.status).toBe(400);

    // Reject enrollment from wrong class (Diya is in Class 9)
    const wrongClassEnrollmentRes = await markDailyRecordsRoute(
      makeRequest(`http://localhost:3000/api/v1/attendance/daily/registers/${registerId}/records`, {
        method: 'PUT',
        token: TEACHER_PRIYA_TOKEN,
        body: {
          records: [{ enrollmentId: SEED_ENROLLMENT_DIYA_09, status: 'PRESENT' }],
        },
      }),
      { params: Promise.resolve({ id: registerId }) }
    );
    expect(wrongClassEnrollmentRes.status).toBe(400);

    // Mark records for Class 10 students (Aarav, Kabir)
    const markRes = await markDailyRecordsRoute(
      makeRequest(`http://localhost:3000/api/v1/attendance/daily/registers/${registerId}/records`, {
        method: 'PUT',
        token: TEACHER_PRIYA_TOKEN,
        body: {
          records: [
            { enrollmentId: SEED_ENROLLMENT_AARAV_10, status: 'PRESENT', remarks: 'On time' },
            { enrollmentId: SEED_ENROLLMENT_KABIR_10, status: 'ABSENT', remarks: 'Sick' },
          ],
        },
      }),
      { params: Promise.resolve({ id: registerId }) }
    );
    expect(markRes.status).toBe(200);
    const markedBody = await markRes.json();
    expect(markedBody.data.records).toHaveLength(2);

    // Update existing record on unlocked register
    const updateMarkRes = await markDailyRecordsRoute(
      makeRequest(`http://localhost:3000/api/v1/attendance/daily/registers/${registerId}/records`, {
        method: 'PUT',
        token: TEACHER_PRIYA_TOKEN,
        body: {
          records: [
            { enrollmentId: SEED_ENROLLMENT_AARAV_10, status: 'PRESENT' },
            { enrollmentId: SEED_ENROLLMENT_KABIR_10, status: 'LATE', remarks: 'Arrived p2' },
          ],
        },
      }),
      { params: Promise.resolve({ id: registerId }) }
    );
    expect(updateMarkRes.status).toBe(200);
    const updatedBody = await updateMarkRes.json();
    const kabirRecord = updatedBody.data.records.find(
      (r) => r.enrollmentId === SEED_ENROLLMENT_KABIR_10
    );
    expect(kabirRecord.status).toBe('LATE');

    // Retrieve by ID, by scope, and list
    const byIdRes = await getDailyRegisterRoute(
      makeRequest(`http://localhost:3000/api/v1/attendance/daily/registers/${registerId}`, {
        token: TEACHER_PRIYA_TOKEN,
      }),
      { params: Promise.resolve({ id: registerId }) }
    );
    expect(byIdRes.status).toBe(200);

    const byScopeRes = await listDailyRegistersRoute(
      makeRequest(
        `http://localhost:3000/api/v1/attendance/daily/registers?academicSessionId=${SEED_SESSION_2026}&classId=${SEED_CLASS_10}&attendanceDate=2026-11-24`,
        { token: TEACHER_PRIYA_TOKEN }
      )
    );
    expect(byScopeRes.status).toBe(200);
    expect((await byScopeRes.json()).data.id).toBe(registerId);

    const listRes = await listDailyRegistersRoute(
      makeRequest('http://localhost:3000/api/v1/attendance/daily/registers?page=1&pageSize=10', {
        token: ADMIN_TOKEN,
      })
    );
    expect(listRes.status).toBe(200);
    expect((await listRes.json()).data.length).toBeGreaterThanOrEqual(2);

    // Student attendance history
    const studentHistoryRes = await getStudentAttendanceRoute(
      makeRequest(
        `http://localhost:3000/api/v1/attendance/students/${SEED_STUDENT_AARAV}?registerType=DAILY`,
        { token: STUDENT_TOKEN }
      ),
      { params: Promise.resolve({ studentId: SEED_STUDENT_AARAV }) }
    );
    expect(studentHistoryRes.status).toBe(200);
    const historyBody = await studentHistoryRes.json();
    expect(historyBody.data.length).toBeGreaterThanOrEqual(2);

    // Attendance summary
    const summaryRes = await getAttendanceSummaryRoute(
      makeRequest(
        `http://localhost:3000/api/v1/attendance/summary?academicSessionId=${SEED_SESSION_2026}&classId=${SEED_CLASS_10}&registerType=DAILY`,
        { token: TEACHER_PRIYA_TOKEN }
      )
    );
    expect(summaryRes.status).toBe(200);
    const summaryBody = await summaryRes.json();
    const aaravSummary = summaryBody.data.find(
      (s) => s.enrollmentId === SEED_ENROLLMENT_AARAV_10
    );
    expect(aaravSummary.presentCount).toBeGreaterThanOrEqual(2);
  });

  it('supports period attendance register creation, duplicate 409, record marking, and class-subject/teacher validation', async () => {
    // Admin rejected when subject is not mapped to class+session (SCI_09 is not mapped to Class 10)
    const unmappedSubjectRes = await createPeriodRegisterRoute(
      makeRequest('http://localhost:3000/api/v1/attendance/period/registers', {
        method: 'POST',
        token: ADMIN_TOKEN,
        body: {
          academicSessionId: SEED_SESSION_2026,
          classId: SEED_CLASS_10,
          subjectId: SEED_SCI_09,
          attendanceDate: '2026-11-24',
          periodNumber: 2,
        },
      })
    );
    expect(unmappedSubjectRes.status).toBe(400);

    // Teacher Priya is NOT assigned to Math-10 -> 403
    const unassignedSubjectRes = await createPeriodRegisterRoute(
      makeRequest('http://localhost:3000/api/v1/attendance/period/registers', {
        method: 'POST',
        token: TEACHER_PRIYA_TOKEN,
        body: {
          academicSessionId: SEED_SESSION_2026,
          classId: SEED_CLASS_10,
          subjectId: SEED_MATH_10,
          attendanceDate: '2026-11-24',
          periodNumber: 2,
        },
      })
    );
    expect(unassignedSubjectRes.status).toBe(403);

    // Teacher Priya IS assigned to Science-10 -> 201
    const createPeriodRes = await createPeriodRegisterRoute(
      makeRequest('http://localhost:3000/api/v1/attendance/period/registers', {
        method: 'POST',
        token: TEACHER_PRIYA_TOKEN,
        body: {
          academicSessionId: SEED_SESSION_2026,
          classId: SEED_CLASS_10,
          subjectId: SEED_SCI_10,
          attendanceDate: '2026-11-24',
          periodNumber: 2,
        },
      })
    );
    expect(createPeriodRes.status).toBe(201);
    const periodRegisterId = (await createPeriodRes.json()).data.id;

    // Duplicate period register -> 409
    const dupPeriodRes = await createPeriodRegisterRoute(
      makeRequest('http://localhost:3000/api/v1/attendance/period/registers', {
        method: 'POST',
        token: TEACHER_PRIYA_TOKEN,
        body: {
          academicSessionId: SEED_SESSION_2026,
          classId: SEED_CLASS_10,
          subjectId: SEED_SCI_10,
          attendanceDate: '2026-11-24',
          periodNumber: 2,
        },
      })
    );
    expect(dupPeriodRes.status).toBe(409);

    // Mark period records
    const markPeriodRes = await markPeriodRecordsRoute(
      makeRequest(
        `http://localhost:3000/api/v1/attendance/period/registers/${periodRegisterId}/records`,
        {
          method: 'PUT',
          token: TEACHER_PRIYA_TOKEN,
          body: {
            records: [
              { enrollmentId: SEED_ENROLLMENT_AARAV_10, status: 'PRESENT' },
              { enrollmentId: SEED_ENROLLMENT_KABIR_10, status: 'LEAVE', remarks: 'Medical' },
            ],
          },
        }
      ),
      { params: Promise.resolve({ id: periodRegisterId }) }
    );
    expect(markPeriodRes.status).toBe(200);
    expect((await markPeriodRes.json()).data.records).toHaveLength(2);

    // Retrieve period register by ID and list
    const getPeriodRes = await getPeriodRegisterRoute(
      makeRequest(`http://localhost:3000/api/v1/attendance/period/registers/${periodRegisterId}`, {
        token: TEACHER_PRIYA_TOKEN,
      }),
      { params: Promise.resolve({ id: periodRegisterId }) }
    );
    expect(getPeriodRes.status).toBe(200);

    const listPeriodRes = await listPeriodRegistersRoute(
      makeRequest(
        `http://localhost:3000/api/v1/attendance/period/registers?academicSessionId=${SEED_SESSION_2026}&classId=${SEED_CLASS_10}&subjectId=${SEED_SCI_10}`,
        { token: TEACHER_PRIYA_TOKEN }
      )
    );
    expect(listPeriodRes.status).toBe(200);
    expect((await listPeriodRes.json()).data.length).toBeGreaterThanOrEqual(1);
  });

  it('enforces locked register protection (409) and audit-tracked attendance corrections', async () => {
    // Lock the seeded daily register
    await dbAttendance
      .prepare('UPDATE attendance_days SET is_locked = 1 WHERE id = ?')
      .bind(SEED_DAILY_REGISTER)
      .run();

    // Normal PUT .../records rejected with 409 REGISTER_LOCKED
    const lockedPutRes = await markDailyRecordsRoute(
      makeRequest(
        `http://localhost:3000/api/v1/attendance/daily/registers/${SEED_DAILY_REGISTER}/records`,
        {
          method: 'PUT',
          token: ADMIN_TOKEN,
          body: {
            records: [{ enrollmentId: SEED_ENROLLMENT_AARAV_10, status: 'ABSENT' }],
          },
        }
      ),
      { params: Promise.resolve({ id: SEED_DAILY_REGISTER }) }
    );
    expect(lockedPutRes.status).toBe(409);
    expect((await lockedPutRes.json()).error.code).toBe('REGISTER_LOCKED');

    const seededRecordId = '1e000000-0000-4000-8000-000000000001'; // currently PRESENT

    // Teacher cannot apply correction -> 403
    const teacherCorrectionRes = await createCorrectionRoute(
      makeRequest('http://localhost:3000/api/v1/attendance/corrections', {
        method: 'POST',
        token: TEACHER_PRIYA_TOKEN,
        body: {
          registerType: 'DAILY',
          registerId: SEED_DAILY_REGISTER,
          recordId: seededRecordId,
          newStatus: 'ABSENT',
          reason: 'Teacher attempted correction',
        },
      })
    );
    expect(teacherCorrectionRes.status).toBe(403);

    // No-op correction (newStatus === previousStatus) -> 400
    const noopRes = await createCorrectionRoute(
      makeRequest('http://localhost:3000/api/v1/attendance/corrections', {
        method: 'POST',
        token: ADMIN_TOKEN,
        body: {
          registerType: 'DAILY',
          registerId: SEED_DAILY_REGISTER,
          recordId: seededRecordId,
          newStatus: 'PRESENT',
          reason: 'No change',
        },
      })
    );
    expect(noopRes.status).toBe(400);

    // COACHING_ADMIN applies correction -> 201
    const correctionRes = await createCorrectionRoute(
      makeRequest('http://localhost:3000/api/v1/attendance/corrections', {
        method: 'POST',
        token: ADMIN_TOKEN,
        body: {
          registerType: 'DAILY',
          registerId: SEED_DAILY_REGISTER,
          recordId: seededRecordId,
          newStatus: 'LEAVE',
          reason: 'Approved medical leave retroactively',
        },
      })
    );
    expect(correctionRes.status).toBe(201);
    const correctionBody = await correctionRes.json();
    expect(correctionBody.data.previousStatus).toBe('PRESENT');
    expect(correctionBody.data.newStatus).toBe('LEAVE');

    // Verify attendance_corrections, updated record, and DB_ATTENDANCE.audit_outbox
    const persistedRecord = await dbAttendance
      .prepare('SELECT status FROM daily_attendance_records WHERE id = ?')
      .bind(seededRecordId)
      .first();
    expect(persistedRecord.status).toBe('LEAVE');

    const persistedCorrection = await dbAttendance
      .prepare('SELECT id, previous_status, new_status FROM attendance_corrections WHERE id = ?')
      .bind(correctionBody.data.id)
      .first();
    expect(persistedCorrection.previous_status).toBe('PRESENT');
    expect(persistedCorrection.new_status).toBe('LEAVE');

    const outboxRow = await dbAttendance
      .prepare(
        `SELECT action, entity_type FROM audit_outbox WHERE entity_id = ? AND action = 'CORRECTION'`
      )
      .bind(correctionBody.data.id)
      .first();
    expect(outboxRow).toEqual({ action: 'CORRECTION', entity_type: 'ATTENDANCE_CORRECTION' });

    // SUPER_ADMIN can list corrections
    const listCorrectionsRes = await listCorrectionsRoute(
      makeRequest(
        `http://localhost:3000/api/v1/attendance/corrections?registerId=${SEED_DAILY_REGISTER}`,
        { token: SUPER_ADMIN_TOKEN }
      )
    );
    expect(listCorrectionsRes.status).toBe(200);
    expect((await listCorrectionsRes.json()).data).toHaveLength(1);
  });

  it('enforces RBAC isolation across unauthenticated, teacher, student, and parent boundaries', async () => {
    // Unauthenticated -> 401
    const unauthRes = await listDailyRegistersRoute(
      makeRequest('http://localhost:3000/api/v1/attendance/daily/registers', { token: null })
    );
    expect(unauthRes.status).toBe(401);

    // Unassigned teacher (Priya -> Class 11) -> 403
    const unassignedClassRes = await createDailyRegisterRoute(
      makeRequest('http://localhost:3000/api/v1/attendance/daily/registers', {
        method: 'POST',
        token: TEACHER_PRIYA_TOKEN,
        body: {
          academicSessionId: SEED_SESSION_2026,
          classId: SEED_CLASS_11,
          attendanceDate: '2026-11-25',
        },
      })
    );
    expect(unassignedClassRes.status).toBe(403);

    // Inactive teacher -> 403 even if assigned
    await dbAcademics
      .prepare(`UPDATE teacher_profiles SET employment_status = 'INACTIVE' WHERE id = ?`)
      .bind('1b000000-0000-4000-8000-000000000002')
      .run();

    const inactiveTeacherRes = await createDailyRegisterRoute(
      makeRequest('http://localhost:3000/api/v1/attendance/daily/registers', {
        method: 'POST',
        token: TEACHER_VIKRAM_TOKEN,
        body: {
          academicSessionId: SEED_SESSION_2026,
          classId: SEED_CLASS_9,
          attendanceDate: '2026-11-25',
        },
      })
    );
    expect(inactiveTeacherRes.status).toBe(403);

    // Restore Vikram to ACTIVE
    await dbAcademics
      .prepare(`UPDATE teacher_profiles SET employment_status = 'ACTIVE' WHERE id = ?`)
      .bind('1b000000-0000-4000-8000-000000000002')
      .run();

    // Student own -> 200, other student -> 403
    const studentOwnRes = await getStudentAttendanceRoute(
      makeRequest(`http://localhost:3000/api/v1/attendance/students/${SEED_STUDENT_AARAV}`, {
        token: STUDENT_TOKEN,
      }),
      { params: Promise.resolve({ studentId: SEED_STUDENT_AARAV }) }
    );
    expect(studentOwnRes.status).toBe(200);

    const studentOtherRes = await getStudentAttendanceRoute(
      makeRequest(`http://localhost:3000/api/v1/attendance/students/${SEED_STUDENT_KABIR}`, {
        token: STUDENT_TOKEN,
      }),
      { params: Promise.resolve({ studentId: SEED_STUDENT_KABIR }) }
    );
    expect(studentOtherRes.status).toBe(403);

    // Parent verified child -> 200, unlinked child -> 403
    const parentLinkedRes = await getStudentAttendanceRoute(
      makeRequest(`http://localhost:3000/api/v1/attendance/students/${SEED_STUDENT_DIYA}`, {
        token: PARENT_TOKEN,
      }),
      { params: Promise.resolve({ studentId: SEED_STUDENT_DIYA }) }
    );
    expect(parentLinkedRes.status).toBe(200);

    const parentUnlinkedRes = await getStudentAttendanceRoute(
      makeRequest(`http://localhost:3000/api/v1/attendance/students/${SEED_STUDENT_KABIR}`, {
        token: PARENT_TOKEN,
      }),
      { params: Promise.resolve({ studentId: SEED_STUDENT_KABIR }) }
    );
    expect(parentUnlinkedRes.status).toBe(403);

    // Student and Parent cannot manage attendance -> 403
    const studentManageRes = await listDailyRegistersRoute(
      makeRequest('http://localhost:3000/api/v1/attendance/daily/registers', {
        token: STUDENT_TOKEN,
      })
    );
    expect(studentManageRes.status).toBe(403);

    const parentManageRes = await createDailyRegisterRoute(
      makeRequest('http://localhost:3000/api/v1/attendance/daily/registers', {
        method: 'POST',
        token: PARENT_TOKEN,
        body: {
          academicSessionId: SEED_SESSION_2026,
          classId: SEED_CLASS_10,
          attendanceDate: '2026-11-26',
        },
      })
    );
    expect(parentManageRes.status).toBe(403);
  });

  it('fails closed (403) when DB_ACADEMICS or DB_STUDENTS is unavailable', async () => {
    const envWithoutAcademics = { ...testEnv };
    delete envWithoutAcademics[D1_BINDINGS.ACADEMICS];
    workerEnvSpy.mockResolvedValueOnce(envWithoutAcademics);

    const noAcademicsRes = await createDailyRegisterRoute(
      makeRequest('http://localhost:3000/api/v1/attendance/daily/registers', {
        method: 'POST',
        token: TEACHER_PRIYA_TOKEN,
        body: {
          academicSessionId: SEED_SESSION_2026,
          classId: SEED_CLASS_10,
          attendanceDate: '2026-11-27',
        },
      })
    );
    expect(noAcademicsRes.status).toBe(403);

    const envWithoutStudents = { ...testEnv };
    delete envWithoutStudents[D1_BINDINGS.STUDENTS];
    workerEnvSpy.mockResolvedValueOnce(envWithoutStudents);

    const noStudentsRes = await getStudentAttendanceRoute(
      makeRequest(`http://localhost:3000/api/v1/attendance/students/${SEED_STUDENT_AARAV}`, {
        token: PARENT_TOKEN,
      }),
      { params: Promise.resolve({ studentId: SEED_STUDENT_AARAV }) }
    );
    expect(noStudentsRes.status).toBe(403);
  });
});
