import { getClientIp, requireAuth } from '@/lib/auth/session';
import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonError, jsonOk } from '@/lib/http/response';
import { assertCanManageTeachers } from '@/modules/teachers/teachers.permissions';
import { teacherAssignmentIdSchema } from '@/modules/teachers/teachers.schemas';
import {
  deleteTeacherAssignmentService,
  TeachersServiceError,
} from '@/modules/teachers/teachers.service';

export async function DELETE(request, context) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const csrfError = assertSameOrigin(request, { workerEnv: auth.workerEnv, requestId });
  if (csrfError) return csrfError;

  const permissionError = assertCanManageTeachers(auth.session, requestId);
  if (permissionError) return permissionError;

  const params = await context?.params;
  const parsedId = teacherAssignmentIdSchema.safeParse(params?.id);
  if (!parsedId.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid teacher assignment ID.', {
      status: 400,
      requestId,
    });
  }

  try {
    const dbAcademics = getDomainDb(auth.workerEnv, D1_BINDINGS.ACADEMICS);
    const result = await deleteTeacherAssignmentService(
      dbAcademics,
      auth.workerEnv,
      auth.session,
      parsedId.data,
      {
        clientIp: getClientIp(request),
        requestId,
      }
    );
    return jsonOk(result, { requestId });
  } catch (error) {
    if (error instanceof TeachersServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('TEACHER_ASSIGNMENT_DELETE_FAILED', 'Unable to delete teacher assignment.', {
      status: 500,
      requestId,
    });
  }
}
