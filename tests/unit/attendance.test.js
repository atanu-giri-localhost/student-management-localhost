import { describe, expect, it } from 'vitest';
import {
  assertCanCorrectAttendance,
  assertCanManageAttendance,
  assertCanMarkDailyAttendance,
  assertCanMarkPeriodAttendance,
  assertCanReadStudentAttendance,
} from '@/modules/attendance/attendance.permissions';
import {
  ATTENDANCE_STATUSES,
  attendanceSummaryQuerySchema,
  createAttendanceCorrectionSchema,
  createDailyRegisterSchema,
  createPeriodRegisterSchema,
  listDailyRegistersQuerySchema,
  listPeriodRegistersQuerySchema,
  markDailyAttendanceRecordsSchema,
  markPeriodAttendanceRecordsSchema,
  REGISTER_TYPES,
  studentAttendanceQuerySchema,
} from '@/modules/attendance/attendance.schemas';

const SESSION_UUID = '16000000-0000-4000-8000-000000000002';
const CLASS_UUID = '17000000-0000-4000-8000-000000000002';
const SUBJECT_UUID = '18000000-0000-4000-8000-000000000001';
const TEACHER_UUID = '1b000000-0000-4000-8000-000000000001';
const ENROLLMENT_UUID_1 = '1a000000-0000-4000-8000-000000000002';
const ENROLLMENT_UUID_2 = '1a000000-0000-4000-8000-000000000004';
const REGISTER_UUID = '1d000000-0000-4000-8000-000000000001';
const RECORD_UUID = '1e000000-0000-4000-8000-000000000001';
const STUDENT_UUID = '14000000-0000-4000-8000-000000000001';
const OTHER_STUDENT_UUID = '14000000-0000-4000-8000-000000000003';
const PARENT_UUID = '13000000-0000-4000-8000-000000000001';

