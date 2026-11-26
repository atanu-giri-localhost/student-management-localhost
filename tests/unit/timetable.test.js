import { describe, expect, it } from 'vitest';
import {
  assertCanManageTimetable,
  assertCanReadClassTimetable,
  assertCanReadStudentTimetable,
  assertCanReadTeacherTimetable,
  assertCanReadTimetableReference,
} from '@/modules/timetable/timetable.permissions';
import {
  academicCalendarIdSchema,
  CALENDAR_DAY_TYPES,
  classTimetableQuerySchema,
  createAcademicCalendarEntrySchema,
  createRoomSchema,
  createTimetableSlotSchema,
  dailyTimetableQuerySchema,
  dayOfWeekSchema,
  listAcademicCalendarQuerySchema,
  listRoomsQuerySchema,
  listTimetableSlotsQuerySchema,
  periodNumberSchema,
  roomIdSchema,
  studentTimetableQuerySchema,
  teacherTimetableQuerySchema,
  timeStringSchema,
  timetableSlotIdSchema,
  updateAcademicCalendarEntrySchema,
  updateRoomSchema,
  updateTimetableSlotSchema,
} from '@/modules/timetable/timetable.schemas';
import {
  createTimetableSlotService,
  deleteRoomService,
  getRoomByIdService,
  getStudentTimetableService,
  TimetableServiceError,
  updateTimetableSlotService,
} from '@/modules/timetable/timetable.service';

const SESSION_UUID = '16000000-0000-4000-8000-000000000002';
const CLASS_UUID = '17000000-0000-4000-8000-000000000002';
const OTHER_CLASS_UUID = '17000000-0000-4000-8000-000000000001';
const SUBJECT_UUID = '18000000-0000-4000-8000-000000000001';
const TEACHER_UUID = '1b000000-0000-4000-8000-000000000001';
const OTHER_TEACHER_UUID = '1b000000-0000-4000-8000-000000000002';
const STUDENT_UUID = '14000000-0000-4000-8000-000000000001';
const OTHER_STUDENT_UUID = '14000000-0000-4000-8000-000000000003';
const PARENT_UUID = '13000000-0000-4000-8000-000000000001';
const ROOM_UUID = '26000000-0000-4000-8000-000000000001';
const SLOT_UUID = '27000000-0000-4000-8000-000000000001';

function createMockDb(matcher) {
  return {
    prepare(sql) {
      let boundArgs = [];
      const stmt = {
        bind(...args) {
          boundArgs = args;
          return stmt;
        },
        async first() {
          return matcher(sql, boundArgs, 'first');
        },
        async all() {
          const res = await matcher(sql, boundArgs, 'all');
          return { results: Array.isArray(res) ? res : [] };
        },
        async run() {
          await matcher(sql, boundArgs, 'run');
          return { success: true, meta: { changes: 1 } };
        },
      };
      return stmt;
    },
  };
}

