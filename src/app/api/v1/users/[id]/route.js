import { getClientIp, requireAuth } from '@/lib/auth/session';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonError, jsonOk } from '@/lib/http/response';
import { parseJsonBody } from '@/lib/validation/common';
import { assertCanManageUsers } from '@/modules/users/users.permissions';
import { updateUserSchema, userIdSchema } from '@/modules/users/users.schemas';
import { getUserByIdService, updateUserService, UsersServiceError } from '@/modules/users/users.service';

/**
 * Fetch user detail by ID (`GET /api/v1/users/[id]`) — restricted to SUPER_ADMIN.
 *
 * @param {Request} request
 * @param {{ params: Promise<{ id: string }> | { id: string } }} context
 */
export async function GET(request, context) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const permissionError = assertCanManageUsers(auth.session, requestId);
  if (permissionError) return permissionError;

  const params = await context?.params;
  const parsedId = userIdSchema.safeParse(params?.id);
  if (!parsedId.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid user ID.', { status: 400, requestId });
  }

  try {
    const user = await getUserByIdService(auth.db, parsedId.data);
    return jsonOk(user, { requestId });
  } catch (error) {
    if (error instanceof UsersServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('USER_FETCH_FAILED', 'Unable to fetch user.', { status: 500, requestId });
  }
}

/**
 * Update user phone, email, or roles (`PATCH /api/v1/users/[id]`) — restricted to SUPER_ADMIN.
 *
 * @param {Request} request
 * @param {{ params: Promise<{ id: string }> | { id: string } }} context
 */
export async function PATCH(request, context) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const csrfError = assertSameOrigin(request, { workerEnv: auth.workerEnv, requestId });
  if (csrfError) return csrfError;

  const permissionError = assertCanManageUsers(auth.session, requestId);
  if (permissionError) return permissionError;

  const params = await context?.params;
  const parsedId = userIdSchema.safeParse(params?.id);
  if (!parsedId.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid user ID.', { status: 400, requestId });
  }

  const parsedBody = await parseJsonBody(request, updateUserSchema, requestId);
  if (!parsedBody.ok) return parsedBody.response;

  try {
    const updated = await updateUserService(auth.db, auth.session, parsedId.data, parsedBody.data, {
      clientIp: getClientIp(request),
      requestId,
    });
    return jsonOk(updated, { requestId });
  } catch (error) {
    if (error instanceof UsersServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('USER_UPDATE_FAILED', 'Unable to update user.', { status: 500, requestId });
  }
}
