import { getClientIp, requireAuth } from '@/lib/auth/session';
import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonError, jsonOk, jsonPaginated } from '@/lib/http/response';
import { formatZodIssues, parseJsonBody } from '@/lib/validation/common';
import { assertCanManageTeachers } from '@/modules/teachers/teachers.permissions';
import {
  createTeacherAssignmentSchema,
  listTeacherAssignmentsQuerySchema,
} from '@/modules/teachers/teachers.schemas';
import {
  createTeacherAssignmentService,
  listTeacherAssignmentsService,
  TeachersServiceError,
} from '@/modules/teachers/teachers.service';

export async function GET(request) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const permissionError = assertCanManageTeachers(auth.session, requestId);
  if (permissionError) return permissionError;

  const url = new URL(request.url);
  const rawQuery = {
    page: url.searchParams.get('page') ?? undefined,
    pageSize: url.searchParams.get('pageSize') ?? undefined,
    teacherProfileId: url.searchParams.get('teacherProfileId') ?? undefined,
    academicSessionId: url.searchParams.get('academicSessionId') ?? undefined,
    classId: url.searchParams.get('classId') ?? undefined,
    subjectId: url.searchParams.get('subjectId') ?? undefined,
    responsibilityCategory: url.searchParams.get('responsibilityCategory') ?? undefined,
  };

  const parsed = listTeacherAssignmentsQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid teacher assignment query parameters.', {
      status: 400,
      details: formatZodIssues(parsed.error),
      requestId,
    });
  }

  const dbAcademics = getDomainDb(auth.workerEnv, D1_BINDINGS.ACADEMICS);
  const { assignments, total } = await listTeacherAssignmentsService(dbAcademics, parsed.data);

  return jsonPaginated(
    assignments,
    { page: parsed.data.page, pageSize: parsed.data.pageSize, total },
    { requestId }
  );
}

export async function POST(request) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const csrfError = assertSameOrigin(request, { workerEnv: auth.workerEnv, requestId });
  if (csrfError) return csrfError;

  const permissionError = assertCanManageTeachers(auth.session, requestId);
  if (permissionError) return permissionError;

  const parsed = await parseJsonBody(request, createTeacherAssignmentSchema, requestId);
  if (!parsed.ok) return parsed.response;

  try {
    const dbAcademics = getDomainDb(auth.workerEnv, D1_BINDINGS.ACADEMICS);
    const assignment = await createTeacherAssignmentService(
      dbAcademics,
      auth.workerEnv,
      auth.session,
      parsed.data,
      {
        clientIp: getClientIp(request),
        requestId,
      }
    );
    return jsonOk(assignment, { status: 201, requestId });
  } catch (error) {
    if (error instanceof TeachersServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('TEACHER_ASSIGNMENT_CREATE_FAILED', 'Unable to create teacher assignment.', {
      status: 500,
      requestId,
    });
  }
}
