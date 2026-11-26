import { getClientIp, requireAuth } from '@/lib/auth/session';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonError, jsonOk, jsonPaginated } from '@/lib/http/response';
import { formatZodIssues, parseJsonBody } from '@/lib/validation/common';
import { assertCanManageUsers } from '@/modules/users/users.permissions';
import { createUserSchema, listUsersQuerySchema } from '@/modules/users/users.schemas';
import { createUserService, listUsersService, UsersServiceError } from '@/modules/users/users.service';

/**
 * List users (`GET /api/v1/users`) — restricted to SUPER_ADMIN.
 *
 * @param {Request} request
 */
export async function GET(request) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const permissionError = assertCanManageUsers(auth.session, requestId);
  if (permissionError) return permissionError;

  const url = new URL(request.url);
  const rawQuery = {
    page: url.searchParams.get('page') ?? undefined,
    pageSize: url.searchParams.get('pageSize') ?? undefined,
    search: url.searchParams.get('search') ?? undefined,
    role: url.searchParams.get('role') ?? undefined,
    isActive: url.searchParams.get('isActive') ?? undefined,
  };

  const parsed = listUsersQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid user list query parameters.', {
      status: 400,
      details: formatZodIssues(parsed.error),
      requestId,
    });
  }

  const { users, total } = await listUsersService(auth.identityDb, parsed.data);
  return jsonPaginated(
    users,
    { page: parsed.data.page, pageSize: parsed.data.pageSize, total },
    { requestId }
  );
}

/**
 * Create a user with assigned roles (`POST /api/v1/users`) — restricted to SUPER_ADMIN.
 *
 * @param {Request} request
 */
export async function POST(request) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const csrfError = assertSameOrigin(request, { workerEnv: auth.workerEnv, requestId });
  if (csrfError) return csrfError;

  const permissionError = assertCanManageUsers(auth.session, requestId);
  if (permissionError) return permissionError;

  const parsed = await parseJsonBody(request, createUserSchema, requestId);
  if (!parsed.ok) return parsed.response;

  try {
    const user = await createUserService(auth.identityDb, auth.session, parsed.data, {
      clientIp: getClientIp(request),
      requestId,
      workerEnv: auth.workerEnv,
    });
    return jsonOk(user, { status: 201, requestId });
  } catch (error) {
    if (error instanceof UsersServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('USER_CREATE_FAILED', 'Unable to create user.', { status: 500, requestId });
  }
}
