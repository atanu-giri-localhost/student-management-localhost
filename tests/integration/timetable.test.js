import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  DELETE as deleteCalendarRoute,
  GET as getCalendarRoute,
  PATCH as updateCalendarRoute,
} from '@/app/api/v1/timetable/calendar/[id]/route';
import {
  GET as listCalendarRoute,
  POST as createCalendarRoute,
} from '@/app/api/v1/timetable/calendar/route';
import { GET as getClassTimetableRoute } from '@/app/api/v1/timetable/class/[classId]/route';
import { GET as getDailyTimetableRoute } from '@/app/api/v1/timetable/daily/route';
import {
  DELETE as deleteRoomRoute,
  GET as getRoomRoute,
  PATCH as updateRoomRoute,
} from '@/app/api/v1/timetable/rooms/[id]/route';
import {
  GET as listRoomsRoute,
  POST as createRoomRoute,
} from '@/app/api/v1/timetable/rooms/route';
import {
  DELETE as deleteSlotRoute,
  GET as getSlotRoute,
  PATCH as updateSlotRoute,
} from '@/app/api/v1/timetable/slots/[id]/route';
import {
  GET as listSlotsRoute,
  POST as createSlotRoute,
} from '@/app/api/v1/timetable/slots/route';
import { GET as getStudentTimetableRoute } from '@/app/api/v1/timetable/student/[studentId]/route';
import { GET as getTeacherTimetableRoute } from '@/app/api/v1/timetable/teacher/[teacherId]/route';
import { hashSessionToken } from '@/lib/auth/crypto';
import * as bindings from '@/lib/cloudflare/bindings';
import { D1_BINDINGS } from '@/lib/cloudflare/bindings';
import { createMultiD1Proxy } from '../helpers/multi-d1-proxy';

let ctx;
let testEnv;
let dbIdentity;
let dbStudents;
let dbAudit;
let workerEnvSpy;

const SUPER_ADMIN_TOKEN = 'tt_superadmin_token_123456';
const ADMIN_TOKEN = 'tt_admin_token_123456';
const TEACHER_PRIYA_TOKEN = 'tt_teacher_priya_token_123456';
const STUDENT_AARAV_TOKEN = 'tt_student_aarav_token_123456';
const PARENT_SUNITA_TOKEN = 'tt_parent_sunita_token_123456';

const SEED_SESSION_2026 = '16000000-0000-4000-8000-000000000002';
const SEED_CLASS_09 = '17000000-0000-4000-8000-000000000001';
const SEED_CLASS_10 = '17000000-0000-4000-8000-000000000002';
const SEED_CLASS_11 = '17000000-0000-4000-8000-000000000003';

const SEED_SUBJECT_SCI_10 = '18000000-0000-4000-8000-000000000002';
const SEED_SUBJECT_MATH_09 = '18000000-0000-4000-8000-000000000004';
const SEED_SUBJECT_SCI_09 = '18000000-0000-4000-8000-000000000005';

const SEED_TEACHER_PRIYA = '1b000000-0000-4000-8000-000000000001';
const SEED_TEACHER_VIKRAM = '1b000000-0000-4000-8000-000000000002';

const SEED_STUDENT_AARAV = '14000000-0000-4000-8000-000000000001';
const SEED_STUDENT_KABIR = '14000000-0000-4000-8000-000000000003';

const SEED_ROOM_101 = '26000000-0000-4000-8000-000000000001';
const SEED_ROOM_LAB = '26000000-0000-4000-8000-000000000002';
const SEED_SLOT_1 = '27000000-0000-4000-8000-000000000001';
const SEED_CALENDAR_HOLIDAY = '31000000-0000-4000-8000-000000000001';

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

