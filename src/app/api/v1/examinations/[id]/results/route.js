import { requireAuth } from '@/lib/auth/session';
import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { createRequestId, jsonError, jsonOk } from '@/lib/http/response';
import { formatZodIssues } from '@/lib/validation/common';
import { assertCanAccessClassPerformance } from '@/modules/performance/performance.permissions';
import {
  classResultsQuerySchema,
  examinationIdSchema,
} from '@/modules/performance/performance.schemas';
import {
  getClassExamResultsService,
  getExaminationByIdService,
  PerformanceServiceError,
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

  const sp = new URL(request.url).searchParams;
  const parsedQuery = classResultsQuerySchema.safeParse({
    examinationId: parsedExamId.data,
    classId: sp.get('classId') ?? undefined,
    page: sp.get('page') ?? undefined,
    pageSize: sp.get('pageSize') ?? undefined,
  });
  if (!parsedQuery.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid class exam results query parameters.', {
      status: 400,
      details: formatZodIssues(parsedQuery.error),
      requestId,
    });
  }

  try {
    const dbPerformance = getDomainDb(auth.workerEnv, D1_BINDINGS.PERFORMANCE);
    const exam = await getExaminationByIdService(dbPerformance, parsedExamId.data);

    const dbAcademics = auth.workerEnv?.[D1_BINDINGS.ACADEMICS] ?? null;
    const permissionError = await assertCanAccessClassPerformance(
      dbAcademics,
      auth.session,
      {
        academicSessionId: exam.academicSessionId,
        classId: parsedQuery.data.classId,
      },
      requestId
    );
    if (permissionError) return permissionError;

    const classResults = await getClassExamResultsService(
      dbPerformance,
      auth.workerEnv,
      parsedQuery.data
    );
    return jsonOk(classResults, { requestId });
  } catch (error) {
    if (error instanceof PerformanceServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('CLASS_RESULTS_FETCH_FAILED', 'Unable to fetch class exam results.', {
      status: 500,
      requestId,
    });
  }
}