describe('Timetable Zod Schemas', () => {
  it('defines canonical CALENDAR_DAY_TYPES and identifier schemas', () => {
    expect(CALENDAR_DAY_TYPES).toEqual(['WORKING', 'HOLIDAY', 'EXAM_DAY', 'SPECIAL_EVENT']);

    expect(roomIdSchema.safeParse(ROOM_UUID).success).toBe(true);
    expect(timetableSlotIdSchema.safeParse(SLOT_UUID).success).toBe(true);
    expect(academicCalendarIdSchema.safeParse(SESSION_UUID).success).toBe(true);

    expect(roomIdSchema.safeParse('not-a-uuid').success).toBe(false);
    expect(timetableSlotIdSchema.safeParse('12345').success).toBe(false);
    expect(academicCalendarIdSchema.safeParse('').success).toBe(false);
  });

  it('validates timeStringSchema, dayOfWeekSchema, and periodNumberSchema', () => {
    expect(timeStringSchema.safeParse('09:00').success).toBe(true);
    expect(timeStringSchema.safeParse('23:59').success).toBe(true);
    expect(timeStringSchema.safeParse('00:00').success).toBe(true);
    expect(timeStringSchema.safeParse('9:00').success).toBe(false);
    expect(timeStringSchema.safeParse('24:00').success).toBe(false);
    expect(timeStringSchema.safeParse('12:60').success).toBe(false);

    expect(dayOfWeekSchema.safeParse(1).success).toBe(true);
    expect(dayOfWeekSchema.safeParse('7').success).toBe(true);
    expect(dayOfWeekSchema.safeParse(0).success).toBe(false);
    expect(dayOfWeekSchema.safeParse(8).success).toBe(false);

    expect(periodNumberSchema.safeParse(1).success).toBe(true);
    expect(periodNumberSchema.safeParse('6').success).toBe(true);
    expect(periodNumberSchema.safeParse(0).success).toBe(false);
    expect(periodNumberSchema.safeParse(-1).success).toBe(false);
  });

  it('validates createRoomSchema, updateRoomSchema, and listRoomsQuerySchema', () => {
    const validCreate = createRoomSchema.safeParse({
      name: '  Physics Lab  ',
      code: '  PHY-1  ',
      capacity: '35',
      floorOrBuilding: 'Second Floor',
    });
    expect(validCreate.success).toBe(true);
    expect(validCreate.data?.name).toBe('Physics Lab');
    expect(validCreate.data?.code).toBe('PHY-1');
    expect(validCreate.data?.capacity).toBe(35);
    expect(validCreate.data?.isActive).toBe(true);

    expect(
      createRoomSchema.safeParse({
        name: 'Room A',
        code: 'R-A',
        capacity: 0,
      }).success
    ).toBe(false);

    expect(
      createRoomSchema.safeParse({
        name: 'Room A',
        code: 'R-A',
        extraField: true,
      }).success
    ).toBe(false);

    expect(updateRoomSchema.safeParse({}).success).toBe(false);
    expect(updateRoomSchema.safeParse({ isActive: false }).success).toBe(true);

    const listQuery = listRoomsQuerySchema.safeParse({
      page: '2',
      pageSize: '25',
      search: 'Lab',
      isActive: 'true',
    });
    expect(listQuery.success).toBe(true);
    expect(listQuery.data?.page).toBe(2);
    expect(listQuery.data?.pageSize).toBe(25);
    expect(listQuery.data?.isActive).toBe(true);

    expect(listRoomsQuerySchema.safeParse({ pageSize: '101' }).success).toBe(false);
  });

  it('validates createTimetableSlotSchema, updateTimetableSlotSchema, and slot query schemas', () => {
    const validSlot = createTimetableSlotSchema.safeParse({
      academicSessionId: SESSION_UUID,
      classId: CLASS_UUID,
      subjectId: SUBJECT_UUID,
      teacherProfileId: TEACHER_UUID,
      roomId: ROOM_UUID,
      dayOfWeek: 1,
      periodNumber: 3,
      startTime: '11:00',
      endTime: '11:50',
    });
    expect(validSlot.success).toBe(true);

    // endTime <= startTime rejected
    expect(
      createTimetableSlotSchema.safeParse({
        academicSessionId: SESSION_UUID,
        classId: CLASS_UUID,
        subjectId: SUBJECT_UUID,
        teacherProfileId: TEACHER_UUID,
        dayOfWeek: 1,
        periodNumber: 3,
        startTime: '11:00',
        endTime: '11:00',
      }).success
    ).toBe(false);

    expect(
      createTimetableSlotSchema.safeParse({
        academicSessionId: SESSION_UUID,
        classId: CLASS_UUID,
        subjectId: SUBJECT_UUID,
        teacherProfileId: TEACHER_UUID,
        dayOfWeek: 1,
        periodNumber: 3,
        startTime: '12:00',
        endTime: '11:50',
      }).success
    ).toBe(false);

    // Invalid identifiers rejected
    expect(
      createTimetableSlotSchema.safeParse({
        academicSessionId: 'bad-id',
        classId: CLASS_UUID,
        subjectId: SUBJECT_UUID,
        teacherProfileId: TEACHER_UUID,
        dayOfWeek: 1,
        periodNumber: 1,
        startTime: '09:00',
        endTime: '09:50',
      }).success
    ).toBe(false);

    // updateTimetableSlotSchema rejects empty object and reversed time range
    expect(updateTimetableSlotSchema.safeParse({}).success).toBe(false);
    expect(
      updateTimetableSlotSchema.safeParse({
        startTime: '14:00',
        endTime: '13:00',
      }).success
    ).toBe(false);
    expect(updateTimetableSlotSchema.safeParse({ roomId: null }).success).toBe(true);

    expect(
      listTimetableSlotsQuerySchema.safeParse({
        academicSessionId: SESSION_UUID,
        classId: CLASS_UUID,
        dayOfWeek: '2',
        page: '1',
        pageSize: '20',
      }).success
    ).toBe(true);

    expect(classTimetableQuerySchema.safeParse({ dayOfWeek: '5' }).success).toBe(true);
    expect(teacherTimetableQuerySchema.safeParse({ academicSessionId: SESSION_UUID }).success).toBe(
      true
    );
    expect(studentTimetableQuerySchema.safeParse({ dayOfWeek: '8' }).success).toBe(false);
    expect(
      dailyTimetableQuerySchema.safeParse({
        date: '2026-08-15',
        classId: CLASS_UUID,
      }).success
    ).toBe(true);
    expect(dailyTimetableQuerySchema.safeParse({ date: '15-08-2026' }).success).toBe(false);
  });

  it('validates academic calendar schemas and date ranges', () => {
    const validCalendar = createAcademicCalendarEntrySchema.safeParse({
      academicSessionId: SESSION_UUID,
      calendarDate: '2026-10-02',
      dayType: 'HOLIDAY',
      title: '  Gandhi Jayanti  ',
      notes: 'National holiday',
    });
    expect(validCalendar.success).toBe(true);
    expect(validCalendar.data?.title).toBe('Gandhi Jayanti');

    expect(
      createAcademicCalendarEntrySchema.safeParse({
        academicSessionId: SESSION_UUID,
        calendarDate: '2026-10-02',
        dayType: 'SNOW_DAY',
        title: 'Invalid Day Type',
      }).success
    ).toBe(false);

    expect(updateAcademicCalendarEntrySchema.safeParse({}).success).toBe(false);
    expect(
      updateAcademicCalendarEntrySchema.safeParse({ dayType: 'EXAM_DAY', title: 'Half Yearly' })
        .success
    ).toBe(true);

    // Valid date range
    expect(
      listAcademicCalendarQuerySchema.safeParse({
        academicSessionId: SESSION_UUID,
        fromDate: '2026-04-01',
        toDate: '2026-04-30',
        dayType: 'WORKING',
      }).success
    ).toBe(true);

    // Same-day range allowed
    expect(
      listAcademicCalendarQuerySchema.safeParse({
        fromDate: '2026-04-15',
        toDate: '2026-04-15',
      }).success
    ).toBe(true);

    // toDate before fromDate rejected
    expect(
      listAcademicCalendarQuerySchema.safeParse({
        fromDate: '2026-04-30',
        toDate: '2026-04-01',
      }).success
    ).toBe(false);
  });
});

