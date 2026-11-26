import { getClientIp, requireAuth } from '@/lib/auth/session';
import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonError, jsonOk } from '@/lib/http/response';
import { parseJsonBody } from '@/lib/validation/common';
import {
  assertCanManageTeachers,
  assertCanReadTeacherProfile,
} from '@/modules/teachers/teachers.permissions';
import { teacherIdSchema, updateTeacherSchema } from '@/modules/teachers/teachers.schemas';
import {
  getTeacherByIdService,
  TeachersServiceError,
  updateTeacherService,
} from '@/modules/teachers/teachers.service';

export async function GET(request, context) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const params = await context?.params;
  const parsedId = teacherIdSchema.safeParse(params?.id);
  if (!parsedId.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid teacher ID.', { status: 400, requestId });
  }

  const permissionError = assertCanReadTeacherProfile(auth.session, parsedId.data, requestId);
  if (permissionError) return permissionError;

  try {
    const dbAcademics = getDomainDb(auth.workerEnv, D1_BINDINGS.ACADEMICS);
    const teacher = await getTeacherByIdService(dbAcademics, parsedId.data);
    return jsonOk(teacher, { requestId });
  } catch (error) {
    if (error instanceof TeachersServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('TEACHER_FETCH_FAILED', 'Unable to fetch teacher profile.', {
      status: 500,
      requestId,
    });
  }
}

export async function PATCH(request, context) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const csrfError = assertSameOrigin(request, { workerEnv: auth.workerEnv, requestId });
  if (csrfError) return csrfError;

  const permissionError = assertCanManageTeachers(auth.session, requestId);
  if (permissionError) return permissionError;

  const params = await context?.params;
  const parsedId = teacherIdSchema.safeParse(params?.id);
  if (!parsedId.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid teacher ID.', { status: 400, requestId });
  }

  const parsedBody = await parseJsonBody(request, updateTeacherSchema, requestId);
  if (!parsedBody.ok) return parsedBody.response;

  try {
    const dbAcademics = getDomainDb(auth.workerEnv, D1_BINDINGS.ACADEMICS);
    const updated = await updateTeacherService(
      dbAcademics,
      auth.workerEnv,
      auth.session,
      parsedId.data,
      parsedBody.data,
      {
        clientIp: getClientIp(request),
        requestId,
      }
    );
    return jsonOk(updated, { requestId });
  } catch (error) {
    if (error instanceof TeachersServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('TEACHER_UPDATE_FAILED', 'Unable to update teacher profile.', {
      status: 500,
      requestId,
    });
  }
}
