import {
  buildClearSessionCookieHeader,
  getSessionCookieName,
  requireAuth,
  shouldUseSecureCookie,
} from '@/lib/auth/session';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonOk } from '@/lib/http/response';
import { logoutService } from '@/modules/auth/auth.service';

/**
 * Revoke the caller's active session and clear the session cookie (`POST /api/v1/auth/logout`).
 *
 * @param {Request} request
 */
export async function POST(request) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const csrfError = assertSameOrigin(request, { workerEnv: auth.workerEnv, requestId });
  if (csrfError) return csrfError;

  const data = await logoutService(auth.identityDb, { sessionId: auth.session.sessionId });
  const clearCookie = buildClearSessionCookieHeader({
    cookieName: getSessionCookieName(auth.workerEnv),
    secure: shouldUseSecureCookie(auth.workerEnv),
  });

  return jsonOk(data, {
    requestId,
    headers: {
      'Set-Cookie': clearCookie,
    },
  });
}