describe('Timetable Permissions', () => {
  it('enforces manage vs reference-read roles', () => {
    expect(assertCanManageTimetable(null)).toMatchObject({ status: 403 });
    expect(assertCanManageTimetable({ roles: ['SUPER_ADMIN'] })).toBeNull();
    expect(assertCanManageTimetable({ roles: ['COACHING_ADMIN'] })).toBeNull();
    expect(assertCanManageTimetable({ roles: ['TEACHER'] })).toMatchObject({ status: 403 });
    expect(assertCanManageTimetable({ roles: ['STUDENT'] })).toMatchObject({ status: 403 });
    expect(assertCanManageTimetable({ roles: ['PARENT'] })).toMatchObject({ status: 403 });

    expect(assertCanReadTimetableReference(null)).toMatchObject({ status: 403 });
    for (const role of ['SUPER_ADMIN', 'COACHING_ADMIN', 'TEACHER', 'STUDENT', 'PARENT']) {
      expect(assertCanReadTimetableReference({ roles: [role] })).toBeNull();
    }
  });

  it('scopes class timetable access for TEACHER, STUDENT, and PARENT', async () => {
    const dbAcademics = createMockDb(async (sql, args) => {
      if (sql.includes('FROM academic_sessions')) {
        return { id: SESSION_UUID };
      }
      if (sql.includes('FROM teacher_assignments')) {
        const [teacherId, sessionId, classId] = args;
        if (teacherId === TEACHER_UUID && sessionId === SESSION_UUID && classId === CLASS_UUID) {
          return { ok: 1, id: 'assign-1' };
        }
        return null;
      }
      return null;
    });

    const dbStudents = createMockDb(async (sql, args) => {
      if (sql.includes('FROM parent_students ps')) {
        const [parentId, classId] = args;
        if (parentId === PARENT_UUID && classId === CLASS_UUID) {
          return { ok: 1 };
        }
        return null;
      }
      if (sql.includes('FROM enrollments')) {
        const [studentId, classId] = args;
        if (studentId === STUDENT_UUID && classId === CLASS_UUID) {
          return { ok: 1 };
        }
        return null;
      }
      return null;
    });

    // Admins always allowed
    expect(
      await assertCanReadClassTimetable(dbAcademics, dbStudents, { roles: ['SUPER_ADMIN'] }, { classId: CLASS_UUID })
    ).toBeNull();
    expect(
      await assertCanReadClassTimetable(dbAcademics, dbStudents, { roles: ['COACHING_ADMIN'] }, { classId: CLASS_UUID })
    ).toBeNull();

    // Teacher allowed for assigned class, denied for unassigned class
    expect(
      await assertCanReadClassTimetable(
        dbAcademics,
        dbStudents,
        { roles: ['TEACHER'], profiles: { teacherProfileId: TEACHER_UUID } },
        { academicSessionId: SESSION_UUID, classId: CLASS_UUID }
      )
    ).toBeNull();
    expect(
      await assertCanReadClassTimetable(
        dbAcademics,
        dbStudents,
        { roles: ['TEACHER'], profiles: { teacherProfileId: TEACHER_UUID } },
        { academicSessionId: SESSION_UUID, classId: OTHER_CLASS_UUID }
      )
    ).toMatchObject({ status: 403 });

    // Student allowed for enrolled class, denied for other class
    expect(
      await assertCanReadClassTimetable(
        dbAcademics,
        dbStudents,
        { roles: ['STUDENT'], profiles: { studentId: STUDENT_UUID } },
        { academicSessionId: SESSION_UUID, classId: CLASS_UUID }
      )
    ).toBeNull();
    expect(
      await assertCanReadClassTimetable(
        dbAcademics,
        dbStudents,
        { roles: ['STUDENT'], profiles: { studentId: STUDENT_UUID } },
        { academicSessionId: SESSION_UUID, classId: OTHER_CLASS_UUID }
      )
    ).toMatchObject({ status: 403 });

    // Parent allowed for verified linked child's class, denied otherwise
    expect(
      await assertCanReadClassTimetable(
        dbAcademics,
        dbStudents,
        { roles: ['PARENT'], profiles: { parentProfileId: PARENT_UUID } },
        { academicSessionId: SESSION_UUID, classId: CLASS_UUID }
      )
    ).toBeNull();
    expect(
      await assertCanReadClassTimetable(
        dbAcademics,
        dbStudents,
        { roles: ['PARENT'], profiles: { parentProfileId: PARENT_UUID } },
        { academicSessionId: SESSION_UUID, classId: OTHER_CLASS_UUID }
      )
    ).toMatchObject({ status: 403 });
  });

  it('scopes teacher timetable access to admins and self', () => {
    expect(assertCanReadTeacherTimetable({ roles: ['SUPER_ADMIN'] }, TEACHER_UUID)).toBeNull();
    expect(assertCanReadTeacherTimetable({ roles: ['COACHING_ADMIN'] }, TEACHER_UUID)).toBeNull();
    expect(
      assertCanReadTeacherTimetable(
        { roles: ['TEACHER'], profiles: { teacherProfileId: TEACHER_UUID } },
        TEACHER_UUID
      )
    ).toBeNull();

    expect(
      assertCanReadTeacherTimetable(
        { roles: ['TEACHER'], profiles: { teacherProfileId: TEACHER_UUID } },
        OTHER_TEACHER_UUID
      )
    ).toMatchObject({ status: 403 });
    expect(
      assertCanReadTeacherTimetable(
        { roles: ['STUDENT'], profiles: { studentId: STUDENT_UUID } },
        TEACHER_UUID
      )
    ).toMatchObject({ status: 403 });
    expect(
      assertCanReadTeacherTimetable(
        { roles: ['PARENT'], profiles: { parentProfileId: PARENT_UUID } },
        TEACHER_UUID
      )
    ).toMatchObject({ status: 403 });
  });

  it('scopes student timetable access to admins, self, and VERIFIED parents (fail-closed)', async () => {
    const dbStudents = createMockDb(async (sql, args) => {
      if (sql.includes('FROM parent_students')) {
        const [parentId, studentId] = args;
        if (parentId === PARENT_UUID && studentId === STUDENT_UUID) {
          return { ok: 1 };
        }
        return null;
      }
      return null;
    });

    expect(
      await assertCanReadStudentTimetable(dbStudents, { roles: ['SUPER_ADMIN'] }, STUDENT_UUID)
    ).toBeNull();
    expect(
      await assertCanReadStudentTimetable(dbStudents, { roles: ['COACHING_ADMIN'] }, STUDENT_UUID)
    ).toBeNull();

    expect(
      await assertCanReadStudentTimetable(
        dbStudents,
        { roles: ['STUDENT'], profiles: { studentId: STUDENT_UUID } },
        STUDENT_UUID
      )
    ).toBeNull();
    expect(
      await assertCanReadStudentTimetable(
        dbStudents,
        { roles: ['STUDENT'], profiles: { studentId: STUDENT_UUID } },
        OTHER_STUDENT_UUID
      )
    ).toMatchObject({ status: 403 });

    expect(
      await assertCanReadStudentTimetable(
        dbStudents,
        { roles: ['PARENT'], profiles: { parentProfileId: PARENT_UUID } },
        STUDENT_UUID
      )
    ).toBeNull();
    expect(
      await assertCanReadStudentTimetable(
        dbStudents,
        { roles: ['PARENT'], profiles: { parentProfileId: PARENT_UUID } },
        OTHER_STUDENT_UUID
      )
    ).toMatchObject({ status: 403 });

    // Missing dbStudents fails closed for parent
    expect(
      await assertCanReadStudentTimetable(
        null,
        { roles: ['PARENT'], profiles: { parentProfileId: PARENT_UUID } },
        STUDENT_UUID
      )
    ).toMatchObject({ status: 403 });
  });
});

