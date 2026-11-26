import { getClientIp, requireAuth } from '@/lib/auth/session';
import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonError, jsonOk, jsonPaginated } from '@/lib/http/response';
import { formatZodIssues } from '@/lib/validation/common';
import { assertCanManagePerformance } from '@/modules/performance/performance.permissions';
import {
  createExamSubjectSchema,
  examinationIdSchema,
  listExamSubjectsQuerySchema,
} from '@/modules/performance/performance.schemas';
import {
  createExamSubjectService,
  getExaminationByIdService,
  listExamSubjectsService,
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
  const parsedQuery = listExamSubjectsQuerySchema.safeParse({
    page: sp.get('page') ?? undefined,
    pageSize: sp.get('pageSize') ?? undefined,
    examinationId: parsedExamId.data,
    classId: sp.get('classId') ?? undefined,
    subjectId: sp.get('subjectId') ?? undefined,
  });
  if (!parsedQuery.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid exam subject list query parameters.', {
      status: 400,
      details: formatZodIssues(parsedQuery.error),
      requestId,
    });
  }

  try {
    const dbPerformance = getDomainDb(auth.workerEnv, D1_BINDINGS.PERFORMANCE);
    const exam = await getExaminationByIdService(dbPerformance, parsedExamId.data);

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

    const { examSubjects, total } = await listExamSubjectsService(dbPerformance, parsedQuery.data);
    return jsonPaginated(
      examSubjects,
      { page: parsedQuery.data.page, pageSize: parsedQuery.data.pageSize, total },
      { requestId }
    );
  } catch (error) {
    if (error instanceof PerformanceServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('EXAM_SUBJECTS_LIST_FAILED', 'Unable to list exam subjects.', {
      status: 500,
      requestId,
    });
  }
}

export async function POST(request, context) {
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

  let rawBody;
  try {
    rawBody = await request.json();
  } catch {
    return jsonError('INVALID_JSON', 'Request body must be valid JSON.', {
      status: 400,
      requestId,
    });
  }

  if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    return jsonError('VALIDATION_ERROR', 'Request body must be a JSON object.', {
      status: 400,
      requestId,
    });
  }

  if (rawBody.examinationId !== undefined && rawBody.examinationId !== parsedExamId.data) {
    return jsonError('VALIDATION_ERROR', 'Body examinationId must match route examination ID.', {
      status: 400,
      requestId,
    });
  }

  const parsed = createExamSubjectSchema.safeParse({
    ...rawBody,
    examinationId: parsedExamId.data,
  });
  if (!parsed.success) {
    return jsonError('VALIDATION_ERROR', 'Request validation failed.', {
      status: 400,
      details: formatZodIssues(parsed.error),
      requestId,
    });
  }

  try {
    const dbPerformance = getDomainDb(auth.workerEnv, D1_BINDINGS.PERFORMANCE);
    const created = await createExamSubjectService(
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
    return jsonError('EXAM_SUBJECT_CREATE_FAILED', 'Unable to create exam subject.', {
      status: 500,
      requestId,
    });
  }
}
