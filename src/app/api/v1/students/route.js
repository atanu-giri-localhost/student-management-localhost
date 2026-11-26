import { getClientIp, requireAuth } from '@/lib/auth/session';
import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonError, jsonOk, jsonPaginated } from '@/lib/http/response';
import { formatZodIssues, parseJsonBody } from '@/lib/validation/common';
import { assertCanManageStudents } from '@/modules/students/students.permissions';
import { createStudentSchema, listStudentsQuerySchema } from '@/modules/students/students.schemas';
import {
  createStudentService,
  listStudentsService,
  StudentsServiceError,
} from '@/modules/students/students.service';

export async function GET(request) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const permissionError = assertCanManageStudents(auth.session, requestId);
  if (permissionError) return permissionError;

  const url = new URL(request.url);
  const rawQuery = {
    page: url.searchParams.get('page') ?? undefined,
    pageSize: url.searchParams.get('pageSize') ?? undefined,
    search: url.searchParams.get('search') ?? undefined,
    lifecycleStatus: url.searchParams.get('lifecycleStatus') ?? undefined,
  };

  const parsed = listStudentsQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid student list query parameters.', {
      status: 400,
      details: formatZodIssues(parsed.error),
      requestId,
    });
  }

  const dbStudents = getDomainDb(auth.workerEnv, D1_BINDINGS.STUDENTS);
  const { students, total } = await listStudentsService(dbStudents, parsed.data);

  return jsonPaginated(
    students,
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

  const permissionError = assertCanManageStudents(auth.session, requestId);
  if (permissionError) return permissionError;

  const parsed = await parseJsonBody(request, createStudentSchema, requestId);
  if (!parsed.ok) return parsed.response;

  try {
    const dbStudents = getDomainDb(auth.workerEnv, D1_BINDINGS.STUDENTS);
    const student = await createStudentService(dbStudents, auth.workerEnv, auth.session, parsed.data, {
      clientIp: getClientIp(request),
      requestId,
    });
    return jsonOk(student, { status: 201, requestId });
  } catch (error) {
    if (error instanceof StudentsServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('STUDENT_CREATE_FAILED', 'Unable to create student.', { status: 500, requestId });
  }
}
