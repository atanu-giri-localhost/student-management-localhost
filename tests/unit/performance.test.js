import { describe, expect, it } from 'vitest';
import {
  assertCanAccessClassPerformance,
  assertCanAccessClassSubjectPerformance,
  assertCanManagePerformance,
  assertCanReadStudentPerformance,
} from '@/modules/performance/performance.permissions';
import {
  classResultsQuerySchema,
  createExaminationSchema,
  createExamSubjectSchema,
  createGradingScaleSchema,
  createPerformanceRecordSchema,
  EXAM_TYPES,
  PERFORMANCE_CATEGORIES,
  recordExamMarkSchema,
  studentResultsQuerySchema,
  updateExaminationSchema,
  updateExamMarkSchema,
  updateExamSubjectSchema,
  updateGradingScaleSchema,
} from '@/modules/performance/performance.schemas';

const SESSION_UUID = '16000000-0000-4000-8000-000000000002';
const CLASS_UUID = '17000000-0000-4000-8000-000000000002';
const SUBJECT_UUID = '18000000-0000-4000-8000-000000000001';
const EXAM_UUID = '22000000-0000-4000-8000-000000000001';
const EXAM_SUBJECT_UUID = '23000000-0000-4000-8000-000000000001';
const ENROLLMENT_UUID = '1a000000-0000-4000-8000-000000000002';
const TEACHER_UUID = '1b000000-0000-4000-8000-000000000001';
const STUDENT_UUID = '14000000-0000-4000-8000-000000000001';
const OTHER_STUDENT_UUID = '14000000-0000-4000-8000-000000000003';
const PARENT_UUID = '13000000-0000-4000-8000-000000000001';

