import { getClientIp, requireAuth, requireRole } from '@/lib/auth/session';
import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonError, jsonOk, jsonPaginated } from '@/lib/http/response';
import { formatZodIssues, parseJsonBody } from '@/lib/validation/common';
import {
  assertCanAccessClassPerformance,
  assertCanAccessClassSubjectPerformance,
  assertCanReadStudentPerformance,
} from '@/modules/performance/performance.permissions';
import {
  createPerformanceRecordSchema,
  listPerformanceRecordsQuerySchema,
} from '@/modules/performance/performance.schemas';
import {
  createPerformanceRecordService,
  listPerformanceRecordsService,
  PerformanceServiceError,
} from '@/modules/performance/performance.service';

export async function GET(request) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const sp = new URL(request.url).searchParams;
  const parsedQuery = listPerformanceRecordsQuerySchema.safeParse({
    page: sp.get('page') ?? undefined,
    pageSize: sp.get('pageSize') ?? undefined,
    enrollmentId: sp.get('enrollmentId') ?? undefined,
    studentId: sp.get('studentId') ?? undefined,
    teacherProfileId: sp.get('teacherProfileId') ?? undefined,
    subjectId: sp.get('subjectId') ?? undefined,
    category: sp.get('category') ?? undefined,
    fromDate: sp.get('fromDate') ?? undefined,
    toDate: sp.get('toDate') ?? undefined,
  });
  if (!parsedQuery.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid performance records list query parameters.', {
      status: 400,
      details: formatZodIssues(parsedQuery.error),
      requestId,
    });
  }

  const roles = Array.isArray(auth.session?.roles) ? auth.session.roles : [];
  const isAdmin = roles.includes('SUPER_ADMIN') || roles.includes('COACHING_ADMIN');
  const isTeacher = roles.includes('TEACHER');

  let effectiveQuery = parsedQuery.data;

  if (!isAdmin) {
    if (isTeacher && auth.session?.profiles?.teacherProfileId) {
      const ownTeacherId = auth.session.profiles.teacherProfileId;
      if (parsedQuery.data.teacherProfileId && parsedQuery.data.teacherProfileId !== ownTeacherId) {
        return jsonError(
          'FORBIDDEN',
          'Teachers can only list performance records they created.',
          { status: 403, requestId }
        );
      }
      effectiveQuery = { ...parsedQuery.data, teacherProfileId: ownTeacherId };
    } else if (parsedQuery.data.studentId) {
      const dbStudents = auth.workerEnv?.[D1_BINDINGS.STUDENTS] ?? null;
      const permissionError = await assertCanReadStudentPerformance(
        dbStudents,
        auth.session,
        parsedQuery.data.studentId,
        requestId
      );
      if (permissionError) return permissionError;
    } else {
      return jsonError(
        'FORBIDDEN',
        'You do not have permission to list these performance records.',
        { status: 403, requestId }
      );
    }
  }

  try {
    const dbPerformance = getDomainDb(auth.workerEnv, D1_BINDINGS.PERFORMANCE);
    const { records, total } = await listPerformanceRecordsService(
      dbPerformance,
      auth.workerEnv,
      effectiveQuery
    );
    return jsonPaginated(
      records,
      { page: effectiveQuery.page, pageSize: effectiveQuery.pageSize, total },
      { requestId }
    );
  } catch (error) {
    if (error instanceof PerformanceServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('PERFORMANCE_RECORDS_LIST_FAILED', 'Unable to list performance records.', {
      status: 500,
      requestId,
    });
  }
}

export async function POST(request) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const csrfError = assertSameOrigin(request, { workerEnv: auth.workerEnv, requestId });
  if (csrfError) return csrfError;

  const roleError = requireRole(
    auth.session,
    ['SUPER_ADMIN', 'COACHING_ADMIN', 'TEACHER'],
    requestId
  );
  if (roleError) return roleError;

  const parsed = await parseJsonBody(request, createPerformanceRecordSchema, requestId);
  if (!parsed.ok) return parsed.response;

  try {
    const dbStudents = getDomainDb(auth.workerEnv, D1_BINDINGS.STUDENTS);
    const enrollment = await dbStudents
      .prepare(
        `SELECT id, academic_session_id, class_id
         FROM enrollments
         WHERE id = ?
         LIMIT 1`
      )
      .bind(parsed.data.enrollmentId)
      .first();

    if (!enrollment) {
      return jsonError('VALIDATION_ERROR', 'Referenced enrollment does not exist.', {
        status: 400,
        requestId,
      });
    }

    const dbAcademics = auth.workerEnv?.[D1_BINDINGS.ACADEMICS] ?? null;
    const permissionError = parsed.data.subjectId
      ? await assertCanAccessClassSubjectPerformance(
          dbAcademics,
          auth.session,
          {
            academicSessionId: enrollment.academic_session_id,
            classId: enrollment.class_id,
            subjectId: parsed.data.subjectId,
          },
          requestId
        )
      : await assertCanAccessClassPerformance(
          dbAcademics,
          auth.session,
          {
            academicSessionId: enrollment.academic_session_id,
            classId: enrollment.class_id,
          },
          requestId
        );
    if (permissionError) return permissionError;

    const dbPerformance = getDomainDb(auth.workerEnv, D1_BINDINGS.PERFORMANCE);
    const created = await createPerformanceRecordService(
      dbPerformance,
      auth.workerEnv,
      auth.session,
      parsed.data,
      {
        clientIp: getClientIp(request),
        requestId,
      }
    );
    return jsonOk(created, { status: 201, requestId });
  } catch (error) {
    if (error instanceof PerformanceServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('PERFORMANCE_RECORD_CREATE_FAILED', 'Unable to create performance record.', {
      status: 500,
      requestId,
    });
  }
}
