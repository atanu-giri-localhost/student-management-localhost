import { getClientIp, requireAuth } from '@/lib/auth/session';
import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonError, jsonOk } from '@/lib/http/response';
import { parseJsonBody } from '@/lib/validation/common';
import { assertCanManagePerformance } from '@/modules/performance/performance.permissions';
import {
  examinationIdSchema,
  examSubjectIdSchema,
  updateExamSubjectSchema,
} from '@/modules/performance/performance.schemas';
import {
  getExaminationByIdService,
  getExamSubjectByIdService,
  PerformanceServiceError,
  updateExamSubjectService,
} from '@/modules/performance/performance.service';

export async function GET(request, context) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const params = await context?.params;
  const parsedExamId = examinationIdSchema.safeParse(params?.id);
  if (!parsedExamId.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid examination ID.', {
      status: 400,
      requestId,
    });
  }

  const parsedSubjectId = examSubjectIdSchema.safeParse(params?.subjectEntryId);
  if (!parsedSubjectId.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid exam subject ID.', {
      status: 400,
      requestId,
    });
  }

  try {
    const dbPerformance = getDomainDb(auth.workerEnv, D1_BINDINGS.PERFORMANCE);
    const [exam, examSubject] = await Promise.all([
      getExaminationByIdService(dbPerformance, parsedExamId.data),
      getExamSubjectByIdService(dbPerformance, parsedSubjectId.data),
    ]);

    if (examSubject.examinationId !== parsedExamId.data) {
      return jsonError('NOT_FOUND', 'Exam subject not found for this examination.', {
        status: 404,
        requestId,
      });
    }

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

    return jsonOk(examSubject, { requestId });
  } catch (error) {
    if (error instanceof PerformanceServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('EXAM_SUBJECT_FETCH_FAILED', 'Unable to fetch exam subject.', {
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
  const parsedExamId = examinationIdSchema.safeParse(params?.id);
  if (!parsedExamId.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid examination ID.', {
      status: 400,
      requestId,
    });
  }

  const parsedSubjectId = examSubjectIdSchema.safeParse(params?.subjectEntryId);
  if (!parsedSubjectId.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid exam subject ID.', {
      status: 400,
      requestId,
    });
  }

  const parsedBody = await parseJsonBody(request, updateExamSubjectSchema, requestId);
  if (!parsedBody.ok) return parsedBody.response;

  try {
    const dbPerformance = getDomainDb(auth.workerEnv, D1_BINDINGS.PERFORMANCE);
    const existing = await getExamSubjectByIdService(dbPerformance, parsedSubjectId.data);
    if (existing.examinationId !== parsedExamId.data) {
      return jsonError('NOT_FOUND', 'Exam subject not found for this examination.', {
        status: 404,
        requestId,
      });
    }

    const updated = await updateExamSubjectService(
      dbPerformance,
      auth.workerEnv,
      auth.session,
      parsedSubjectId.data,
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
    return jsonError('EXAM_SUBJECT_UPDATE_FAILED', 'Unable to update exam subject.', {
      status: 500,
      requestId,
    });
  }
}
