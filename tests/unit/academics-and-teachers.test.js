import { describe, expect, it } from 'vitest';
import {
  assertCanManageAcademics,
  assertCanReadAcademics,
} from '@/modules/academics/academics.permissions';
import {
  assignClassSubjectSchema,
  createAcademicSessionSchema,
  createClassSchema,
  createSubjectSchema,
  deleteClassSubjectQuerySchema,
  listAcademicSessionsQuerySchema,
  updateAcademicSessionSchema,
  updateClassSchema,
  updateSubjectSchema,
} from '@/modules/academics/academics.schemas';
import {
  assertCanManageTeachers,
  assertCanReadTeacherProfile,
  assertTeacherAssignedToClass,
  assertTeacherAssignedToClassSubject,
  getTeacherAssignmentsForSession,
} from '@/modules/teachers/teachers.permissions';
import {
  createTeacherAssignmentSchema,
  createTeacherSchema,
  listTeacherAssignmentsQuerySchema,
  TEACHER_EMPLOYMENT_STATUSES,
  TEACHER_RESPONSIBILITY_CATEGORIES,
  updateTeacherSchema,
} from '@/modules/teachers/teachers.schemas';

const UUID_1 = '16000000-0000-4000-8000-000000000001';
const UUID_2 = '17000000-0000-4000-8000-000000000002';
const UUID_3 = '18000000-0000-4000-8000-000000000003';
const UUID_4 = '1b000000-0000-4000-8000-000000000001';

describe('Academics & Teachers Zod Schemas', () => {
  it('validates academic_sessions date ordering, defaults, and update constraints', () => {
    const validEqualDates = createAcademicSessionSchema.safeParse({
      name: '2027-2028',
      startDate: '2027-04-01',
      endDate: '2027-04-01',
    });
    expect(validEqualDates.success).toBe(true);
    expect(validEqualDates.data?.isActive).toBe(false);

    const invalidDateOrder = createAcademicSessionSchema.safeParse({
      name: '2027-2028',
      startDate: '2027-04-01',
      endDate: '2027-03-31',
    });
    expect(invalidDateOrder.success).toBe(false);

    const emptyUpdate = updateAcademicSessionSchema.safeParse({});
    expect(emptyUpdate.success).toBe(false);

    const badUpdateDates = updateAcademicSessionSchema.safeParse({
      startDate: '2027-05-01',
      endDate: '2027-04-01',
    });
    expect(badUpdateDates.success).toBe(false);

    const queryParsed = listAcademicSessionsQuerySchema.safeParse({
      page: '2',
      pageSize: '10',
      isActive: 'true',
    });
    expect(queryParsed.success).toBe(true);
    expect(queryParsed.data?.isActive).toBe(true);
  });

  it('validates classes, class-subjects, and subjects schemas', () => {
    const cls = createClassSchema.safeParse({
      name: 'Class 12',
      gradeLevel: '12',
      section: '',
    });
    expect(cls.success).toBe(true);
    expect(cls.data?.gradeLevel).toBe(12);
    expect(cls.data?.section).toBeNull();

    expect(
      createClassSchema.safeParse({ name: 'Class 0', gradeLevel: 0 }).success
    ).toBe(false);
    expect(updateClassSchema.safeParse({}).success).toBe(false);

    expect(
      assignClassSubjectSchema.safeParse({
        academicSessionId: UUID_1,
        subjectId: UUID_3,
      }).success
    ).toBe(true);
    expect(
      deleteClassSubjectQuerySchema.safeParse({ academicSessionId: 'not-a-uuid' }).success
    ).toBe(false);

    const subj = createSubjectSchema.safeParse({
      name: 'Physics',
      code: 'phy-11',
    });
    expect(subj.success).toBe(true);
    expect(subj.data?.code).toBe('PHY-11');

    const subjUpd = updateSubjectSchema.safeParse({ code: 'chem-11' });
    expect(subjUpd.success).toBe(true);
    expect(subjUpd.data?.code).toBe('CHEM-11');
    expect(updateSubjectSchema.safeParse({}).success).toBe(false);
  });

  it('validates teacher_profiles and teacher_assignments responsibility categories', () => {
    expect(TEACHER_EMPLOYMENT_STATUSES).toEqual(['ACTIVE', 'INACTIVE', 'LEFT']);
    expect(TEACHER_RESPONSIBILITY_CATEGORIES).toEqual(['REGULAR_TEACHER', 'CLASS_TEACHER']);

    const teacher = createTeacherSchema.safeParse({
      userId: UUID_1,
      employeeCode: 'TCH-100',
      fullName: 'Anita Roy',
      joiningDate: '2026-04-01',
    });
    expect(teacher.success).toBe(true);
    expect(teacher.data?.employmentStatus).toBe('ACTIVE');

    expect(
      createTeacherSchema.safeParse({
        userId: UUID_1,
        employeeCode: 'TCH-100',
        fullName: 'Anita Roy',
        joiningDate: '2026-04-01',
        employmentStatus: 'RETIRED',
      }).success
    ).toBe(false);

    expect(updateTeacherSchema.safeParse({}).success).toBe(false);

    const assignRegular = createTeacherAssignmentSchema.safeParse({
      teacherProfileId: UUID_4,
      academicSessionId: UUID_1,
      classId: UUID_2,
      subjectId: UUID_3,
      responsibilityCategory: 'REGULAR_TEACHER',
    });
    expect(assignRegular.success).toBe(true);

    const assignClassTeacher = createTeacherAssignmentSchema.safeParse({
      teacherProfileId: UUID_4,
      academicSessionId: UUID_1,
      classId: UUID_2,
      subjectId: UUID_3,
      responsibilityCategory: 'CLASS_TEACHER',
    });
    expect(assignClassTeacher.success).toBe(true);

    const invalidCategory = createTeacherAssignmentSchema.safeParse({
      teacherProfileId: UUID_4,
      academicSessionId: UUID_1,
      classId: UUID_2,
      subjectId: UUID_3,
      responsibilityCategory: 'HOD',
    });
    expect(invalidCategory.success).toBe(false);

    expect(
      listTeacherAssignmentsQuerySchema.safeParse({
        responsibilityCategory: 'CLASS_TEACHER',
      }).success
    ).toBe(true);
  });
});