describe('Attendance Zod Schemas', () => {
  it('defines canonical ATTENDANCE_STATUSES and REGISTER_TYPES', () => {
    expect(ATTENDANCE_STATUSES).toEqual(['PRESENT', 'ABSENT', 'LATE', 'LEAVE']);
    expect(REGISTER_TYPES).toEqual(['DAILY', 'PERIOD']);
  });

  it('validates createDailyRegisterSchema', () => {
    const valid = createDailyRegisterSchema.safeParse({
      academicSessionId: SESSION_UUID,
      classId: CLASS_UUID,
      attendanceDate: '2026-11-24',
    });
    expect(valid.success).toBe(true);
    expect(valid.data?.isLocked).toBe(false);

    const withTeacherAndLock = createDailyRegisterSchema.safeParse({
      academicSessionId: SESSION_UUID,
      classId: CLASS_UUID,
      attendanceDate: '2026-11-24',
      markedByTeacherId: TEACHER_UUID,
      isLocked: true,
    });
    expect(withTeacherAndLock.success).toBe(true);
    expect(withTeacherAndLock.data?.isLocked).toBe(true);

    expect(
      createDailyRegisterSchema.safeParse({
        academicSessionId: 'bad-uuid',
        classId: CLASS_UUID,
        attendanceDate: '2026-11-24',
      }).success
    ).toBe(false);

    expect(
      createDailyRegisterSchema.safeParse({
        academicSessionId: SESSION_UUID,
        classId: CLASS_UUID,
        attendanceDate: '24-11-2026',
      }).success
    ).toBe(false);

    expect(
      createDailyRegisterSchema.safeParse({
        academicSessionId: SESSION_UUID,
        classId: CLASS_UUID,
        attendanceDate: '2026-11-24',
        extraField: 'nope',
      }).success
    ).toBe(false);
  });

  it('validates createPeriodRegisterSchema', () => {
    const valid = createPeriodRegisterSchema.safeParse({
      academicSessionId: SESSION_UUID,
      classId: CLASS_UUID,
      subjectId: SUBJECT_UUID,
      attendanceDate: '2026-11-24',
      periodNumber: '3',
    });
    expect(valid.success).toBe(true);
    expect(valid.data?.periodNumber).toBe(3);
    expect(valid.data?.isLocked).toBe(false);

    expect(
      createPeriodRegisterSchema.safeParse({
        academicSessionId: SESSION_UUID,
        classId: CLASS_UUID,
        subjectId: SUBJECT_UUID,
        attendanceDate: '2026-11-24',
        periodNumber: 0,
      }).success
    ).toBe(false);

    expect(
      createPeriodRegisterSchema.safeParse({
        academicSessionId: SESSION_UUID,
        classId: CLASS_UUID,
        subjectId: SUBJECT_UUID,
        attendanceDate: '2026-11-24',
        periodNumber: 25,
      }).success
    ).toBe(false);
  });

  it('validates markDailyAttendanceRecordsSchema and markPeriodAttendanceRecordsSchema', () => {
    const valid = markDailyAttendanceRecordsSchema.safeParse({
      records: [
        { enrollmentId: ENROLLMENT_UUID_1, status: 'PRESENT', remarks: '' },
        { enrollmentId: ENROLLMENT_UUID_2, status: 'LATE', remarks: 'Bus delayed' },
      ],
    });
    expect(valid.success).toBe(true);
    expect(valid.data?.records[0].remarks).toBeNull();
    expect(valid.data?.records[1].remarks).toBe('Bus delayed');

    expect(markDailyAttendanceRecordsSchema.safeParse({ records: [] }).success).toBe(false);

    const duplicateEnrollment = markPeriodAttendanceRecordsSchema.safeParse({
      records: [
        { enrollmentId: ENROLLMENT_UUID_1, status: 'PRESENT' },
        { enrollmentId: ENROLLMENT_UUID_1, status: 'ABSENT' },
      ],
    });
    expect(duplicateEnrollment.success).toBe(false);

    expect(
      markDailyAttendanceRecordsSchema.safeParse({
        records: [{ enrollmentId: ENROLLMENT_UUID_1, status: 'EXCUSED' }],
      }).success
    ).toBe(false);
  });

  it('validates createAttendanceCorrectionSchema', () => {
    const valid = createAttendanceCorrectionSchema.safeParse({
      registerType: 'DAILY',
      registerId: REGISTER_UUID,
      recordId: RECORD_UUID,
      newStatus: 'ABSENT',
      reason: '  Parent confirmed leave over phone  ',
    });
    expect(valid.success).toBe(true);
    expect(valid.data?.reason).toBe('Parent confirmed leave over phone');

    expect(
      createAttendanceCorrectionSchema.safeParse({
        registerType: 'WEEKLY',
        registerId: REGISTER_UUID,
        recordId: RECORD_UUID,
        newStatus: 'ABSENT',
        reason: 'Correction',
      }).success
    ).toBe(false);

    expect(
      createAttendanceCorrectionSchema.safeParse({
        registerType: 'PERIOD',
        registerId: REGISTER_UUID,
        recordId: RECORD_UUID,
        newStatus: 'LEAVE',
        reason: '   ',
      }).success
    ).toBe(false);
  });

  it('validates studentAttendanceQuerySchema and register/summary query date ranges', () => {
    const defaults = studentAttendanceQuerySchema.safeParse({});
    expect(defaults.success).toBe(true);
    expect(defaults.data?.registerType).toBe('DAILY');
    expect(defaults.data?.page).toBe(1);
    expect(defaults.data?.pageSize).toBe(25);

    const validRange = studentAttendanceQuerySchema.safeParse({
      registerType: 'PERIOD',
      academicSessionId: SESSION_UUID,
      fromDate: '2026-11-01',
      toDate: '2026-11-30',
      page: '2',
      pageSize: '15',
    });
    expect(validRange.success).toBe(true);
    expect(validRange.data?.page).toBe(2);
    expect(validRange.data?.pageSize).toBe(15);

    const invalidRange = studentAttendanceQuerySchema.safeParse({
      fromDate: '2026-11-30',
      toDate: '2026-11-01',
    });
    expect(invalidRange.success).toBe(false);

    expect(
      listDailyRegistersQuerySchema.safeParse({
        isLocked: 'true',
        fromDate: '2026-11-01',
        toDate: '2026-11-10',
      }).success
    ).toBe(true);
    expect(
      listPeriodRegistersQuerySchema.safeParse({
        periodNumber: '2',
        fromDate: '2026-11-10',
        toDate: '2026-11-01',
      }).success
    ).toBe(false);
    expect(
      attendanceSummaryQuerySchema.safeParse({
        academicSessionId: SESSION_UUID,
        registerType: 'DAILY',
      }).success
    ).toBe(true);
  });
});

