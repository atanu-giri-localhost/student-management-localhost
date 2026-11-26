import { requireAuth, requireRole } from '@/lib/auth/session';
import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { createRequestId, jsonError, jsonPaginated } from '@/lib/http/response';
import { formatZodIssues } from '@/lib/validation/common';
import { classIdSchema, teacherRosterQuerySchema } from '@/modules/teachers/teachers.schemas';
import {
  getTeacherClassRosterService,
  TeachersServiceError,
} from '@/modules/teachers/teachers.service';

export async function GET(request, context) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const roleError = requireRole(auth.session, ['TEACHER'], requestId);
  if (roleError) return roleError;

  const params = await context?.params;
  const parsedClassId = classIdSchema.safeParse(params?.classId);
  if (!parsedClassId.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid class ID.', { status: 400, requestId });
  }

  const url = new URL(request.url);
  const rawQuery = {
    page: url.searchParams.get('page') ?? undefined,
    pageSize: url.searchParams.get('pageSize') ?? undefined,
    academicSessionId: url.searchParams.get('academicSessionId') ?? undefined,
  };

  const parsedQuery = teacherRosterQuerySchema.safeParse(rawQuery);
  if (!parsedQuery.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid roster query parameters.', {
      status: 400,
      details: formatZodIssues(parsedQuery.error),
      requestId,
    });
  }

  try {
    const dbAcademics = getDomainDb(auth.workerEnv, D1_BINDINGS.ACADEMICS);
    const dbStudents = getDomainDb(auth.workerEnv, D1_BINDINGS.STUDENTS);
    const { roster, total } = await getTeacherClassRosterService(
      dbAcademics,
      dbStudents,
      auth.session,
      {
        classId: parsedClassId.data,
        academicSessionId: parsedQuery.data.academicSessionId,
        page: parsedQuery.data.page,
        pageSize: parsedQuery.data.pageSize,
      }
    );

    return jsonPaginated(
      roster,
      { page: parsedQuery.data.page, pageSize: parsedQuery.data.pageSize, total },
      { requestId }
    );
  } catch (error) {
    if (error instanceof TeachersServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('TEACHER_ROSTER_FETCH_FAILED', 'Unable to fetch class roster.', {
      status: 500,
      requestId,
    });
  }
}
