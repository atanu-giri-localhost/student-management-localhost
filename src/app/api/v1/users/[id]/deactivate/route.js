import { getClientIp, requireAuth } from '@/lib/auth/session';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonError, jsonOk } from '@/lib/http/response';
import { assertCanManageUsers } from '@/modules/users/users.permissions';
import { userIdSchema } from '@/modules/users/users.schemas';
import { deactivateUserService, UsersServiceError } from '@/modules/users/users.service';

/**
 * Deactivate a user account and revoke active sessions (`POST /api/v1/users/[id]/deactivate`).
 * Restricted to SUPER_ADMIN per provisional OD-01.
 *
 * @param {Request} request
 * @param {{ params: Promise<{ id: string }> | { id: string } }} context
 */
export async function POST(request, context) {
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

  try {
    const user = await deactivateUserService(auth.db, auth.session, parsedId.data, {
      clientIp: getClientIp(request),
      requestId,
    });
    return jsonOk(user, { requestId });
  } catch (error) {
    if (error instanceof UsersServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('USER_DEACTIVATE_FAILED', 'Unable to deactivate user.', {
      status: 500,
      requestId,
    });
  }
}
