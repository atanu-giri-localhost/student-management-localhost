import { getClientIp, requireAuth } from '@/lib/auth/session';
import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonError, jsonOk, jsonPaginated } from '@/lib/http/response';
import { formatZodIssues, parseJsonBody } from '@/lib/validation/common';
import {
  assertCanAccessClassSubjectPerformance,
  assertCanManagePerformance,
} from '@/modules/performance/performance.permissions';
import {
  listExamMarksQuerySchema,
  recordExamMarkSchema,
} from '@/modules/performance/performance.schemas';
import {
  getExaminationByIdService,
  getExamSubjectByIdService,
  listExamMarksService,
  PerformanceServiceError,
  recordExamMarkService,
} from '@/modules/performance/performance.service';

export async function GET(request) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const sp = new URL(request.url).searchParams;
  const parsedQuery = listExamMarksQuerySchema.safeParse({
    page: sp.get('page') ?? undefined,
    pageSize: sp.get('pageSize') ?? undefined,
    examSubjectId: sp.get('examSubjectId') ?? undefined,
    enrollmentId: sp.get('enrollmentId') ?? undefined,
  });
  if (!parsedQuery.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid exam marks list query parameters.', {
      status: 400,
      details: formatZodIssues(parsedQuery.error),
      requestId,
    });
  }

  try {
    const dbPerformance = getDomainDb(auth.workerEnv, D1_BINDINGS.PERFORMANCE);
    const dbAcademics = auth.workerEnv?.[D1_BINDINGS.ACADEMICS] ?? null;

    let permissionError = null;
    if (parsedQuery.data.examSubjectId) {
      const examSubject = await getExamSubjectByIdService(
        dbPerformance,
        parsedQuery.data.examSubjectId
      );
      const examination = await getExaminationByIdService(dbPerformance, examSubject.examinationId);
      permissionError = await assertCanAccessClassSubjectPerformance(
        dbAcademics,
        auth.session,
        {
          academicSessionId: examination.academicSessionId,
          classId: examSubject.classId,
          subjectId: examSubject.subjectId,
        },
        requestId
      );
    } else {
      permissionError = assertCanManagePerformance(auth.session, requestId);
    }
    if (permissionError) return permissionError;

    const { examMarks, total } = await listExamMarksService(dbPerformance, parsedQuery.data);
    return jsonPaginated(
      examMarks,
      { page: parsedQuery.data.page, pageSize: parsedQuery.data.pageSize, total },
      { requestId }
    );
  } catch (error) {
    if (error instanceof PerformanceServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('EXAM_MARKS_LIST_FAILED', 'Unable to list exam marks.', {
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

  const parsed = await parseJsonBody(request, recordExamMarkSchema, requestId);
  if (!parsed.ok) return parsed.response;

  try {
    const dbPerformance = getDomainDb(auth.workerEnv, D1_BINDINGS.PERFORMANCE);
    const examSubject = await getExamSubjectByIdService(dbPerformance, parsed.data.examSubjectId);
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

    const created = await recordExamMarkService(
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
    return jsonError('EXAM_MARK_RECORD_FAILED', 'Unable to record exam mark.', {
      status: 500,
      requestId,
    });
  }
}
