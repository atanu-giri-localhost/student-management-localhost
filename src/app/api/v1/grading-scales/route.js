import { getClientIp, requireAuth } from '@/lib/auth/session';
import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonError, jsonOk, jsonPaginated } from '@/lib/http/response';
import { formatZodIssues, parseJsonBody } from '@/lib/validation/common';
import { assertCanManagePerformance } from '@/modules/performance/performance.permissions';
import {
  createGradingScaleSchema,
  listGradingScalesQuerySchema,
} from '@/modules/performance/performance.schemas';
import {
  createGradingScaleService,
  listGradingScalesService,
  PerformanceServiceError,
} from '@/modules/performance/performance.service';

export async function GET(request) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const sp = new URL(request.url).searchParams;
  const parsedQuery = listGradingScalesQuerySchema.safeParse({
    page: sp.get('page') ?? undefined,
    pageSize: sp.get('pageSize') ?? undefined,
    academicSessionId: sp.get('academicSessionId') ?? undefined,
    name: sp.get('name') ?? undefined,
    isActive: sp.get('isActive') ?? undefined,
  });
  if (!parsedQuery.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid grading scale list query parameters.', {
      status: 400,
      details: formatZodIssues(parsedQuery.error),
      requestId,
    });
  }

  try {
    const dbPerformance = getDomainDb(auth.workerEnv, D1_BINDINGS.PERFORMANCE);
    const { gradingScales, total } = await listGradingScalesService(
      dbPerformance,
      parsedQuery.data
    );
    return jsonPaginated(
      gradingScales,
      { page: parsedQuery.data.page, pageSize: parsedQuery.data.pageSize, total },
      { requestId }
    );
  } catch (error) {
    if (error instanceof PerformanceServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('GRADING_SCALES_LIST_FAILED', 'Unable to list grading scales.', {
      status: 500,
      requestId,
    });
  }
}

export async function POST(request) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const csrfError = assertSameOrigin(request, { workerEnv: auth.workerEnv, requestId });
  if (csrfError) return csrfError;

  const permissionError = assertCanManagePerformance(auth.session, requestId);
  if (permissionError) return permissionError;

  const parsed = await parseJsonBody(request, createGradingScaleSchema, requestId);
  if (!parsed.ok) return parsed.response;

  try {
    const dbPerformance = getDomainDb(auth.workerEnv, D1_BINDINGS.PERFORMANCE);
    const created = await createGradingScaleService(
      dbPerformance,
      auth.workerEnv,
      auth.session,
      parsed.data,
      {
        clientIp: getClientIp(request),
        requestId,
      }
    );
    return jsonOk(created, { status: 201, requestId });
  } catch (error) {
    if (error instanceof PerformanceServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('GRADING_SCALE_CREATE_FAILED', 'Unable to create grading scale.', {
      status: 500,
      requestId,
    });
  }
}