describe('Performance Zod Schemas', () => {
  it('defines canonical EXAM_TYPES and PERFORMANCE_CATEGORIES', () => {
    expect(EXAM_TYPES).toEqual(['UNIT_TEST', 'MONTHLY_TEST', 'HALF_YEARLY', 'FINAL']);
    expect(PERFORMANCE_CATEGORIES).toEqual(['CLASS_TEST', 'HOMEWORK', 'CLASSWORK', 'GENERAL']);
  });

  it('validates createExaminationSchema and updateExaminationSchema', () => {
    const valid = createExaminationSchema.safeParse({
      academicSessionId: SESSION_UUID,
      name: '  Mid Term 2026  ',
      examType: 'HALF_YEARLY',
      startDate: '2026-10-10',
      endDate: '2026-10-15',
    });
    expect(valid.success).toBe(true);
    expect(valid.data?.name).toBe('Mid Term 2026');
    expect(valid.data?.isPublished).toBe(false);

    // Same-day exam allowed
    expect(
      createExaminationSchema.safeParse({
        academicSessionId: SESSION_UUID,
        name: 'Single Day Test',
        examType: 'UNIT_TEST',
        startDate: '2026-10-10',
        endDate: '2026-10-10',
        isPublished: true,
      }).success
    ).toBe(true);

    // endDate before startDate rejected
    expect(
      createExaminationSchema.safeParse({
        academicSessionId: SESSION_UUID,
        name: 'Invalid Range',
        examType: 'UNIT_TEST',
        startDate: '2026-10-15',
        endDate: '2026-10-10',
      }).success
    ).toBe(false);

    // Invalid examType or strict extra field rejected
    expect(
      createExaminationSchema.safeParse({
        academicSessionId: SESSION_UUID,
        name: 'Bad Type',
        examType: 'SURPRISE_QUIZ',
        startDate: '2026-10-10',
        endDate: '2026-10-12',
      }).success
    ).toBe(false);
    expect(
      createExaminationSchema.safeParse({
        academicSessionId: SESSION_UUID,
        name: 'Extra',
        examType: 'FINAL',
        startDate: '2026-10-10',
        endDate: '2026-10-12',
        extra: true,
      }).success
    ).toBe(false);

    // Empty updateExaminationSchema rejected
    expect(updateExaminationSchema.safeParse({}).success).toBe(false);
    expect(updateExaminationSchema.safeParse({ isPublished: true }).success).toBe(true);
  });

  it('validates createExamSubjectSchema and updateExamSubjectSchema', () => {
    const valid = createExamSubjectSchema.safeParse({
      examinationId: EXAM_UUID,
      classId: CLASS_UUID,
      subjectId: SUBJECT_UUID,
      examDate: '2026-10-10',
      maxMarks: '100',
      passingMarks: '35',
    });
    expect(valid.success).toBe(true);
    expect(valid.data?.maxMarks).toBe(100);
    expect(valid.data?.passingMarks).toBe(35);

    // passingMarks > maxMarks rejected
    expect(
      createExamSubjectSchema.safeParse({
        examinationId: EXAM_UUID,
        classId: CLASS_UUID,
        subjectId: SUBJECT_UUID,
        examDate: '2026-10-10',
        maxMarks: 50,
        passingMarks: 51,
      }).success
    ).toBe(false);

    // maxMarks <= 0 or negative passingMarks rejected
    expect(
      createExamSubjectSchema.safeParse({
        examinationId: EXAM_UUID,
        classId: CLASS_UUID,
        subjectId: SUBJECT_UUID,
        examDate: '2026-10-10',
        maxMarks: 0,
        passingMarks: 0,
      }).success
    ).toBe(false);
    expect(
      createExamSubjectSchema.safeParse({
        examinationId: EXAM_UUID,
        classId: CLASS_UUID,
        subjectId: SUBJECT_UUID,
        examDate: '2026-10-10',
        maxMarks: 50,
        passingMarks: -1,
      }).success
    ).toBe(false);

    expect(updateExamSubjectSchema.safeParse({}).success).toBe(false);
    expect(
      updateExamSubjectSchema.safeParse({ maxMarks: 80, passingMarks: 85 }).success
    ).toBe(false);
    expect(
      updateExamSubjectSchema.safeParse({ maxMarks: 80, passingMarks: 30 }).success
    ).toBe(true);
  });

  it('validates recordExamMarkSchema absent vs numeric rules', () => {
    // Valid numeric mark (default isAbsent = false)
    const numeric = recordExamMarkSchema.safeParse({
      examSubjectId: EXAM_SUBJECT_UUID,
      enrollmentId: ENROLLMENT_UUID,
      marksObtained: '42.5',
      remarks: '  Good work  ',
    });
    expect(numeric.success).toBe(true);
    expect(numeric.data?.isAbsent).toBe(false);
    expect(numeric.data?.marksObtained).toBe(42.5);
    expect(numeric.data?.remarks).toBe('Good work');

    // Valid absent with null marksObtained
    const absentNull = recordExamMarkSchema.safeParse({
      examSubjectId: EXAM_SUBJECT_UUID,
      enrollmentId: ENROLLMENT_UUID,
      isAbsent: true,
      marksObtained: null,
    });
    expect(absentNull.success).toBe(true);
    expect(absentNull.data?.isAbsent).toBe(true);
    expect(absentNull.data?.marksObtained).toBeNull();

    // Valid absent with omitted marksObtained
    expect(
      recordExamMarkSchema.safeParse({
        examSubjectId: EXAM_SUBJECT_UUID,
        enrollmentId: ENROLLMENT_UUID,
        isAbsent: true,
      }).success
    ).toBe(true);

    // Invalid: isAbsent = true with numeric marksObtained
    expect(
      recordExamMarkSchema.safeParse({
        examSubjectId: EXAM_SUBJECT_UUID,
        enrollmentId: ENROLLMENT_UUID,
        isAbsent: true,
        marksObtained: 10,
      }).success
    ).toBe(false);

    // Invalid: isAbsent = true with 0 marksObtained
    expect(
      recordExamMarkSchema.safeParse({
        examSubjectId: EXAM_SUBJECT_UUID,
        enrollmentId: ENROLLMENT_UUID,
        isAbsent: true,
        marksObtained: 0,
      }).success
    ).toBe(false);

    // Invalid: isAbsent = false with null or missing marksObtained
    expect(
      recordExamMarkSchema.safeParse({
        examSubjectId: EXAM_SUBJECT_UUID,
        enrollmentId: ENROLLMENT_UUID,
        isAbsent: false,
        marksObtained: null,
      }).success
    ).toBe(false);
    expect(
      recordExamMarkSchema.safeParse({
        examSubjectId: EXAM_SUBJECT_UUID,
        enrollmentId: ENROLLMENT_UUID,
      }).success
    ).toBe(false);

    // Invalid: negative marksObtained
    expect(
      recordExamMarkSchema.safeParse({
        examSubjectId: EXAM_SUBJECT_UUID,
        enrollmentId: ENROLLMENT_UUID,
        marksObtained: -2,
      }).success
    ).toBe(false);

    // updateExamMarkSchema
    expect(updateExamMarkSchema.safeParse({}).success).toBe(false);
    expect(
      updateExamMarkSchema.safeParse({ isAbsent: true, marksObtained: 20 }).success
    ).toBe(false);
    expect(
      updateExamMarkSchema.safeParse({ isAbsent: true, marksObtained: null }).success
    ).toBe(true);
  });

  it('validates createGradingScaleSchema and updateGradingScaleSchema', () => {
    const valid = createGradingScaleSchema.safeParse({
      academicSessionId: SESSION_UUID,
      name: 'Standard 2026',
      gradeLabel: 'A+',
      minPercentage: 90,
      maxPercentage: 100,
      gradePoint: 10,
      effectiveFrom: '2026-04-01',
    });
    expect(valid.success).toBe(true);
    expect(valid.data?.isPassing).toBe(true);
    expect(valid.data?.isActive).toBe(true);

    // Global scale (null academicSessionId)
    expect(
      createGradingScaleSchema.safeParse({
        academicSessionId: null,
        name: 'Global Scale',
        gradeLabel: 'F',
        minPercentage: 0,
        maxPercentage: 34.99,
        gradePoint: 0,
        isPassing: false,
        effectiveFrom: '2026-04-01',
      }).success
    ).toBe(true);

    // minPercentage > maxPercentage rejected
    expect(
      createGradingScaleSchema.safeParse({
        name: 'Bad Range',
        gradeLabel: 'B',
        minPercentage: 80,
        maxPercentage: 60,
        effectiveFrom: '2026-04-01',
      }).success
    ).toBe(false);

    // Out-of-bounds percentage (>100 or <0) rejected
    expect(
      createGradingScaleSchema.safeParse({
        name: 'Over 100',
        gradeLabel: 'S',
        minPercentage: 90,
        maxPercentage: 105,
        effectiveFrom: '2026-04-01',
      }).success
    ).toBe(false);
    expect(
      createGradingScaleSchema.safeParse({
        name: 'Under 0',
        gradeLabel: 'Z',
        minPercentage: -1,
        maxPercentage: 10,
        effectiveFrom: '2026-04-01',
      }).success
    ).toBe(false);

    expect(updateGradingScaleSchema.safeParse({}).success).toBe(false);
    expect(
      updateGradingScaleSchema.safeParse({ minPercentage: 70, maxPercentage: 50 }).success
    ).toBe(false);
  });

  it('validates createPerformanceRecordSchema and results query schemas', () => {
    expect(
      createPerformanceRecordSchema.safeParse({
        enrollmentId: ENROLLMENT_UUID,
        subjectId: SUBJECT_UUID,
        evaluationDate: '2026-11-24',
        category: 'CLASS_TEST',
        marksObtained: 18,
        maxMarks: 20,
        remarks: 'Good progress',
      }).success
    ).toBe(true);

    expect(
      createPerformanceRecordSchema.safeParse({
        enrollmentId: ENROLLMENT_UUID,
        evaluationDate: '2026-11-24',
        category: 'CLASS_TEST',
        marksObtained: 25,
        maxMarks: 20,
        remarks: 'Exceeds max',
      }).success
    ).toBe(false);

    expect(studentResultsQuerySchema.safeParse({}).success).toBe(true);
    expect(
      classResultsQuerySchema.safeParse({
        examinationId: EXAM_UUID,
        classId: CLASS_UUID,
      }).success
    ).toBe(true);
    expect(classResultsQuerySchema.safeParse({ examinationId: EXAM_UUID }).success).toBe(false);
  });
});

