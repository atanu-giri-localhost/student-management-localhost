import { requireAuth } from '@/lib/auth/session';
import { createRequestId, jsonOk } from '@/lib/http/response';

/**
 * Return the authenticated user session context (`GET /api/v1/auth/session`).
 *
 * @param {Request} request
 */
export async function GET(request) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const { session } = auth;
  return jsonOk(
    {
      user: {
        id: session.userId,
        phoneNormalized: session.phoneNormalized,
        email: session.email,
        isActive: session.isActive,
      },
      roles: session.roles,
      profiles: session.profiles,
      session: {
        id: session.sessionId,
        expiresAt: session.expiresAt,
      },
    },
    { requestId }
  );
}
