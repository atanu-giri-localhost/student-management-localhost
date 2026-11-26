import { getClientIp, requireAuth } from '@/lib/auth/session';
import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonError, jsonOk } from '@/lib/http/response';
import { parseJsonBody } from '@/lib/validation/common';
import { assertCanAccessClassSubjectPerformance } from '@/modules/performance/performance.permissions';
import {
  examMarkIdSchema,
  updateExamMarkSchema,
} from '@/modules/performance/performance.schemas';
import {
  getExaminationByIdService,
  getExamMarkByIdService,
  getExamSubjectByIdService,
  PerformanceServiceError,
  updateExamMarkService,
} from '@/modules/performance/performance.service';

export async function GET(request, context) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const params = await context?.params;
  const parsedId = examMarkIdSchema.safeParse(params?.id);
  if (!parsedId.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid exam mark ID.', {
      status: 400,
      requestId,
    });
  }

  try {
    const dbPerformance = getDomainDb(auth.workerEnv, D1_BINDINGS.PERFORMANCE);
    const mark = await getExamMarkByIdService(dbPerformance, parsedId.data);
    const examSubject = await getExamSubjectByIdService(dbPerformance, mark.examSubjectId);
    const examination = await getExaminationByIdService(dbPerformance, examSubject.examinationId);

    const dbAcademics = auth.workerEnv?.[D1_BINDINGS.ACADEMICS] ?? null;
    const permissionError = await assertCanAccessClassSubjectPerformance(
      dbAcademics,
      auth.session,
      {
        academicSessionId: examination.academicSessionId,
        classId: examSubject.classId,
        subjectId: examSubject.subjectId,
      },
      requestId
    );
    if (permissionError) return permissionError;

    return jsonOk(mark, { requestId });
  } catch (error) {
    if (error instanceof PerformanceServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('EXAM_MARK_FETCH_FAILED', 'Unable to fetch exam mark.', {
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

  const params = await context?.params;
  const parsedId = examMarkIdSchema.safeParse(params?.id);
  if (!parsedId.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid exam mark ID.', {
      status: 400,
      requestId,
    });
  }

  const parsedBody = await parseJsonBody(request, updateExamMarkSchema, requestId);
  if (!parsedBody.ok) return parsedBody.response;

  try {
    const dbPerformance = getDomainDb(auth.workerEnv, D1_BINDINGS.PERFORMANCE);
    const existing = await getExamMarkByIdService(dbPerformance, parsedId.data);
    const examSubject = await getExamSubjectByIdService(dbPerformance, existing.examSubjectId);
    const examination = await getExaminationByIdService(dbPerformance, examSubject.examinationId);

    const dbAcademics = auth.workerEnv?.[D1_BINDINGS.ACADEMICS] ?? null;
    const permissionError = await assertCanAccessClassSubjectPerformance(
      dbAcademics,
      auth.session,
      {
        academicSessionId: examination.academicSessionId,
        classId: examSubject.classId,
        subjectId: examSubject.subjectId,
      },
      requestId
    );
    if (permissionError) return permissionError;

    const updated = await updateExamMarkService(
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
    return jsonError('EXAM_MARK_UPDATE_FAILED', 'Unable to update exam mark.', {
      status: 500,
      requestId,
    });
  }
}