describe('Performance Permissions', () => {
  it('enforces assertCanManagePerformance for admin roles only', () => {
    expect(assertCanManagePerformance({ roles: ['SUPER_ADMIN'] })).toBeNull();
    expect(assertCanManagePerformance({ roles: ['COACHING_ADMIN'] })).toBeNull();
    expect(assertCanManagePerformance({ roles: ['TEACHER'] })?.status).toBe(403);
    expect(assertCanManagePerformance({ roles: ['STUDENT'] })?.status).toBe(403);
    expect(assertCanManagePerformance({ roles: ['PARENT'] })?.status).toBe(403);
    expect(assertCanManagePerformance({ roles: [] })?.status).toBe(403);
  });

  it('enforces assertCanAccessClassSubjectPerformance and assertCanAccessClassPerformance with fail-closed DB checks', async () => {
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
        throw new Error('DB_ACADEMICS unavailable');
      },
    };

    const teacherSession = {
      roles: ['TEACHER'],
      profiles: { teacherProfileId: activeTeacherId },
    };

    // Admins bypass DB_ACADEMICS lookup
    expect(
      await assertCanAccessClassSubjectPerformance(
        null,
        { roles: ['SUPER_ADMIN'] },
        { academicSessionId: SESSION_UUID, classId: CLASS_UUID, subjectId: SUBJECT_UUID }
      )
    ).toBeNull();
    expect(
      await assertCanAccessClassPerformance(
        null,
        { roles: ['COACHING_ADMIN'] },
        { academicSessionId: SESSION_UUID, classId: CLASS_UUID }
      )
    ).toBeNull();

    // Fail closed when dbAcademics is null or throws
    expect(
      (
        await assertCanAccessClassSubjectPerformance(null, teacherSession, {
          academicSessionId: SESSION_UUID,
          classId: CLASS_UUID,
          subjectId: SUBJECT_UUID,
        })
      )?.status
    ).toBe(403);
    expect(
      (
        await assertCanAccessClassPerformance(null, teacherSession, {
          academicSessionId: SESSION_UUID,
          classId: CLASS_UUID,
        })
      )?.status
    ).toBe(403);
    expect(
      (
        await assertCanAccessClassSubjectPerformance(failingDbAcademics, teacherSession, {
          academicSessionId: SESSION_UUID,
          classId: CLASS_UUID,
          subjectId: SUBJECT_UUID,
        })
      )?.status
    ).toBe(403);
    expect(
      (
        await assertCanAccessClassPerformance(failingDbAcademics, teacherSession, {
          academicSessionId: SESSION_UUID,
          classId: CLASS_UUID,
        })
      )?.status
    ).toBe(403);

    // Assigned active teacher succeeds
    expect(
      await assertCanAccessClassSubjectPerformance(mockDbAcademics, teacherSession, {
        academicSessionId: SESSION_UUID,
        classId: CLASS_UUID,
        subjectId: SUBJECT_UUID,
      })
    ).toBeNull();
    expect(
      await assertCanAccessClassPerformance(mockDbAcademics, teacherSession, {
        academicSessionId: SESSION_UUID,
        classId: CLASS_UUID,
      })
    ).toBeNull();

    // Unassigned class/subject or inactive teacher fails with 403
    expect(
      (
        await assertCanAccessClassSubjectPerformance(mockDbAcademics, teacherSession, {
          academicSessionId: SESSION_UUID,
          classId: CLASS_UUID,
          subjectId: '18000000-0000-4000-8000-000000000099',
        })
      )?.status
    ).toBe(403);
    expect(
      (
        await assertCanAccessClassPerformance(mockDbAcademics, teacherSession, {
          academicSessionId: SESSION_UUID,
          classId: '17000000-0000-4000-8000-000000000003',
        })
      )?.status
    ).toBe(403);
    expect(
      (
        await assertCanAccessClassPerformance(
          mockDbAcademics,
          { roles: ['TEACHER'], profiles: { teacherProfileId: inactiveTeacherId } },
          { academicSessionId: SESSION_UUID, classId: CLASS_UUID }
        )
      )?.status
    ).toBe(403);
  });

  it('enforces assertCanReadStudentPerformance including fail-closed when DB_STUDENTS is missing or throws', async () => {
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
      await assertCanReadStudentPerformance(null, { roles: ['SUPER_ADMIN'] }, STUDENT_UUID)
    ).toBeNull();
    expect(
      await assertCanReadStudentPerformance(null, { roles: ['COACHING_ADMIN'] }, STUDENT_UUID)
    ).toBeNull();

    // Student own vs other
    expect(
      await assertCanReadStudentPerformance(
        null,
        { roles: ['STUDENT'], profiles: { studentId: STUDENT_UUID } },
        STUDENT_UUID
      )
    ).toBeNull();
    expect(
      (
        await assertCanReadStudentPerformance(
          null,
          { roles: ['STUDENT'], profiles: { studentId: STUDENT_UUID } },
          OTHER_STUDENT_UUID
        )
      )?.status
    ).toBe(403);

    // Parent verified child vs unlinked child vs missing/failing DB_STUDENTS
    const parentSession = { roles: ['PARENT'], profiles: { parentProfileId: PARENT_UUID } };
    expect(
      await assertCanReadStudentPerformance(mockDbStudents, parentSession, STUDENT_UUID)
    ).toBeNull();
    expect(
      (
        await assertCanReadStudentPerformance(mockDbStudents, parentSession, OTHER_STUDENT_UUID)
      )?.status
    ).toBe(403);
    expect(
      (await assertCanReadStudentPerformance(null, parentSession, STUDENT_UUID))?.status
    ).toBe(403);
    expect(
      (
        await assertCanReadStudentPerformance(failingDbStudents, parentSession, STUDENT_UUID)
      )?.status
    ).toBe(403);

    // Teacher or empty role denied
    expect(
      (await assertCanReadStudentPerformance(mockDbStudents, { roles: ['TEACHER'] }, STUDENT_UUID))
        ?.status
    ).toBe(403);
    expect(
      (await assertCanReadStudentPerformance(mockDbStudents, { roles: [] }, STUDENT_UUID))?.status
    ).toBe(403);
  });
});
