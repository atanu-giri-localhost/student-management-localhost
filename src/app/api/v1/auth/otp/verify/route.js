import {
  buildSessionCookieHeader,
  getClientIp,
  getSessionCookieName,
  shouldUseSecureCookie,
} from '@/lib/auth/session';
import { getDb, resolveWorkerEnv } from '@/lib/cloudflare/bindings';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonError, jsonOk } from '@/lib/http/response';
import { parseJsonBody } from '@/lib/validation/common';
import { otpVerifySchema } from '@/modules/auth/auth.schemas';
import { AuthServiceError, verifyOtpService } from '@/modules/auth/auth.service';

/**
 * Verify a 6-digit WhatsApp OTP and set an HttpOnly session cookie (`POST /api/v1/auth/otp/verify`).
 *
 * @param {Request} request
 */
export async function POST(request) {
  const requestId = createRequestId(request);

  try {
    const workerEnv = await resolveWorkerEnv();
    const csrfError = assertSameOrigin(request, { workerEnv, requestId });
    if (csrfError) return csrfError;

    const parsed = await parseJsonBody(request, otpVerifySchema, requestId);
    if (!parsed.ok) return parsed.response;

    const db = getDb(workerEnv);
    const clientIp = getClientIp(request);
    const userAgent = request.headers.get('user-agent')?.slice(0, 255) ?? null;

    const { rawSessionToken, session } = await verifyOtpService(db, workerEnv, {
      phoneNormalized: parsed.data.phone,
      otp: parsed.data.otp,
      userAgent,
      clientIp,
    });

    const cookieHeader = buildSessionCookieHeader(rawSessionToken, {
      cookieName: getSessionCookieName(workerEnv),
      secure: shouldUseSecureCookie(workerEnv),
    });

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
      {
        requestId,
        headers: {
          'Set-Cookie': cookieHeader,
        },
      }
    );
  } catch (error) {
    if (error instanceof AuthServiceError) {
      return jsonError(error.code, error.message, {
        status: error.status,
        requestId,
      });
    }

    return jsonError('AUTH_VERIFY_FAILED', 'Unable to verify OTP.', {
      status: 503,
      requestId,
    });
  }
}