describe('Academics & Teachers Permissions', () => {
  it('enforces assertCanManageAcademics and assertCanReadAcademics', () => {
    expect(assertCanManageAcademics({ roles: ['SUPER_ADMIN'] })).toBeNull();
    expect(assertCanManageAcademics({ roles: ['COACHING_ADMIN'] })).toBeNull();
    expect(assertCanManageAcademics({ roles: ['TEACHER'] })?.status).toBe(403);
    expect(assertCanManageAcademics({ roles: ['PARENT'] })?.status).toBe(403);
    expect(assertCanManageAcademics({ roles: ['STUDENT'] })?.status).toBe(403);

    expect(assertCanReadAcademics({ roles: ['TEACHER'] })).toBeNull();
    expect(assertCanReadAcademics({ roles: ['PARENT'] })).toBeNull();
    expect(assertCanReadAcademics({ roles: ['STUDENT'] })).toBeNull();
    expect(assertCanReadAcademics({ roles: [] })?.status).toBe(403);
  });

  it('enforces assertCanManageTeachers and assertCanReadTeacherProfile', () => {
    expect(assertCanManageTeachers({ roles: ['SUPER_ADMIN'] })).toBeNull();
    expect(assertCanManageTeachers({ roles: ['COACHING_ADMIN'] })).toBeNull();
    expect(assertCanManageTeachers({ roles: ['TEACHER'] })?.status).toBe(403);
    expect(assertCanManageTeachers({ roles: ['STUDENT'] })?.status).toBe(403);

    expect(assertCanReadTeacherProfile({ roles: ['SUPER_ADMIN'] }, UUID_4)).toBeNull();
    expect(assertCanReadTeacherProfile({ roles: ['COACHING_ADMIN'] }, UUID_4)).toBeNull();
    expect(
      assertCanReadTeacherProfile(
        { roles: ['TEACHER'], profiles: { teacherProfileId: UUID_4 } },
        UUID_4
      )
    ).toBeNull();
    expect(
      assertCanReadTeacherProfile(
        { roles: ['TEACHER'], profiles: { teacherProfileId: UUID_4 } },
        UUID_1
      )?.status
    ).toBe(403);
    expect(assertCanReadTeacherProfile({ roles: ['PARENT'] }, UUID_4)?.status).toBe(403);
    expect(assertCanReadTeacherProfile({ roles: ['STUDENT'] }, UUID_4)?.status).toBe(403);
  });

  it('enforces assertTeacherAssignedToClass and assertTeacherAssignedToClassSubject including inactive and unassigned denials', async () => {
    const activeTeacherId = UUID_4;
    const inactiveTeacherId = '1b000000-0000-4000-8000-000000000099';

    // Mock D1 that mirrors the SQL predicate `tp.employment_status = 'ACTIVE'`
    const mockDb = {
      prepare: (sql) => ({
        bind: (...args) => ({
          first: async () => {
            const [teacherId, sessionId, classId, subjectId] = args;
            if (teacherId !== activeTeacherId) return null; // INACTIVE or other teacher
            if (sessionId !== UUID_1 || classId !== UUID_2) return null;
            if (sql.includes('ta.subject_id = ?') && subjectId !== UUID_3) return null;
            return { ok: 1 };
          },
          all: async () => {
            const [teacherId, sessionId] = args;
            if (teacherId === activeTeacherId && sessionId === UUID_1) {
              return {
                results: [
                  {
                    id: 'assign-1',
                    teacherProfileId: activeTeacherId,
                    academicSessionId: UUID_1,
                    classId: UUID_2,
                    subjectId: UUID_3,
                    responsibilityCategory: 'CLASS_TEACHER',
                  },
                ],
              };
            }
            return { results: [] };
          },
        }),
      }),
    };

    // Admins bypass assignment check
    expect(
      await assertTeacherAssignedToClass(
        mockDb,
        { roles: ['COACHING_ADMIN'] },
        { academicSessionId: UUID_1, classId: UUID_2 }
      )
    ).toBeNull();
    expect(
      await assertTeacherAssignedToClassSubject(
        mockDb,
        { roles: ['SUPER_ADMIN'] },
        { academicSessionId: UUID_1, classId: UUID_2, subjectId: UUID_3 }
      )
    ).toBeNull();

    // Active assigned teacher allowed
    const activeSession = { roles: ['TEACHER'], profiles: { teacherProfileId: activeTeacherId } };
    expect(
      await assertTeacherAssignedToClass(mockDb, activeSession, {
        academicSessionId: UUID_1,
        classId: UUID_2,
      })
    ).toBeNull();
    expect(
      await assertTeacherAssignedToClassSubject(mockDb, activeSession, {
        academicSessionId: UUID_1,
        classId: UUID_2,
        subjectId: UUID_3,
      })
    ).toBeNull();

    // Unassigned class or subject denied (403)
    expect(
      (
        await assertTeacherAssignedToClass(mockDb, activeSession, {
          academicSessionId: UUID_1,
          classId: UUID_3,
        })
      )?.status
    ).toBe(403);
    expect(
      (
        await assertTeacherAssignedToClassSubject(mockDb, activeSession, {
          academicSessionId: UUID_1,
          classId: UUID_2,
          subjectId: UUID_1,
        })
      )?.status
    ).toBe(403);

    // Inactive teacher denied (403)
    const inactiveSession = {
      roles: ['TEACHER'],
      profiles: { teacherProfileId: inactiveTeacherId },
    };
    expect(
      (
        await assertTeacherAssignedToClass(mockDb, inactiveSession, {
          academicSessionId: UUID_1,
          classId: UUID_2,
        })
      )?.status
    ).toBe(403);
    expect(
      (
        await assertTeacherAssignedToClassSubject(mockDb, inactiveSession, {
          academicSessionId: UUID_1,
          classId: UUID_2,
          subjectId: UUID_3,
        })
      )?.status
    ).toBe(403);

    // Student / Parent denied (403)
    expect(
      (
        await assertTeacherAssignedToClass(
          mockDb,
          { roles: ['STUDENT'] },
          { academicSessionId: UUID_1, classId: UUID_2 }
        )
      )?.status
    ).toBe(403);

    // getTeacherAssignmentsForSession
    expect(await getTeacherAssignmentsForSession(mockDb, activeTeacherId, UUID_1)).toHaveLength(1);
    expect(await getTeacherAssignmentsForSession(mockDb, inactiveTeacherId, UUID_1)).toEqual([]);
    expect(await getTeacherAssignmentsForSession(mockDb, '', UUID_1)).toEqual([]);
  });
});
