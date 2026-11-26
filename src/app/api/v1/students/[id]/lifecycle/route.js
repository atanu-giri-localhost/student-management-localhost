import { getClientIp, requireAuth } from '@/lib/auth/session';
import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonError, jsonOk } from '@/lib/http/response';
import { parseJsonBody } from '@/lib/validation/common';
import { assertCanManageStudents } from '@/modules/students/students.permissions';
import { studentIdSchema, studentLifecycleSchema } from '@/modules/students/students.schemas';
import {
  StudentsServiceError,
  updateStudentLifecycleService,
} from '@/modules/students/students.service';

export async function POST(request, context) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const csrfError = assertSameOrigin(request, { workerEnv: auth.workerEnv, requestId });
  if (csrfError) return csrfError;

  const permissionError = assertCanManageStudents(auth.session, requestId);
  if (permissionError) return permissionError;

  const params = await context?.params;
  const parsedId = studentIdSchema.safeParse(params?.id);
  if (!parsedId.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid student ID.', { status: 400, requestId });
  }

  const parsedBody = await parseJsonBody(request, studentLifecycleSchema, requestId);
  if (!parsedBody.ok) return parsedBody.response;

  try {
    const dbStudents = getDomainDb(auth.workerEnv, D1_BINDINGS.STUDENTS);
    const updated = await updateStudentLifecycleService(
      dbStudents,
      auth.session,
      parsedId.data,
      parsedBody.data.lifecycleStatus,
      { clientIp: getClientIp(request), requestId }
    );
    return jsonOk(updated, { requestId });
  } catch (error) {
    if (error instanceof StudentsServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('STUDENT_LIFECYCLE_FAILED', 'Unable to update student lifecycle.', {
      status: 500,
      requestId,
    });
  }
}
