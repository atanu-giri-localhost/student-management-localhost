import { getClientIp, requireAuth } from '@/lib/auth/session';
import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonError, jsonOk } from '@/lib/http/response';
import { parseJsonBody } from '@/lib/validation/common';
import { assertCanManagePerformance } from '@/modules/performance/performance.permissions';
import {
  gradingScaleIdSchema,
  updateGradingScaleSchema,
} from '@/modules/performance/performance.schemas';
import {
  getGradingScaleByIdService,
  PerformanceServiceError,
  updateGradingScaleService,
} from '@/modules/performance/performance.service';

export async function GET(request, context) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const params = await context?.params;
  const parsedId = gradingScaleIdSchema.safeParse(params?.id);
  if (!parsedId.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid grading scale ID.', {
      status: 400,
      requestId,
    });
  }

  try {
    const dbPerformance = getDomainDb(auth.workerEnv, D1_BINDINGS.PERFORMANCE);
    const scale = await getGradingScaleByIdService(dbPerformance, parsedId.data);
    return jsonOk(scale, { requestId });
  } catch (error) {
    if (error instanceof PerformanceServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('GRADING_SCALE_FETCH_FAILED', 'Unable to fetch grading scale.', {
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

  const permissionError = assertCanManagePerformance(auth.session, requestId);
  if (permissionError) return permissionError;

  const params = await context?.params;
  const parsedId = gradingScaleIdSchema.safeParse(params?.id);
  if (!parsedId.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid grading scale ID.', {
      status: 400,
      requestId,
    });
  }

  const parsedBody = await parseJsonBody(request, updateGradingScaleSchema, requestId);
  if (!parsedBody.ok) return parsedBody.response;

  try {
    const dbPerformance = getDomainDb(auth.workerEnv, D1_BINDINGS.PERFORMANCE);
    const updated = await updateGradingScaleService(
      dbPerformance,
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
    if (error instanceof PerformanceServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('GRADING_SCALE_UPDATE_FAILED', 'Unable to update grading scale.', {
      status: 500,
      requestId,
    });
  }
}