describe('Attendance Permissions', () => {
  it('enforces assertCanManageAttendance and assertCanCorrectAttendance', () => {
    expect(assertCanManageAttendance({ roles: ['SUPER_ADMIN'] })).toBeNull();
    expect(assertCanManageAttendance({ roles: ['COACHING_ADMIN'] })).toBeNull();
    expect(assertCanManageAttendance({ roles: ['TEACHER'] })?.status).toBe(403);
    expect(assertCanManageAttendance({ roles: ['STUDENT'] })?.status).toBe(403);
    expect(assertCanManageAttendance({ roles: ['PARENT'] })?.status).toBe(403);

    expect(assertCanCorrectAttendance({ roles: ['SUPER_ADMIN'] })).toBeNull();
    expect(assertCanCorrectAttendance({ roles: ['COACHING_ADMIN'] })).toBeNull();
    expect(assertCanCorrectAttendance({ roles: ['TEACHER'] })?.status).toBe(403);
    expect(assertCanCorrectAttendance({ roles: ['STUDENT'] })?.status).toBe(403);
    expect(assertCanCorrectAttendance({ roles: ['PARENT'] })?.status).toBe(403);
  });

  it('enforces assertCanMarkDailyAttendance and assertCanMarkPeriodAttendance including fail-closed on missing/failing DB_ACADEMICS', async () => {
    const activeTeacherId = TEACHER_UUID;
    const inactiveTeacherId = '1b000000-0000-4000-8000-000000000099';

    const mockDbAcademics = {
      prepare: (sql) => ({
        bind: (...args) => ({
          first: async () => {
            const [teacherId, sessionId, classId, subjectId] = args;
            if (teacherId !== activeTeacherId) return null;
            if (sessionId !== SESSION_UUID || classId !== CLASS_UUID) return null;
            if (sql.includes('ta.subject_id = ?') && subjectId !== SUBJECT_UUID) return null;
            return { ok: 1 };
          },
        }),
      }),
    };

    const failingDbAcademics = {
      prepare: () => {
        throw new Error('D1 unavailable');
      },
    };

    // Admins bypass DB lookup
    expect(
      await assertCanMarkDailyAttendance(null, { roles: ['SUPER_ADMIN'] }, {
        academicSessionId: SESSION_UUID,
        classId: CLASS_UUID,
      })
    ).toBeNull();
    expect(
      await assertCanMarkPeriodAttendance(null, { roles: ['COACHING_ADMIN'] }, {
        academicSessionId: SESSION_UUID,
        classId: CLASS_UUID,
        subjectId: SUBJECT_UUID,
      })
    ).toBeNull();

    // Missing or failing DB_ACADEMICS fails closed for teachers
    const teacherSession = { roles: ['TEACHER'], profiles: { teacherProfileId: activeTeacherId } };
    expect(
      (
        await assertCanMarkDailyAttendance(null, teacherSession, {
          academicSessionId: SESSION_UUID,
          classId: CLASS_UUID,
        })
      )?.status
    ).toBe(403);
    expect(
      (
        await assertCanMarkPeriodAttendance(null, teacherSession, {
          academicSessionId: SESSION_UUID,
          classId: CLASS_UUID,
          subjectId: SUBJECT_UUID,
        })
      )?.status
    ).toBe(403);
    expect(
      (
        await assertCanMarkDailyAttendance(failingDbAcademics, teacherSession, {
          academicSessionId: SESSION_UUID,
          classId: CLASS_UUID,
        })
      )?.status
    ).toBe(403);
    expect(
      (
        await assertCanMarkPeriodAttendance(failingDbAcademics, teacherSession, {
          academicSessionId: SESSION_UUID,
          classId: CLASS_UUID,
          subjectId: SUBJECT_UUID,
        })
      )?.status
    ).toBe(403);

    // Assigned active teacher succeeds
    expect(
      await assertCanMarkDailyAttendance(mockDbAcademics, teacherSession, {
        academicSessionId: SESSION_UUID,
        classId: CLASS_UUID,
      })
    ).toBeNull();
    expect(
      await assertCanMarkPeriodAttendance(mockDbAcademics, teacherSession, {
        academicSessionId: SESSION_UUID,
        classId: CLASS_UUID,
        subjectId: SUBJECT_UUID,
      })
    ).toBeNull();

    // Unassigned class/subject or inactive teacher fails with 403
    expect(
      (
        await assertCanMarkDailyAttendance(mockDbAcademics, teacherSession, {
          academicSessionId: SESSION_UUID,
          classId: '17000000-0000-4000-8000-000000000003',
        })
      )?.status
    ).toBe(403);
    expect(
      (
        await assertCanMarkPeriodAttendance(mockDbAcademics, teacherSession, {
          academicSessionId: SESSION_UUID,
          classId: CLASS_UUID,
          subjectId: '18000000-0000-4000-8000-000000000099',
        })
      )?.status
    ).toBe(403);
    expect(
      (
        await assertCanMarkDailyAttendance(
          mockDbAcademics,
          { roles: ['TEACHER'], profiles: { teacherProfileId: inactiveTeacherId } },
          { academicSessionId: SESSION_UUID, classId: CLASS_UUID }
        )
      )?.status
    ).toBe(403);
  });

  it('enforces assertCanReadStudentAttendance including fail-closed when DB_STUDENTS is missing or throws', async () => {
    const mockDbStudents = {
      prepare: () => ({
        bind: (parentProfileId, studentId) => ({
          first: async () => {
            if (parentProfileId === PARENT_UUID && studentId === STUDENT_UUID) {
              return { ok: 1 };
            }
            return null;
          },
        }),
      }),
    };

    const failingDbStudents = {
      prepare: () => {
        throw new Error('DB_STUDENTS unavailable');
      },
    };

    // Admin allowed
    expect(
      await assertCanReadStudentAttendance(null, { roles: ['SUPER_ADMIN'] }, STUDENT_UUID)
    ).toBeNull();
    expect(
      await assertCanReadStudentAttendance(null, { roles: ['COACHING_ADMIN'] }, STUDENT_UUID)
    ).toBeNull();

    // Student own vs other
    expect(
      await assertCanReadStudentAttendance(
        null,
        { roles: ['STUDENT'], profiles: { studentId: STUDENT_UUID } },
        STUDENT_UUID
      )
    ).toBeNull();
    expect(
      (
        await assertCanReadStudentAttendance(
          null,
          { roles: ['STUDENT'], profiles: { studentId: STUDENT_UUID } },
          OTHER_STUDENT_UUID
        )
      )?.status
    ).toBe(403);

    // Parent verified child vs unlinked child vs missing/failing DB_STUDENTS
    const parentSession = { roles: ['PARENT'], profiles: { parentProfileId: PARENT_UUID } };
    expect(
      await assertCanReadStudentAttendance(mockDbStudents, parentSession, STUDENT_UUID)
    ).toBeNull();
    expect(
      (
        await assertCanReadStudentAttendance(mockDbStudents, parentSession, OTHER_STUDENT_UUID)
      )?.status
    ).toBe(403);
    expect(
      (await assertCanReadStudentAttendance(null, parentSession, STUDENT_UUID))?.status
    ).toBe(403);
    expect(
      (
        await assertCanReadStudentAttendance(failingDbStudents, parentSession, STUDENT_UUID)
      )?.status
    ).toBe(403);

    // Teacher or empty role denied
    expect(
      (await assertCanReadStudentAttendance(mockDbStudents, { roles: ['TEACHER'] }, STUDENT_UUID))
        ?.status
    ).toBe(403);
    expect(
      (await assertCanReadStudentAttendance(mockDbStudents, { roles: [] }, STUDENT_UUID))?.status
    ).toBe(403);
  });
});