describe('Phase 9 Timetable & Academic Calendar Multi-D1 Integration', () => {
  beforeAll(async () => {
    ctx = await createMultiD1Proxy({ applyMigrations: true, applySeeds: true });
    testEnv = {
      ...ctx.env,
      SESSION_SECRET: 'integration_test_session_secret_32chars',
      ENVIRONMENT: 'test',
    };
    dbIdentity = ctx.dbs[D1_BINDINGS.IDENTITY];
    dbStudents = ctx.dbs[D1_BINDINGS.STUDENTS];
    dbAudit = ctx.dbs[D1_BINDINGS.AUDIT];

    workerEnvSpy = vi.spyOn(bindings, 'resolveWorkerEnv').mockResolvedValue(testEnv);

    const futureExpiry = new Date(Date.now() + 86_400_000).toISOString();
    const now = new Date().toISOString();
    const sessionSpecs = [
      { userId: '11000000-0000-4000-8000-000000000001', token: SUPER_ADMIN_TOKEN },
      { userId: '11000000-0000-4000-8000-000000000002', token: ADMIN_TOKEN },
      { userId: '11000000-0000-4000-8000-000000000003', token: TEACHER_PRIYA_TOKEN },
      { userId: '11000000-0000-4000-8000-000000000005', token: STUDENT_AARAV_TOKEN },
      { userId: '11000000-0000-4000-8000-000000000006', token: PARENT_SUNITA_TOKEN },
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

  it('supports room CRUD, referenced delete rejection (409), deactivation, unreferenced delete, and bounded pagination', async () => {
    // List seeded rooms with bounded pagination
    const listRes = await listRoomsRoute(
      makeRequest('http://localhost:3000/api/v1/timetable/rooms?page=1&pageSize=1')
    );
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.data).toHaveLength(1);
    expect(listBody.pagination.total).toBeGreaterThanOrEqual(2);
    expect(listBody.pagination.pageSize).toBe(1);

    // Create a new room
    const createRes = await createRoomRoute(
      makeRequest('http://localhost:3000/api/v1/timetable/rooms', {
        method: 'POST',
        body: {
          name: 'Room 204',
          code: 'R-204',
          capacity: 45,
          floorOrBuilding: 'Second Floor',
        },
      })
    );
    expect(createRes.status).toBe(201);
    const createdRoom = (await createRes.json()).data;
    expect(createdRoom.code).toBe('R-204');
    expect(createdRoom.isActive).toBe(true);

    // Duplicate room code returns 409
    const dupRes = await createRoomRoute(
      makeRequest('http://localhost:3000/api/v1/timetable/rooms', {
        method: 'POST',
        body: {
          name: 'Another Room',
          code: 'R-204',
        },
      })
    );
    expect(dupRes.status).toBe(409);

    // Get room by ID
    const getRes = await getRoomRoute(
      makeRequest(`http://localhost:3000/api/v1/timetable/rooms/${createdRoom.id}`),
      { params: Promise.resolve({ id: createdRoom.id }) }
    );
    expect(getRes.status).toBe(200);

    // Update / soft-deactivate room
    const patchRes = await updateRoomRoute(
      makeRequest(`http://localhost:3000/api/v1/timetable/rooms/${createdRoom.id}`, {
        method: 'PATCH',
        body: { capacity: 50, isActive: false },
      }),
      { params: Promise.resolve({ id: createdRoom.id }) }
    );
    expect(patchRes.status).toBe(200);
    const updatedRoom = (await patchRes.json()).data;
    expect(updatedRoom.capacity).toBe(50);
    expect(updatedRoom.isActive).toBe(false);

    // Referenced room delete rejected with 409
    const refDeleteRes = await deleteRoomRoute(
      makeRequest(`http://localhost:3000/api/v1/timetable/rooms/${SEED_ROOM_101}`, {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: SEED_ROOM_101 }) }
    );
    expect(refDeleteRes.status).toBe(409);

    // Unreferenced room delete succeeds
    const delRes = await deleteRoomRoute(
      makeRequest(`http://localhost:3000/api/v1/timetable/rooms/${createdRoom.id}`, {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: createdRoom.id }) }
    );
    expect(delRes.status).toBe(200);
    expect((await delRes.json()).data.deleted).toBe(true);
  });

  it('supports timetable slot CRUD, soft-reference validation, and class/teacher/room conflict rejection (409)', async () => {
    // Invalid soft-reference: nonexistent session
    const badSessionRes = await createSlotRoute(
      makeRequest('http://localhost:3000/api/v1/timetable/slots', {
        method: 'POST',
        body: {
          academicSessionId: '99999999-0000-4000-8000-000000000099',
          classId: SEED_CLASS_09,
          subjectId: SEED_SUBJECT_MATH_09,
          teacherProfileId: SEED_TEACHER_VIKRAM,
          dayOfWeek: 2,
          periodNumber: 1,
          startTime: '09:00',
          endTime: '09:50',
        },
      })
    );
    expect(badSessionRes.status).toBe(400);

    // Invalid soft-reference: teacher not assigned to subject/class (Priya does not teach MATH-09)
    const unassignedTeacherRes = await createSlotRoute(
      makeRequest('http://localhost:3000/api/v1/timetable/slots', {
        method: 'POST',
        body: {
          academicSessionId: SEED_SESSION_2026,
          classId: SEED_CLASS_09,
          subjectId: SEED_SUBJECT_MATH_09,
          teacherProfileId: SEED_TEACHER_PRIYA,
          dayOfWeek: 2,
          periodNumber: 1,
          startTime: '09:00',
          endTime: '09:50',
        },
      })
    );
    expect(unassignedTeacherRes.status).toBe(400);

    // Class conflict with seeded slot 1 (Class 10, day 1, period 1, 09:00-09:50)
    const classConflictRes = await createSlotRoute(
      makeRequest('http://localhost:3000/api/v1/timetable/slots', {
        method: 'POST',
        body: {
          academicSessionId: SEED_SESSION_2026,
          classId: SEED_CLASS_10,
          subjectId: SEED_SUBJECT_SCI_10,
          teacherProfileId: SEED_TEACHER_PRIYA,
          roomId: SEED_ROOM_LAB,
          dayOfWeek: 1,
          periodNumber: 1,
          startTime: '09:10',
          endTime: '09:40',
        },
      })
    );
    expect(classConflictRes.status).toBe(409);

    // Teacher conflict with seeded slot 1 (Vikram teaching Class 10 on day 1 09:00-09:50)
    const teacherConflictRes = await createSlotRoute(
      makeRequest('http://localhost:3000/api/v1/timetable/slots', {
        method: 'POST',
        body: {
          academicSessionId: SEED_SESSION_2026,
          classId: SEED_CLASS_09,
          subjectId: SEED_SUBJECT_MATH_09,
          teacherProfileId: SEED_TEACHER_VIKRAM,
          roomId: SEED_ROOM_LAB,
          dayOfWeek: 1,
          periodNumber: 1,
          startTime: '09:00',
          endTime: '09:50',
        },
      })
    );
    expect(teacherConflictRes.status).toBe(409);

    // Room conflict with seeded slot 2 (Science Lab booked on day 1 10:00-10:50)
    const roomConflictRes = await createSlotRoute(
      makeRequest('http://localhost:3000/api/v1/timetable/slots', {
        method: 'POST',
        body: {
          academicSessionId: SEED_SESSION_2026,
          classId: SEED_CLASS_09,
          subjectId: SEED_SUBJECT_MATH_09,
          teacherProfileId: SEED_TEACHER_VIKRAM,
          roomId: SEED_ROOM_LAB,
          dayOfWeek: 1,
          periodNumber: 2,
          startTime: '10:00',
          endTime: '10:50',
        },
      })
    );
    expect(roomConflictRes.status).toBe(409);

    // Valid slot creation on day 2
    const createRes = await createSlotRoute(
      makeRequest('http://localhost:3000/api/v1/timetable/slots', {
        method: 'POST',
        body: {
          academicSessionId: SEED_SESSION_2026,
          classId: SEED_CLASS_09,
          subjectId: SEED_SUBJECT_SCI_09,
          teacherProfileId: SEED_TEACHER_PRIYA,
          roomId: SEED_ROOM_LAB,
          dayOfWeek: 2,
          periodNumber: 1,
          startTime: '09:00',
          endTime: '09:50',
        },
      })
    );
    expect(createRes.status).toBe(201);
    const createdSlot = (await createRes.json()).data;
    expect(createdSlot.roomName).toBe('Science Lab');

    // Get slot by ID
    const getRes = await getSlotRoute(
      makeRequest(`http://localhost:3000/api/v1/timetable/slots/${createdSlot.id}`),
      { params: Promise.resolve({ id: createdSlot.id }) }
    );
    expect(getRes.status).toBe(200);

    // Update slot
    const patchRes = await updateSlotRoute(
      makeRequest(`http://localhost:3000/api/v1/timetable/slots/${createdSlot.id}`, {
        method: 'PATCH',
        body: { roomId: SEED_ROOM_101, startTime: '09:05', endTime: '09:55' },
      }),
      { params: Promise.resolve({ id: createdSlot.id }) }
    );
    expect(patchRes.status).toBe(200);
    expect((await patchRes.json()).data.roomName).toBe('Room 101');

    // List slots with bounded pagination
    const listRes = await listSlotsRoute(
      makeRequest('http://localhost:3000/api/v1/timetable/slots?page=1&pageSize=2')
    );
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.data).toHaveLength(2);
    expect(listBody.pagination.total).toBeGreaterThanOrEqual(3);

    // Delete slot
    const delRes = await deleteSlotRoute(
      makeRequest(`http://localhost:3000/api/v1/timetable/slots/${createdSlot.id}`, {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: createdSlot.id }) }
    );
    expect(delRes.status).toBe(200);
    expect((await delRes.json()).data.deleted).toBe(true);
  });

  it('serves hydrated class, teacher, student, and daily timetable views with strict RBAC scoping', async () => {
    // TEACHER (Priya) can read assigned class (Class 10) and own teacher timetable
    const teacherClassRes = await getClassTimetableRoute(
      makeRequest(`http://localhost:3000/api/v1/timetable/class/${SEED_CLASS_10}`, {
        token: TEACHER_PRIYA_TOKEN,
      }),
      { params: Promise.resolve({ classId: SEED_CLASS_10 }) }
    );
    expect(teacherClassRes.status).toBe(200);
    const classBody = (await teacherClassRes.json()).data;
    expect(classBody.slots.length).toBeGreaterThanOrEqual(2);
    expect(classBody.slots[0].subject?.code).toBeTruthy();

    // TEACHER (Priya) blocked from unassigned class (Class 11)
    const teacherOtherClassRes = await getClassTimetableRoute(
      makeRequest(`http://localhost:3000/api/v1/timetable/class/${SEED_CLASS_11}`, {
        token: TEACHER_PRIYA_TOKEN,
      }),
      { params: Promise.resolve({ classId: SEED_CLASS_11 }) }
    );
    expect(teacherOtherClassRes.status).toBe(403);

    // TEACHER (Priya) can read own teacher timetable, blocked from Vikram's
    const ownTeacherRes = await getTeacherTimetableRoute(
      makeRequest(`http://localhost:3000/api/v1/timetable/teacher/${SEED_TEACHER_PRIYA}`, {
        token: TEACHER_PRIYA_TOKEN,
      }),
      { params: Promise.resolve({ teacherId: SEED_TEACHER_PRIYA }) }
    );
    expect(ownTeacherRes.status).toBe(200);

    const otherTeacherRes = await getTeacherTimetableRoute(
      makeRequest(`http://localhost:3000/api/v1/timetable/teacher/${SEED_TEACHER_VIKRAM}`, {
        token: TEACHER_PRIYA_TOKEN,
      }),
      { params: Promise.resolve({ teacherId: SEED_TEACHER_VIKRAM }) }
    );
    expect(otherTeacherRes.status).toBe(403);

    // STUDENT (Aarav) can read own student timetable and Class 10, blocked from Kabir and Class 9
    const ownStudentRes = await getStudentTimetableRoute(
      makeRequest(`http://localhost:3000/api/v1/timetable/student/${SEED_STUDENT_AARAV}`, {
        token: STUDENT_AARAV_TOKEN,
      }),
      { params: Promise.resolve({ studentId: SEED_STUDENT_AARAV }) }
    );
    expect(ownStudentRes.status).toBe(200);
    expect((await ownStudentRes.json()).data.studentId).toBe(SEED_STUDENT_AARAV);

    const otherStudentRes = await getStudentTimetableRoute(
      makeRequest(`http://localhost:3000/api/v1/timetable/student/${SEED_STUDENT_KABIR}`, {
        token: STUDENT_AARAV_TOKEN,
      }),
      { params: Promise.resolve({ studentId: SEED_STUDENT_KABIR }) }
    );
    expect(otherStudentRes.status).toBe(403);

    const studentOtherClassRes = await getClassTimetableRoute(
      makeRequest(`http://localhost:3000/api/v1/timetable/class/${SEED_CLASS_09}`, {
        token: STUDENT_AARAV_TOKEN,
      }),
      { params: Promise.resolve({ classId: SEED_CLASS_09 }) }
    );
    expect(studentOtherClassRes.status).toBe(403);

    // PARENT (Sunita) can read VERIFIED linked children (Aarav, Diya) and their classes
    const parentAaravRes = await getStudentTimetableRoute(
      makeRequest(`http://localhost:3000/api/v1/timetable/student/${SEED_STUDENT_AARAV}`, {
        token: PARENT_SUNITA_TOKEN,
      }),
      { params: Promise.resolve({ studentId: SEED_STUDENT_AARAV }) }
    );
    expect(parentAaravRes.status).toBe(200);

    const parentDiyaClassRes = await getClassTimetableRoute(
      makeRequest(`http://localhost:3000/api/v1/timetable/class/${SEED_CLASS_09}`, {
        token: PARENT_SUNITA_TOKEN,
      }),
      { params: Promise.resolve({ classId: SEED_CLASS_09 }) }
    );
    expect(parentDiyaClassRes.status).toBe(200);

    // Insert a PENDING link for Kabir to verify unverified-link fails closed (403)
    await dbStudents
      .prepare(
        `INSERT INTO parent_students (id, parent_profile_id, student_id, is_primary, verification_status, created_at)
         VALUES (?, '13000000-0000-4000-8000-000000000001', ?, 0, 'PENDING', '2026-04-02T00:00:00.000Z')
         ON CONFLICT DO NOTHING`
      )
      .bind(crypto.randomUUID(), SEED_STUDENT_KABIR)
      .run();

    const parentPendingRes = await getStudentTimetableRoute(
      makeRequest(`http://localhost:3000/api/v1/timetable/student/${SEED_STUDENT_KABIR}`, {
        token: PARENT_SUNITA_TOKEN,
      }),
      { params: Promise.resolve({ studentId: SEED_STUDENT_KABIR }) }
    );
    expect(parentPendingRes.status).toBe(403);

    // Non-admins cannot mutate rooms/slots/calendar
    const teacherMutateRoomRes = await createRoomRoute(
      makeRequest('http://localhost:3000/api/v1/timetable/rooms', {
        method: 'POST',
        token: TEACHER_PRIYA_TOKEN,
        body: { name: 'Forbidden Room', code: 'NOPE-1' },
      })
    );
    expect(teacherMutateRoomRes.status).toBe(403);

    // Daily timetable returns calendarEntry for 2026-08-15 (Independence Day HOLIDAY)
    const dailyRes = await getDailyTimetableRoute(
      makeRequest('http://localhost:3000/api/v1/timetable/daily?date=2026-08-15', {
        token: SUPER_ADMIN_TOKEN,
      })
    );
    expect(dailyRes.status).toBe(200);
    const dailyBody = (await dailyRes.json()).data;
    expect(dailyBody.calendarEntry?.id).toBe(SEED_CALENDAR_HOLIDAY);
    expect(dailyBody.calendarEntry?.dayType).toBe('HOLIDAY');
  });

  it('supports academic calendar CRUD, invalid date-range rejection, and best-effort audit logs', async () => {
    // Invalid date range (toDate < fromDate) rejected with 400
    const badRangeRes = await listCalendarRoute(
      makeRequest(
        'http://localhost:3000/api/v1/timetable/calendar?fromDate=2026-09-30&toDate=2026-09-01'
      )
    );
    expect(badRangeRes.status).toBe(400);

    // Create calendar entry
    const createCalRes = await createCalendarRoute(
      makeRequest('http://localhost:3000/api/v1/timetable/calendar', {
        method: 'POST',
        body: {
          academicSessionId: SEED_SESSION_2026,
          calendarDate: '2026-10-02',
          dayType: 'HOLIDAY',
          title: 'Gandhi Jayanti',
          notes: 'National holiday',
        },
      })
    );
    expect(createCalRes.status).toBe(201);
    const createdCal = (await createCalRes.json()).data;

    // Duplicate session + date rejected with 409
    const dupCalRes = await createCalendarRoute(
      makeRequest('http://localhost:3000/api/v1/timetable/calendar', {
        method: 'POST',
        body: {
          academicSessionId: SEED_SESSION_2026,
          calendarDate: '2026-10-02',
          dayType: 'WORKING',
          title: 'Duplicate Date',
        },
      })
    );
    expect(dupCalRes.status).toBe(409);

    // Get, update, and delete calendar entry
    const getCalRes = await getCalendarRoute(
      makeRequest(`http://localhost:3000/api/v1/timetable/calendar/${createdCal.id}`),
      { params: Promise.resolve({ id: createdCal.id }) }
    );
    expect(getCalRes.status).toBe(200);

    const patchCalRes = await updateCalendarRoute(
      makeRequest(`http://localhost:3000/api/v1/timetable/calendar/${createdCal.id}`, {
        method: 'PATCH',
        body: { dayType: 'SPECIAL_EVENT', title: 'Gandhi Jayanti Assembly' },
      }),
      { params: Promise.resolve({ id: createdCal.id }) }
    );
    expect(patchCalRes.status).toBe(200);
    expect((await patchCalRes.json()).data.dayType).toBe('SPECIAL_EVENT');

    const delCalRes = await deleteCalendarRoute(
      makeRequest(`http://localhost:3000/api/v1/timetable/calendar/${createdCal.id}`, {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: createdCal.id }) }
    );
    expect(delCalRes.status).toBe(200);

    // Verify best-effort audit events in DB_AUDIT.audit_logs
    const auditCount = await dbAudit
      .prepare(
        `SELECT COUNT(*) AS cnt
         FROM audit_logs
         WHERE entity_type IN ('rooms', 'timetable_slots', 'academic_calendar')`
      )
      .first();
    expect(Number(auditCount?.cnt || 0)).toBeGreaterThan(0);

    // Existing slot still present
    const slotCheck = await getSlotRoute(
      makeRequest(`http://localhost:3000/api/v1/timetable/slots/${SEED_SLOT_1}`),
      { params: Promise.resolve({ id: SEED_SLOT_1 }) }
    );
    expect(slotCheck.status).toBe(200);
  });

  it('fails closed (503) when DB_TIMETABLE, DB_ACADEMICS, or DB_STUDENTS binding is unavailable', async () => {
    workerEnvSpy.mockResolvedValueOnce({ ...testEnv, DB_TIMETABLE: undefined });
    const noTimetableRes = await listRoomsRoute(
      makeRequest('http://localhost:3000/api/v1/timetable/rooms')
    );
    expect(noTimetableRes.status).toBe(503);

    workerEnvSpy.mockResolvedValueOnce({ ...testEnv, DB_ACADEMICS: undefined });
    const noAcademicsRes = await getClassTimetableRoute(
      makeRequest(`http://localhost:3000/api/v1/timetable/class/${SEED_CLASS_10}`),
      { params: Promise.resolve({ classId: SEED_CLASS_10 }) }
    );
    expect(noAcademicsRes.status).toBe(503);

    workerEnvSpy.mockResolvedValueOnce({ ...testEnv, DB_STUDENTS: undefined });
    const noStudentsRes = await getStudentTimetableRoute(
      makeRequest(`http://localhost:3000/api/v1/timetable/student/${SEED_STUDENT_AARAV}`, {
        token: PARENT_SUNITA_TOKEN,
      }),
      { params: Promise.resolve({ studentId: SEED_STUDENT_AARAV }) }
    );
    expect(noStudentsRes.status).toBe(503);
  });
});
