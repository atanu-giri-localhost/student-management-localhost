import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  GET as listExamMarksRoute,
  POST as createExamMarkRoute,
} from '@/app/api/v1/exam-marks/route';
import {
  GET as getExamMarkRoute,
  PATCH as updateExamMarkRoute,
} from '@/app/api/v1/exam-marks/[id]/route';
import { GET as getExamResultsRoute } from '@/app/api/v1/examinations/[id]/results/route';
import {
  GET as getExaminationRoute,
  PATCH as updateExaminationRoute,
} from '@/app/api/v1/examinations/[id]/route';
import {
  GET as listExamSubjectsRoute,
  POST as createExamSubjectRoute,
} from '@/app/api/v1/examinations/[id]/subjects/route';
import {
  GET as getExamSubjectRoute,
  PATCH as updateExamSubjectRoute,
} from '@/app/api/v1/examinations/[id]/subjects/[subjectEntryId]/route';
import {
  GET as listExaminationsRoute,
  POST as createExaminationRoute,
} from '@/app/api/v1/examinations/route';
import {
  GET as getGradingScaleRoute,
  PATCH as updateGradingScaleRoute,
} from '@/app/api/v1/grading-scales/[id]/route';
import {
  GET as listGradingScalesRoute,
  POST as createGradingScaleRoute,
} from '@/app/api/v1/grading-scales/route';
import {
  GET as listPerformanceRecordsRoute,
  POST as createPerformanceRecordRoute,
} from '@/app/api/v1/performance/records/route';
import { GET as getStudentResultsRoute } from '@/app/api/v1/performance/students/[studentId]/results/route';
import { hashSessionToken } from '@/lib/auth/crypto';
import * as bindings from '@/lib/cloudflare/bindings';
import { D1_BINDINGS } from '@/lib/cloudflare/bindings';
import {
  getClassExamResultsService,
  getStudentExamResultsService,
} from '@/modules/performance/performance.service';
import { createMultiD1Proxy } from '../helpers/multi-d1-proxy';

let ctx;
let testEnv;
let dbIdentity;
let dbAcademics;
let dbPerformance;
let dbAudit;
let workerEnvSpy;

const SUPER_ADMIN_TOKEN = 'b7_superadmin_token_123456';
const ADMIN_TOKEN = 'b7_admin_token_123456';
const TEACHER_PRIYA_TOKEN = 'b7_teacher_priya_token_123456';
const TEACHER_VIKRAM_TOKEN = 'b7_teacher_vikram_token_123456';
const STUDENT_TOKEN = 'b7_student_token_123456';
const PARENT_TOKEN = 'b7_parent_token_123456';

const SEED_SESSION_2026 = '16000000-0000-4000-8000-000000000002';
const SEED_CLASS_10 = '17000000-0000-4000-8000-000000000002';
const SEED_CLASS_11 = '17000000-0000-4000-8000-000000000003';

const SEED_MATH_10 = '18000000-0000-4000-8000-000000000001';
const SEED_SCI_10 = '18000000-0000-4000-8000-000000000002';
const SEED_ENG_10 = '18000000-0000-4000-8000-000000000003';

const SEED_TEACHER_VIKRAM = '1b000000-0000-4000-8000-000000000002';
const SEED_STUDENT_AARAV = '14000000-0000-4000-8000-000000000001';
const SEED_STUDENT_DIYA = '14000000-0000-4000-8000-000000000002';
const SEED_STUDENT_KABIR = '14000000-0000-4000-8000-000000000003';

const SEED_ENROLLMENT_AARAV_10 = '1a000000-0000-4000-8000-000000000002';
const SEED_ENROLLMENT_DIYA_09 = '1a000000-0000-4000-8000-000000000003';
const SEED_ENROLLMENT_KABIR_10 = '1a000000-0000-4000-8000-000000000004';

const SEED_EXAM_1 = '22000000-0000-4000-8000-000000000001';
const SEED_EXAM_SUBJECT_MATH_10 = '23000000-0000-4000-8000-000000000001';

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