describe('Timetable Conflict Logic & TimetableServiceError', () => {
  it('constructs TimetableServiceError with code, message, status, and details', () => {
    const err = new TimetableServiceError('CONFLICT', 'Room booked', 409, {
      conflictingSlotIds: [SLOT_UUID],
    });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('TimetableServiceError');
    expect(err.code).toBe('CONFLICT');
    expect(err.message).toBe('Room booked');
    expect(err.status).toBe(409);
    expect(err.details).toEqual({ conflictingSlotIds: [SLOT_UUID] });
  });

  it('rejects missing room on getRoomByIdService and referenced room on deleteRoomService', async () => {
    const dbMissing = createMockDb(async () => null);
    await expect(getRoomByIdService(dbMissing, ROOM_UUID)).rejects.toMatchObject({
      name: 'TimetableServiceError',
      code: 'NOT_FOUND',
      status: 404,
    });

    const dbReferenced = createMockDb(async (sql) => {
      if (sql.includes('FROM rooms')) {
        return {
          id: ROOM_UUID,
          name: 'Room 101',
          code: 'R-101',
          capacity: 40,
          floor_or_building: 'First Floor',
          is_active: 1,
          created_at: '2026-04-01T08:00:00.000Z',
        };
      }
      if (sql.includes('COUNT(*) AS total FROM timetable_slots')) {
        return { total: 2 };
      }
      return null;
    });

    await expect(
      deleteRoomService(dbReferenced, {}, { userId: 'admin-1' }, ROOM_UUID)
    ).rejects.toMatchObject({
      name: 'TimetableServiceError',
      code: 'CONFLICT',
      status: 409,
    });
  });

  it('throws 409 CONFLICT with descriptive message on class, teacher, or room slot collisions', async () => {
    const dbAcademics = createMockDb(async (sql) => {
      if (sql.includes('FROM academic_sessions')) return { id: SESSION_UUID };
      if (sql.includes('FROM classes')) return { id: CLASS_UUID, name: 'Class 10', grade_level: 10, section: 'A' };
      if (sql.includes('FROM subjects')) return { id: SUBJECT_UUID };
      if (sql.includes('FROM class_subjects')) return { id: 'cs-1' };
      if (sql.includes('FROM teacher_profiles')) return { id: TEACHER_UUID, full_name: 'Priya Nair', employee_code: 'TCH-001' };
      if (sql.includes('FROM teacher_assignments')) return { id: 'ta-1' };
      return null;
    });

    const makeConflictDb = (conflictRow) =>
      createMockDb(async (sql) => {
        if (sql.includes('FROM rooms')) {
          return {
            id: ROOM_UUID,
            name: 'Room 101',
            code: 'R-101',
            capacity: 40,
            floor_or_building: 'First Floor',
            is_active: 1,
            created_at: '2026-04-01T08:00:00.000Z',
          };
        }
        if (sql.includes('FROM timetable_slots') && sql.includes('AND (')) {
          return [conflictRow];
        }
        return null;
      });

    const baseInput = {
      academicSessionId: SESSION_UUID,
      classId: CLASS_UUID,
      subjectId: SUBJECT_UUID,
      teacherProfileId: TEACHER_UUID,
      roomId: ROOM_UUID,
      dayOfWeek: 1,
      periodNumber: 1,
      startTime: '09:00',
      endTime: '09:50',
    };

    const workerEnv = { DB_ACADEMICS: dbAcademics };

    // Class conflict
    await expect(
      createTimetableSlotService(
        makeConflictDb({
          id: SLOT_UUID,
          academic_session_id: SESSION_UUID,
          class_id: CLASS_UUID,
          subject_id: SUBJECT_UUID,
          teacher_profile_id: OTHER_TEACHER_UUID,
          room_id: null,
          room_name: null,
          day_of_week: 1,
          period_number: 1,
          start_time: '09:00',
          end_time: '09:50',
          created_at: '2026-04-01T08:00:00.000Z',
        }),
        workerEnv,
        { userId: 'admin-1' },
        baseInput
      )
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      status: 409,
      details: { conflictingSlotIds: [SLOT_UUID] },
    });

    // Teacher conflict
    await expect(
      createTimetableSlotService(
        makeConflictDb({
          id: SLOT_UUID,
          academic_session_id: SESSION_UUID,
          class_id: OTHER_CLASS_UUID,
          subject_id: SUBJECT_UUID,
          teacher_profile_id: TEACHER_UUID,
          room_id: null,
          room_name: null,
          day_of_week: 1,
          period_number: 1,
          start_time: '09:15',
          end_time: '10:00',
          created_at: '2026-04-01T08:00:00.000Z',
        }),
        workerEnv,
        { userId: 'admin-1' },
        baseInput
      )
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      status: 409,
      details: { conflictingSlotIds: [SLOT_UUID] },
    });

    // Room conflict
    await expect(
      createTimetableSlotService(
        makeConflictDb({
          id: SLOT_UUID,
          academic_session_id: SESSION_UUID,
          class_id: OTHER_CLASS_UUID,
          subject_id: SUBJECT_UUID,
          teacher_profile_id: OTHER_TEACHER_UUID,
          room_id: ROOM_UUID,
          room_name: 'Room 101',
          day_of_week: 1,
          period_number: 1,
          start_time: '09:00',
          end_time: '09:50',
          created_at: '2026-04-01T08:00:00.000Z',
        }),
        workerEnv,
        { userId: 'admin-1' },
        baseInput
      )
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      status: 409,
      details: { conflictingSlotIds: [SLOT_UUID] },
    });
  });

  it('rejects partial time update when merged endTime <= startTime and missing student enrollment', async () => {
    const dbTimetable = createMockDb(async (sql) => {
      if (sql.includes('FROM timetable_slots') && sql.includes('WHERE id = ?')) {
        return {
          id: SLOT_UUID,
          academic_session_id: SESSION_UUID,
          class_id: CLASS_UUID,
          subject_id: SUBJECT_UUID,
          teacher_profile_id: TEACHER_UUID,
          room_id: ROOM_UUID,
          room_name: 'Room 101',
          day_of_week: 1,
          period_number: 1,
          start_time: '09:00',
          end_time: '09:50',
          created_at: '2026-04-01T08:00:00.000Z',
        };
      }
      return null;
    });

    await expect(
      updateTimetableSlotService(
        dbTimetable,
        {},
        { userId: 'admin-1' },
        SLOT_UUID,
        { startTime: '10:00' }
      )
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 400,
    });

    const dbAcademics = createMockDb(async (sql) => {
      if (sql.includes('FROM academic_sessions')) return { id: SESSION_UUID };
      return null;
    });
    const dbStudents = createMockDb(async () => null);

    await expect(
      getStudentTimetableService(
        dbTimetable,
        { DB_ACADEMICS: dbAcademics, DB_STUDENTS: dbStudents },
        STUDENT_UUID
      )
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });
});
