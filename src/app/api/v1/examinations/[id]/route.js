import { getClientIp, requireAuth } from '@/lib/auth/session';
import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonError, jsonOk } from '@/lib/http/response';
import { parseJsonBody } from '@/lib/validation/common';
import { assertCanManagePerformance } from '@/modules/performance/performance.permissions';
import {
  examinationIdSchema,
  updateExaminationSchema,
} from '@/modules/performance/performance.schemas';
import {
  getExaminationByIdService,
  PerformanceServiceError,
  updateExaminationService,
} from '@/modules/performance/performance.service';

export async function GET(request, context) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const params = await context?.params;
  const parsedId = examinationIdSchema.safeParse(params?.id);
  if (!parsedId.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid examination ID.', {
      status: 400,
      requestId,
    });
  }

  try {
    const dbPerformance = getDomainDb(auth.workerEnv, D1_BINDINGS.PERFORMANCE);
    const exam = await getExaminationByIdService(dbPerformance, parsedId.data);

    const roles = Array.isArray(auth.session?.roles) ? auth.session.roles : [];
    const canViewUnpublished =
      roles.includes('SUPER_ADMIN') ||
      roles.includes('COACHING_ADMIN') ||
      roles.includes('TEACHER');

    if (!exam.isPublished && !canViewUnpublished) {
      return jsonError('FORBIDDEN', 'You do not have permission to view unpublished examinations.', {
        status: 403,
        requestId,
      });
    }

    return jsonOk(exam, { requestId });
  } catch (error) {
    if (error instanceof PerformanceServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('EXAMINATION_FETCH_FAILED', 'Unable to fetch examination.', {
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
  const parsedId = examinationIdSchema.safeParse(params?.id);
  if (!parsedId.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid examination ID.', {
      status: 400,
      requestId,
    });
  }

  const parsedBody = await parseJsonBody(request, updateExaminationSchema, requestId);
  if (!parsedBody.ok) return parsedBody.response;

  try {
    const dbPerformance = getDomainDb(auth.workerEnv, D1_BINDINGS.PERFORMANCE);
    const updated = await updateExaminationService(
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
    return jsonError('EXAMINATION_UPDATE_FAILED', 'Unable to update examination.', {
      status: 500,
      requestId,
    });
  }
}