describe('Phase B7 Performance Multi-D1 Integration', () => {
  beforeAll(async () => {
    ctx = await createMultiD1Proxy({ applyMigrations: true, applySeeds: true });
    testEnv = {
      ...ctx.env,
      SESSION_SECRET: 'integration_test_session_secret_32chars',
      ENVIRONMENT: 'test',
    };
    dbIdentity = ctx.dbs[D1_BINDINGS.IDENTITY];
    dbAcademics = ctx.dbs[D1_BINDINGS.ACADEMICS];
    dbPerformance = ctx.dbs[D1_BINDINGS.PERFORMANCE];
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

  it('supports examinations CRUD, DB_ACADEMICS session validation, and best-effort DB_AUDIT logging', async () => {
    // Reject nonexistent academic session
    const badSessionRes = await createExaminationRoute(
      makeRequest('http://localhost:3000/api/v1/examinations', {
        method: 'POST',
        token: ADMIN_TOKEN,
        body: {
          academicSessionId: '99999999-0000-4000-8000-000000000001',
          name: 'Orphan Exam',
          examType: 'UNIT_TEST',
          startDate: '2026-09-01',
          endDate: '2026-09-02',
        },
      })
    );
    expect(badSessionRes.status).toBe(400);

    // Create unpublished examination as COACHING_ADMIN
    const createRes = await createExaminationRoute(
      makeRequest('http://localhost:3000/api/v1/examinations', {
        method: 'POST',
        token: ADMIN_TOKEN,
        body: {
          academicSessionId: SEED_SESSION_2026,
          name: 'Half Yearly 2026',
          examType: 'HALF_YEARLY',
          startDate: '2026-10-10',
          endDate: '2026-10-15',
          isPublished: false,
        },
      })
    );
    expect(createRes.status).toBe(201);
    const createdBody = await createRes.json();
    const examId = createdBody.data.id;
    expect(createdBody.data.isPublished).toBe(false);

    // Verify DB_AUDIT.audit_logs best-effort record
    const auditRow = await dbAudit
      .prepare(
        `SELECT action, entity_type, entity_id FROM audit_logs WHERE entity_type = 'examinations' AND entity_id = ?`
      )
      .bind(examId)
      .first();
    expect(auditRow).toBeTruthy();
    expect(auditRow.action).toBe('CREATE');

    // Retrieve examination
    const getRes = await getExaminationRoute(
      makeRequest(`http://localhost:3000/api/v1/examinations/${examId}`, {
        token: TEACHER_PRIYA_TOKEN,
      }),
      { params: Promise.resolve({ id: examId }) }
    );
    expect(getRes.status).toBe(200);
    expect((await getRes.json()).data.name).toBe('Half Yearly 2026');

    // Update isPublished = true as SUPER_ADMIN
    const patchRes = await updateExaminationRoute(
      makeRequest(`http://localhost:3000/api/v1/examinations/${examId}`, {
        method: 'PATCH',
        token: SUPER_ADMIN_TOKEN,
        body: { isPublished: true },
      }),
      { params: Promise.resolve({ id: examId }) }
    );
    expect(patchRes.status).toBe(200);
    expect((await patchRes.json()).data.isPublished).toBe(true);

    // List examinations filtered by examType
    const listRes = await listExaminationsRoute(
      makeRequest(
        `http://localhost:3000/api/v1/examinations?academicSessionId=${SEED_SESSION_2026}&examType=HALF_YEARLY`,
        { token: ADMIN_TOKEN }
      )
    );
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.data.some((e) => e.id === examId)).toBe(true);
  });

  it('supports exam subjects creation, duplicate 409, and DB_ACADEMICS.class_subjects validation', async () => {
    // Reject unmapped class/subject (Class 11 has no class_subjects in seed)
    const unmappedRes = await createExamSubjectRoute(
      makeRequest(`http://localhost:3000/api/v1/examinations/${SEED_EXAM_1}/subjects`, {
        method: 'POST',
        token: ADMIN_TOKEN,
        body: {
          classId: SEED_CLASS_11,
          subjectId: SEED_MATH_10,
          examDate: '2026-08-12',
          maxMarks: 100,
          passingMarks: 35,
        },
      }),
      { params: Promise.resolve({ id: SEED_EXAM_1 }) }
    );
    expect(unmappedRes.status).toBe(400);

    // Create valid exam subject (Class 10 Science in Unit Test 1)
    const createRes = await createExamSubjectRoute(
      makeRequest(`http://localhost:3000/api/v1/examinations/${SEED_EXAM_1}/subjects`, {
        method: 'POST',
        token: ADMIN_TOKEN,
        body: {
          classId: SEED_CLASS_10,
          subjectId: SEED_SCI_10,
          examDate: '2026-08-11',
          maxMarks: 100,
          passingMarks: 35,
        },
      }),
      { params: Promise.resolve({ id: SEED_EXAM_1 }) }
    );
    expect(createRes.status).toBe(201);
    const subjectEntryId = (await createRes.json()).data.id;

    // Duplicate (examinationId, classId, subjectId) returns 409
    const dupRes = await createExamSubjectRoute(
      makeRequest(`http://localhost:3000/api/v1/examinations/${SEED_EXAM_1}/subjects`, {
        method: 'POST',
        token: ADMIN_TOKEN,
        body: {
          classId: SEED_CLASS_10,
          subjectId: SEED_SCI_10,
          examDate: '2026-08-11',
          maxMarks: 100,
          passingMarks: 35,
        },
      }),
      { params: Promise.resolve({ id: SEED_EXAM_1 }) }
    );
    expect(dupRes.status).toBe(409);

    // Get and update exam subject
    const getRes = await getExamSubjectRoute(
      makeRequest(
        `http://localhost:3000/api/v1/examinations/${SEED_EXAM_1}/subjects/${subjectEntryId}`,
        { token: TEACHER_PRIYA_TOKEN }
      ),
      { params: Promise.resolve({ id: SEED_EXAM_1, subjectEntryId }) }
    );
    expect(getRes.status).toBe(200);

    const patchRes = await updateExamSubjectRoute(
      makeRequest(
        `http://localhost:3000/api/v1/examinations/${SEED_EXAM_1}/subjects/${subjectEntryId}`,
        {
          method: 'PATCH',
          token: ADMIN_TOKEN,
          body: { passingMarks: 40 },
        }
      ),
      { params: Promise.resolve({ id: SEED_EXAM_1, subjectEntryId }) }
    );
    expect(patchRes.status).toBe(200);
    expect((await patchRes.json()).data.passingMarks).toBe(40);

    // List exam subjects
    const listRes = await listExamSubjectsRoute(
      makeRequest(
        `http://localhost:3000/api/v1/examinations/${SEED_EXAM_1}/subjects?classId=${SEED_CLASS_10}`,
        { token: ADMIN_TOKEN }
      ),
      { params: Promise.resolve({ id: SEED_EXAM_1 }) }
    );
    expect(listRes.status).toBe(200);
    expect((await listRes.json()).data.length).toBeGreaterThanOrEqual(2);
  });

  it('supports exam marks validation, duplicate 409, enrollment validation, and update', async () => {
    // Reject marksObtained > maxMarks (maxMarks = 50 for SEED_EXAM_SUBJECT_MATH_10)
    const overMaxRes = await createExamMarkRoute(
      makeRequest('http://localhost:3000/api/v1/exam-marks', {
        method: 'POST',
        token: TEACHER_VIKRAM_TOKEN,
        body: {
          examSubjectId: SEED_EXAM_SUBJECT_MATH_10,
          enrollmentId: SEED_ENROLLMENT_KABIR_10,
          isAbsent: false,
          marksObtained: 55,
        },
      })
    );
    expect(overMaxRes.status).toBe(400);

    // Reject isAbsent = true with marksObtained != null
    const absentWithMarksRes = await createExamMarkRoute(
      makeRequest('http://localhost:3000/api/v1/exam-marks', {
        method: 'POST',
        token: TEACHER_VIKRAM_TOKEN,
        body: {
          examSubjectId: SEED_EXAM_SUBJECT_MATH_10,
          enrollmentId: SEED_ENROLLMENT_KABIR_10,
          isAbsent: true,
          marksObtained: 10,
        },
      })
    );
    expect(absentWithMarksRes.status).toBe(400);

    // Reject enrollment from wrong class (Diya is Class 9, exam subject is Class 10)
    const wrongClassRes = await createExamMarkRoute(
      makeRequest('http://localhost:3000/api/v1/exam-marks', {
        method: 'POST',
        token: ADMIN_TOKEN,
        body: {
          examSubjectId: SEED_EXAM_SUBJECT_MATH_10,
          enrollmentId: SEED_ENROLLMENT_DIYA_09,
          isAbsent: false,
          marksObtained: 30,
        },
      })
    );
    expect(wrongClassRes.status).toBe(400);

    // Assigned teacher Vikram records Kabir's Math 10 mark
    const createRes = await createExamMarkRoute(
      makeRequest('http://localhost:3000/api/v1/exam-marks', {
        method: 'POST',
        token: TEACHER_VIKRAM_TOKEN,
        body: {
          examSubjectId: SEED_EXAM_SUBJECT_MATH_10,
          enrollmentId: SEED_ENROLLMENT_KABIR_10,
          isAbsent: false,
          marksObtained: 41.5,
          remarks: 'Good improvement',
        },
      })
    );
    expect(createRes.status).toBe(201);
    const markId = (await createRes.json()).data.id;

    // Duplicate (examSubjectId, enrollmentId) returns 409
    const dupRes = await createExamMarkRoute(
      makeRequest('http://localhost:3000/api/v1/exam-marks', {
        method: 'POST',
        token: TEACHER_VIKRAM_TOKEN,
        body: {
          examSubjectId: SEED_EXAM_SUBJECT_MATH_10,
          enrollmentId: SEED_ENROLLMENT_KABIR_10,
          isAbsent: false,
          marksObtained: 42,
        },
      })
    );
    expect(dupRes.status).toBe(409);

    // Retrieve & update mark
    const getRes = await getExamMarkRoute(
      makeRequest(`http://localhost:3000/api/v1/exam-marks/${markId}`, {
        token: TEACHER_VIKRAM_TOKEN,
      }),
      { params: Promise.resolve({ id: markId }) }
    );
    expect(getRes.status).toBe(200);

    const patchRes = await updateExamMarkRoute(
      makeRequest(`http://localhost:3000/api/v1/exam-marks/${markId}`, {
        method: 'PATCH',
        token: TEACHER_VIKRAM_TOKEN,
        body: { marksObtained: 45, remarks: 'Rechecked' },
      }),
      { params: Promise.resolve({ id: markId }) }
    );
    expect(patchRes.status).toBe(200);
    expect((await patchRes.json()).data.marksObtained).toBe(45);

    // List exam marks
    const listRes = await listExamMarksRoute(
      makeRequest(
        `http://localhost:3000/api/v1/exam-marks?examSubjectId=${SEED_EXAM_SUBJECT_MATH_10}`,
        { token: ADMIN_TOKEN }
      )
    );
    expect(listRes.status).toBe(200);
    expect((await listRes.json()).data.length).toBeGreaterThanOrEqual(2);
  });

  it('supports grading scales CRUD, overlap rejection (409), and duplicate key (409)', async () => {
    // Overlapping range with seeded 'Draft Standard Scale 2026' (A+: 90-100)
    const overlapRes = await createGradingScaleRoute(
      makeRequest('http://localhost:3000/api/v1/grading-scales', {
        method: 'POST',
        token: ADMIN_TOKEN,
        body: {
          academicSessionId: SEED_SESSION_2026,
          name: 'Draft Standard Scale 2026',
          gradeLabel: 'S',
          minPercentage: 95,
          maxPercentage: 100,
          gradePoint: 10,
          effectiveFrom: '2026-04-01',
        },
      })
    );
    expect(overlapRes.status).toBe(409);

    // Create a distinct non-overlapping scale
    const createRes = await createGradingScaleRoute(
      makeRequest('http://localhost:3000/api/v1/grading-scales', {
        method: 'POST',
        token: ADMIN_TOKEN,
        body: {
          academicSessionId: SEED_SESSION_2026,
          name: 'Custom Merit Scale 2026',
          gradeLabel: 'DISTINCTION',
          minPercentage: 75,
          maxPercentage: 100,
          gradePoint: 10,
          isPassing: true,
          effectiveFrom: '2026-04-01',
        },
      })
    );
    expect(createRes.status).toBe(201);
    const scaleId = (await createRes.json()).data.id;

    // Duplicate (name, gradeLabel, effectiveFrom) -> 409
    const dupRes = await createGradingScaleRoute(
      makeRequest('http://localhost:3000/api/v1/grading-scales', {
        method: 'POST',
        token: ADMIN_TOKEN,
        body: {
          academicSessionId: SEED_SESSION_2026,
          name: 'Custom Merit Scale 2026',
          gradeLabel: 'DISTINCTION',
          minPercentage: 0,
          maxPercentage: 74.99,
          effectiveFrom: '2026-04-01',
          isActive: false,
        },
      })
    );
    expect(dupRes.status).toBe(409);

    // Retrieve, update, list
    const getRes = await getGradingScaleRoute(
      makeRequest(`http://localhost:3000/api/v1/grading-scales/${scaleId}`, {
        token: ADMIN_TOKEN,
      }),
      { params: Promise.resolve({ id: scaleId }) }
    );
    expect(getRes.status).toBe(200);

    const patchRes = await updateGradingScaleRoute(
      makeRequest(`http://localhost:3000/api/v1/grading-scales/${scaleId}`, {
        method: 'PATCH',
        token: SUPER_ADMIN_TOKEN,
        body: { minPercentage: 80 },
      }),
      { params: Promise.resolve({ id: scaleId }) }
    );
    expect(patchRes.status).toBe(200);
    expect((await patchRes.json()).data.minPercentage).toBe(80);

    const listRes = await listGradingScalesRoute(
      makeRequest('http://localhost:3000/api/v1/grading-scales?name=Custom%20Merit%20Scale%202026', {
        token: ADMIN_TOKEN,
      })
    );
    expect(listRes.status).toBe(200);
    expect((await listRes.json()).data).toHaveLength(1);
  });

  it('computes getStudentExamResultsService and getClassExamResultsService accurately (published guard, incomplete, absent=0 fail, 2-decimal percentage)', async () => {
    // Create an unpublished exam and a published exam with 2 subjects to test all edge cases
    const unpubExamRes = await createExaminationRoute(
      makeRequest('http://localhost:3000/api/v1/examinations', {
        method: 'POST',
        token: ADMIN_TOKEN,
        body: {
          academicSessionId: SEED_SESSION_2026,
          name: 'Unpublished Quiz',
          examType: 'MONTHLY_TEST',
          startDate: '2026-11-01',
          endDate: '2026-11-02',
          isPublished: false,
        },
      })
    );
    const unpubExamId = (await unpubExamRes.json()).data.id;

    // Student cannot see unpublished exam; Admin can
    const studentVisible = await getStudentExamResultsService(
      dbPerformance,
      testEnv,
      { roles: ['STUDENT'] },
      { studentId: SEED_STUDENT_AARAV }
    );
    expect(studentVisible.results.some((r) => r.examination.id === unpubExamId)).toBe(false);

    const adminVisible = await getStudentExamResultsService(
      dbPerformance,
      testEnv,
      { roles: ['COACHING_ADMIN'] },
      { studentId: SEED_STUDENT_AARAV }
    );
    expect(adminVisible.results.some((r) => r.examination.id === unpubExamId)).toBe(true);

    // Create a published exam for Class 10 with Math (max 30, pass 12) & English (max 40, pass 15)
    const pubExamRes = await createExaminationRoute(
      makeRequest('http://localhost:3000/api/v1/examinations', {
        method: 'POST',
        token: ADMIN_TOKEN,
        body: {
          academicSessionId: SEED_SESSION_2026,
          name: 'Monthly Test Nov 2026',
          examType: 'MONTHLY_TEST',
          startDate: '2026-11-10',
          endDate: '2026-11-12',
          isPublished: true,
        },
      })
    );
    const pubExamId = (await pubExamRes.json()).data.id;

    const mathSubRes = await createExamSubjectRoute(
      makeRequest(`http://localhost:3000/api/v1/examinations/${pubExamId}/subjects`, {
        method: 'POST',
        token: ADMIN_TOKEN,
        body: {
          classId: SEED_CLASS_10,
          subjectId: SEED_MATH_10,
          examDate: '2026-11-10',
          maxMarks: 30,
          passingMarks: 12,
        },
      }),
      { params: Promise.resolve({ id: pubExamId }) }
    );
    const mathSubId = (await mathSubRes.json()).data.id;

    const engSubRes = await createExamSubjectRoute(
      makeRequest(`http://localhost:3000/api/v1/examinations/${pubExamId}/subjects`, {
        method: 'POST',
        token: ADMIN_TOKEN,
        body: {
          classId: SEED_CLASS_10,
          subjectId: SEED_ENG_10,
          examDate: '2026-11-12',
          maxMarks: 40,
          passingMarks: 15,
        },
      }),
      { params: Promise.resolve({ id: pubExamId }) }
    );
    const engSubId = (await engSubRes.json()).data.id;

    // Aarav: Math = 25/30, English = MISSING -> incomplete: true, percentage = 25/30 = 83.33%
    await createExamMarkRoute(
      makeRequest('http://localhost:3000/api/v1/exam-marks', {
        method: 'POST',
        token: ADMIN_TOKEN,
        body: {
          examSubjectId: mathSubId,
          enrollmentId: SEED_ENROLLMENT_AARAV_10,
          isAbsent: false,
          marksObtained: 25,
        },
      })
    );

    const aaravRes = await getStudentExamResultsService(
      dbPerformance,
      testEnv,
      { roles: ['STUDENT'] },
      { studentId: SEED_STUDENT_AARAV, examinationId: pubExamId }
    );
    expect(aaravRes.results).toHaveLength(1);
    const aaravSummary = aaravRes.results[0];
    expect(aaravSummary.incomplete).toBe(true);
    expect(aaravSummary.gradedMaxMarks).toBe(30);
    expect(aaravSummary.totalScheduledMaxMarks).toBe(70);
    expect(aaravSummary.percentage).toBe(83.33);
    expect(aaravSummary.overallPassed).toBe(false);

    // Kabir: Math = 28/30, English = ABSENT -> absent counts as 0 in denominator (28/70 = 40.00%), fail
    await createExamMarkRoute(
      makeRequest('http://localhost:3000/api/v1/exam-marks', {
        method: 'POST',
        token: ADMIN_TOKEN,
        body: {
          examSubjectId: mathSubId,
          enrollmentId: SEED_ENROLLMENT_KABIR_10,
          isAbsent: false,
          marksObtained: 28,
        },
      })
    );
    await createExamMarkRoute(
      makeRequest('http://localhost:3000/api/v1/exam-marks', {
        method: 'POST',
        token: ADMIN_TOKEN,
        body: {
          examSubjectId: engSubId,
          enrollmentId: SEED_ENROLLMENT_KABIR_10,
          isAbsent: true,
          marksObtained: null,
        },
      })
    );

    const kabirRes = await getStudentExamResultsService(
      dbPerformance,
      testEnv,
      { roles: ['COACHING_ADMIN'] },
      { studentId: SEED_STUDENT_KABIR, examinationId: pubExamId }
    );
    const kabirSummary = kabirRes.results[0];
    expect(kabirSummary.incomplete).toBe(false);
    expect(kabirSummary.absentCount).toBe(1);
    expect(kabirSummary.totalMarksObtained).toBe(28);
    expect(kabirSummary.gradedMaxMarks).toBe(70);
    expect(kabirSummary.percentage).toBe(40);
    expect(kabirSummary.overallPassed).toBe(false);
    expect(kabirSummary.grade?.gradeLabel).toBe('D');

    // Class exam results service
    const classResults = await getClassExamResultsService(dbPerformance, testEnv, {
      examinationId: pubExamId,
      classId: SEED_CLASS_10,
      page: 1,
      pageSize: 20,
    });
    expect(classResults.pagination.total).toBe(2);
    expect(classResults.results).toHaveLength(2);
  });

  it('enforces RBAC and isolation across all performance HTTP routes plus fail-closed DB checks', async () => {
    // 1. Unauthenticated -> 401
    expect(
      (await listExaminationsRoute(makeRequest('http://localhost:3000/api/v1/examinations', { token: null })))
        .status
    ).toBe(401);

    // 2. STUDENT / PARENT management -> 403
    expect(
      (
        await createExaminationRoute(
          makeRequest('http://localhost:3000/api/v1/examinations', {
            method: 'POST',
            token: STUDENT_TOKEN,
            body: {
              academicSessionId: SEED_SESSION_2026,
              name: 'Student Exam',
              examType: 'UNIT_TEST',
              startDate: '2026-11-01',
              endDate: '2026-11-02',
            },
          })
        )
      ).status
    ).toBe(403);
    expect(
      (
        await createGradingScaleRoute(
          makeRequest('http://localhost:3000/api/v1/grading-scales', {
            method: 'POST',
            token: PARENT_TOKEN,
            body: {
              name: 'Parent Scale',
              gradeLabel: 'A',
              minPercentage: 80,
              maxPercentage: 100,
              effectiveFrom: '2026-04-01',
            },
          })
        )
      ).status
    ).toBe(403);

    // 3. Assigned TEACHER (Vikram -> Math 10) allowed vs unassigned TEACHER (Priya -> Math 10) -> 403
    const unassignedMarkRes = await createExamMarkRoute(
      makeRequest('http://localhost:3000/api/v1/exam-marks', {
        method: 'POST',
        token: TEACHER_PRIYA_TOKEN,
        body: {
          examSubjectId: SEED_EXAM_SUBJECT_MATH_10,
          enrollmentId: SEED_ENROLLMENT_AARAV_10,
          isAbsent: false,
          marksObtained: 40,
        },
      })
    );
    expect(unassignedMarkRes.status).toBe(403);

    // Assigned teacher Vikram creates daily performance record for Class 10 Math
    const perfRecordRes = await createPerformanceRecordRoute(
      makeRequest('http://localhost:3000/api/v1/performance/records', {
        method: 'POST',
        token: TEACHER_VIKRAM_TOKEN,
        body: {
          enrollmentId: SEED_ENROLLMENT_AARAV_10,
          subjectId: SEED_MATH_10,
          evaluationDate: '2026-11-25',
          category: 'CLASS_TEST',
          marksObtained: 19,
          maxMarks: 20,
          remarks: 'Excellent analytical speed',
        },
      })
    );
    expect(perfRecordRes.status).toBe(201);

    // Inactive teacher -> 403
    await dbAcademics
      .prepare(`UPDATE teacher_profiles SET employment_status = 'INACTIVE' WHERE id = ?`)
      .bind(SEED_TEACHER_VIKRAM)
      .run();
    try {
      const inactiveTeacherRes = await createPerformanceRecordRoute(
        makeRequest('http://localhost:3000/api/v1/performance/records', {
          method: 'POST',
          token: TEACHER_VIKRAM_TOKEN,
          body: {
            enrollmentId: SEED_ENROLLMENT_AARAV_10,
            subjectId: SEED_MATH_10,
            evaluationDate: '2026-11-26',
            category: 'HOMEWORK',
            remarks: 'Should be blocked',
          },
        })
      );
      expect(inactiveTeacherRes.status).toBe(403);
    } finally {
      await dbAcademics
        .prepare(`UPDATE teacher_profiles SET employment_status = 'ACTIVE' WHERE id = ?`)
        .bind(SEED_TEACHER_VIKRAM)
        .run();
    }

    // 4. STUDENT own results (200) vs other student (403)
    const ownResultsRes = await getStudentResultsRoute(
      makeRequest(`http://localhost:3000/api/v1/performance/students/${SEED_STUDENT_AARAV}/results`, {
        token: STUDENT_TOKEN,
      }),
      { params: Promise.resolve({ studentId: SEED_STUDENT_AARAV }) }
    );
    expect(ownResultsRes.status).toBe(200);

    const otherResultsRes = await getStudentResultsRoute(
      makeRequest(`http://localhost:3000/api/v1/performance/students/${SEED_STUDENT_KABIR}/results`, {
        token: STUDENT_TOKEN,
      }),
      { params: Promise.resolve({ studentId: SEED_STUDENT_KABIR }) }
    );
    expect(otherResultsRes.status).toBe(403);

    // 5. PARENT verified child (200) vs unlinked child (403)
    const verifiedChildRes = await getStudentResultsRoute(
      makeRequest(`http://localhost:3000/api/v1/performance/students/${SEED_STUDENT_DIYA}/results`, {
        token: PARENT_TOKEN,
      }),
      { params: Promise.resolve({ studentId: SEED_STUDENT_DIYA }) }
    );
    expect(verifiedChildRes.status).toBe(200);

    const unlinkedChildRes = await getStudentResultsRoute(
      makeRequest(`http://localhost:3000/api/v1/performance/students/${SEED_STUDENT_KABIR}/results`, {
        token: PARENT_TOKEN,
      }),
      { params: Promise.resolve({ studentId: SEED_STUDENT_KABIR }) }
    );
    expect(unlinkedChildRes.status).toBe(403);

    // 6. Class results route allowed for assigned teacher, denied for unassigned class
    const classResAllowed = await getExamResultsRoute(
      makeRequest(
        `http://localhost:3000/api/v1/examinations/${SEED_EXAM_1}/results?classId=${SEED_CLASS_10}`,
        { token: TEACHER_PRIYA_TOKEN }
      ),
      { params: Promise.resolve({ id: SEED_EXAM_1 }) }
    );
    expect(classResAllowed.status).toBe(200);

    const classResDenied = await getExamResultsRoute(
      makeRequest(
        `http://localhost:3000/api/v1/examinations/${SEED_EXAM_1}/results?classId=${SEED_CLASS_11}`,
        { token: TEACHER_PRIYA_TOKEN }
      ),
      { params: Promise.resolve({ id: SEED_EXAM_1 }) }
    );
    expect(classResDenied.status).toBe(403);

    // List performance records as student (own)
    const studentPerfListRes = await listPerformanceRecordsRoute(
      makeRequest(
        `http://localhost:3000/api/v1/performance/records?studentId=${SEED_STUDENT_AARAV}`,
        { token: STUDENT_TOKEN }
      )
    );
    expect(studentPerfListRes.status).toBe(200);

    // 7. Fail-closed when DB_ACADEMICS / DB_STUDENTS is unavailable
    const envWithoutAcademics = { ...testEnv };
    delete envWithoutAcademics[D1_BINDINGS.ACADEMICS];
    workerEnvSpy.mockResolvedValueOnce(envWithoutAcademics);
    const failClosedAcademicsRes = await getExamResultsRoute(
      makeRequest(
        `http://localhost:3000/api/v1/examinations/${SEED_EXAM_1}/results?classId=${SEED_CLASS_10}`,
        { token: TEACHER_PRIYA_TOKEN }
      ),
      { params: Promise.resolve({ id: SEED_EXAM_1 }) }
    );
    expect(failClosedAcademicsRes.status).toBe(403);

    const envWithoutStudents = { ...testEnv };
    delete envWithoutStudents[D1_BINDINGS.STUDENTS];
    workerEnvSpy.mockResolvedValueOnce(envWithoutStudents);
    const failClosedStudentsRes = await getStudentResultsRoute(
      makeRequest(`http://localhost:3000/api/v1/performance/students/${SEED_STUDENT_AARAV}/results`, {
        token: PARENT_TOKEN,
      }),
      { params: Promise.resolve({ studentId: SEED_STUDENT_AARAV }) }
    );
    expect(failClosedStudentsRes.status).toBe(403);
  });
});
