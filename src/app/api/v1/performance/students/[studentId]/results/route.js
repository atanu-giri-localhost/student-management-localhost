import { requireAuth } from '@/lib/auth/session';
import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { createRequestId, jsonError, jsonOk } from '@/lib/http/response';
import { formatZodIssues, uuidSchema } from '@/lib/validation/common';
import { assertCanReadStudentPerformance } from '@/modules/performance/performance.permissions';
import { studentResultsQuerySchema } from '@/modules/performance/performance.schemas';
import {
  getStudentExamResultsService,
  PerformanceServiceError,
} from '@/modules/performance/performance.service';

export async function GET(request, context) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const params = await context?.params;
  const parsedStudentId = uuidSchema.safeParse(params?.studentId);
  if (!parsedStudentId.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid student ID.', {
      status: 400,
      requestId,
    });
  }

  const dbStudents = auth.workerEnv?.[D1_BINDINGS.STUDENTS] ?? null;
  const permissionError = await assertCanReadStudentPerformance(
    dbStudents,
    auth.session,
    parsedStudentId.data,
    requestId
  );
  if (permissionError) return permissionError;

  const sp = new URL(request.url).searchParams;
  const parsedQuery = studentResultsQuerySchema.safeParse({
    academicSessionId: sp.get('academicSessionId') ?? undefined,
    examinationId: sp.get('examinationId') ?? undefined,
  });
  if (!parsedQuery.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid student exam results query parameters.', {
      status: 400,
      details: formatZodIssues(parsedQuery.error),
      requestId,
    });
  }

  try {
    const dbPerformance = getDomainDb(auth.workerEnv, D1_BINDINGS.PERFORMANCE);
    const results = await getStudentExamResultsService(
      dbPerformance,
      auth.workerEnv,
      auth.session,
      {
        studentId: parsedStudentId.data,
        ...parsedQuery.data,
      }
    );
    return jsonOk(results, { requestId });
  } catch (error) {
    if (error instanceof PerformanceServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('STUDENT_RESULTS_FETCH_FAILED', 'Unable to fetch student exam results.', {
      status: 500,
      requestId,
    });
  }
}
