import { getClientIp, requireAuth } from '@/lib/auth/session';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonOk } from '@/lib/http/response';
import { parseJsonBody } from '@/lib/validation/common';
import { assertCanRevokeSessions } from '@/modules/auth/auth.permissions';
import { sessionRevokeSchema } from '@/modules/auth/auth.schemas';
import { revokeUserSessionsService } from '@/modules/auth/auth.service';

/**
 * Administratively revoke all active sessions for a target user (`POST /api/v1/auth/session/revoke`).
 * Restricted to SUPER_ADMIN per provisional OD-01.
 *
 * @param {Request} request
 */
export async function POST(request) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const csrfError = assertSameOrigin(request, { workerEnv: auth.workerEnv, requestId });
  if (csrfError) return csrfError;

  const permissionError = assertCanRevokeSessions(auth.session, requestId);
  if (permissionError) return permissionError;

  const parsed = await parseJsonBody(request, sessionRevokeSchema, requestId);
  if (!parsed.ok) return parsed.response;

  const data = await revokeUserSessionsService(auth.identityDb, {
    actorSession: auth.session,
    targetUserId: parsed.data.userId,
    clientIp: getClientIp(request),
    requestId,
  });

  return jsonOk(data, { requestId });
}
