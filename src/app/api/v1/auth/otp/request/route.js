import { getClientIp } from '@/lib/auth/session';
import { D1_BINDINGS, getDomainDb, resolveWorkerEnv } from '@/lib/cloudflare/bindings';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonError, jsonOk } from '@/lib/http/response';
import { parseJsonBody } from '@/lib/validation/common';
import { otpRequestSchema } from '@/modules/auth/auth.schemas';
import { AuthServiceError, requestOtpService } from '@/modules/auth/auth.service';

/**
 * Request a WhatsApp OTP challenge (`POST /api/v1/auth/otp/request`).
 * Returns an identical 200 anti-enumeration response regardless of account existence.
 *
 * @param {Request} request
 */
export async function POST(request) {
  const requestId = createRequestId(request);

  try {
    const workerEnv = await resolveWorkerEnv();
    const csrfError = assertSameOrigin(request, { workerEnv, requestId });
    if (csrfError) return csrfError;

    const parsed = await parseJsonBody(request, otpRequestSchema, requestId);
    if (!parsed.ok) return parsed.response;

    const identityDb = getDomainDb(workerEnv, D1_BINDINGS.IDENTITY);
    const clientIp = getClientIp(request);

    const data = await requestOtpService(identityDb, workerEnv, {
      phoneNormalized: parsed.data.phone,
      clientIp,
    });

    return jsonOk(data, { requestId });
  } catch (error) {
    if (error instanceof AuthServiceError) {
      const headers = new Headers();
      if (typeof error.extra?.retryAfterSeconds === 'number') {
        headers.set('Retry-After', String(error.extra.retryAfterSeconds));
      }
      return jsonError(error.code, error.message, {
        status: error.status,
        requestId,
        headers,
      });
    }

    return jsonError('AUTH_REQUEST_FAILED', 'Unable to process OTP request.', {
      status: 503,
      requestId,
    });
  }
}
