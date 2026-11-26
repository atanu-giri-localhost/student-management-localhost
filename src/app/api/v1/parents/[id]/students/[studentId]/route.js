import { getClientIp, requireAuth } from '@/lib/auth/session';
import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonError, jsonOk } from '@/lib/http/response';
import { assertCanManageParents } from '@/modules/parents/parents.permissions';
import { parentIdSchema } from '@/modules/parents/parents.schemas';
import { ParentsServiceError, unlinkParentStudentService } from '@/modules/parents/parents.service';
import { studentIdSchema } from '@/modules/students/students.schemas';

export async function DELETE(request, context) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const csrfError = assertSameOrigin(request, { workerEnv: auth.workerEnv, requestId });
  if (csrfError) return csrfError;

  const permissionError = assertCanManageParents(auth.session, requestId);
  if (permissionError) return permissionError;

  const params = await context?.params;
  const parsedParentId = parentIdSchema.safeParse(params?.id);
  const parsedStudentId = studentIdSchema.safeParse(params?.studentId);
  if (!parsedParentId.success || !parsedStudentId.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid parent or student ID.', { status: 400, requestId });
  }

  try {
    const dbStudents = getDomainDb(auth.workerEnv, D1_BINDINGS.STUDENTS);
    const result = await unlinkParentStudentService(
      dbStudents,
      auth.session,
      parsedParentId.data,
      parsedStudentId.data,
      { clientIp: getClientIp(request), requestId }
    );
    return jsonOk(result, { requestId });
  } catch (error) {
    if (error instanceof ParentsServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('PARENT_UNLINK_FAILED', 'Unable to unlink parent and student.', {
      status: 500,
      requestId,
    });
  }
}
