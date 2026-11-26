import { getClientIp, requireAuth } from '@/lib/auth/session';
import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonError, jsonOk, jsonPaginated } from '@/lib/http/response';
import { formatZodIssues, parseJsonBody } from '@/lib/validation/common';
import { assertCanManagePerformance } from '@/modules/performance/performance.permissions';
import {
  createExaminationSchema,
  listExaminationsQuerySchema,
} from '@/modules/performance/performance.schemas';
import {
  createExaminationService,
  listExaminationsService,
  PerformanceServiceError,
} from '@/modules/performance/performance.service';

export async function GET(request) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const sp = new URL(request.url).searchParams;
  const parsedQuery = listExaminationsQuerySchema.safeParse({
    page: sp.get('page') ?? undefined,
    pageSize: sp.get('pageSize') ?? undefined,
    academicSessionId: sp.get('academicSessionId') ?? undefined,
    examType: sp.get('examType') ?? undefined,
    isPublished: sp.get('isPublished') ?? undefined,
  });
  if (!parsedQuery.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid examination list query parameters.', {
      status: 400,
      details: formatZodIssues(parsedQuery.error),
      requestId,
    });
  }

  const roles = Array.isArray(auth.session?.roles) ? auth.session.roles : [];
  const canViewUnpublished =
    roles.includes('SUPER_ADMIN') ||
    roles.includes('COACHING_ADMIN') ||
    roles.includes('TEACHER');

  const effectiveQuery = canViewUnpublished
    ? parsedQuery.data
    : { ...parsedQuery.data, isPublished: true };

  try {
    const dbPerformance = getDomainDb(auth.workerEnv, D1_BINDINGS.PERFORMANCE);
    const { examinations, total } = await listExaminationsService(dbPerformance, effectiveQuery);
    return jsonPaginated(
      examinations,
      { page: effectiveQuery.page, pageSize: effectiveQuery.pageSize, total },
      { requestId }
    );
  } catch (error) {
    if (error instanceof PerformanceServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('EXAMINATIONS_LIST_FAILED', 'Unable to list examinations.', {
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

  const parsed = await parseJsonBody(request, createExaminationSchema, requestId);
  if (!parsed.ok) return parsed.response;

  try {
    const dbPerformance = getDomainDb(auth.workerEnv, D1_BINDINGS.PERFORMANCE);
    const created = await createExaminationService(
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
    return jsonError('EXAMINATION_CREATE_FAILED', 'Unable to create examination.', {
      status: 500,
      requestId,
    });
  }
}
