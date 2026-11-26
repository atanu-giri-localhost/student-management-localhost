import { getClientIp, requireAuth } from '@/lib/auth/session';
import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonError, jsonOk } from '@/lib/http/response';
import { parseJsonBody } from '@/lib/validation/common';
import {
  assertCanManageParents,
  assertCanReadParentProfile,
} from '@/modules/parents/parents.permissions';
import { parentIdSchema, updateParentProfileSchema } from '@/modules/parents/parents.schemas';
import {
  getParentProfileService,
  ParentsServiceError,
  updateParentProfileService,
} from '@/modules/parents/parents.service';

export async function GET(request, context) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const params = await context?.params;
  const parsedId = parentIdSchema.safeParse(params?.id);
  if (!parsedId.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid parent profile ID.', { status: 400, requestId });
  }

  const permissionError = assertCanReadParentProfile(auth.session, parsedId.data, requestId);
  if (permissionError) return permissionError;

  try {
    const dbStudents = getDomainDb(auth.workerEnv, D1_BINDINGS.STUDENTS);
    const parent = await getParentProfileService(dbStudents, parsedId.data);
    return jsonOk(parent, { requestId });
  } catch (error) {
    if (error instanceof ParentsServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('PARENT_FETCH_FAILED', 'Unable to fetch parent profile.', {
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

  const permissionError = assertCanManageParents(auth.session, requestId);
  if (permissionError) return permissionError;

  const params = await context?.params;
  const parsedId = parentIdSchema.safeParse(params?.id);
  if (!parsedId.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid parent profile ID.', { status: 400, requestId });
  }

  const parsedBody = await parseJsonBody(request, updateParentProfileSchema, requestId);
  if (!parsedBody.ok) return parsedBody.response;

  try {
    const dbStudents = getDomainDb(auth.workerEnv, D1_BINDINGS.STUDENTS);
    const updated = await updateParentProfileService(
      dbStudents,
      auth.session,
      parsedId.data,
      parsedBody.data,
      { clientIp: getClientIp(request), requestId }
    );
    return jsonOk(updated, { requestId });
  } catch (error) {
    if (error instanceof ParentsServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('PARENT_UPDATE_FAILED', 'Unable to update parent profile.', {
      status: 500,
      requestId,
    });
  }
}
