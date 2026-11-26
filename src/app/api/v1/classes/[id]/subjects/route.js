import { getClientIp, requireAuth } from '@/lib/auth/session';
import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonError, jsonOk } from '@/lib/http/response';
import { formatZodIssues, parseJsonBody } from '@/lib/validation/common';
import {
  assertCanManageAcademics,
  assertCanReadAcademics,
} from '@/modules/academics/academics.permissions';
import {
  assignClassSubjectSchema,
  classIdSchema,
  listClassSubjectsQuerySchema,
} from '@/modules/academics/academics.schemas';
import {
  AcademicsServiceError,
  assignClassSubjectService,
  listClassSubjectsService,
} from '@/modules/academics/academics.service';

export async function GET(request, context) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const permissionError = assertCanReadAcademics(auth.session, requestId);
  if (permissionError) return permissionError;

  const params = await context?.params;
  const parsedId = classIdSchema.safeParse(params?.id);
  if (!parsedId.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid class ID.', { status: 400, requestId });
  }

  const url = new URL(request.url);
  const parsedQuery = listClassSubjectsQuerySchema.safeParse({
    academicSessionId: url.searchParams.get('academicSessionId') ?? undefined,
  });
  if (!parsedQuery.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid class subjects query parameters.', {
      status: 400,
      details: formatZodIssues(parsedQuery.error),
      requestId,
    });
  }

  try {
    const dbAcademics = getDomainDb(auth.workerEnv, D1_BINDINGS.ACADEMICS);
    const subjects = await listClassSubjectsService(dbAcademics, parsedId.data, parsedQuery.data);
    return jsonOk(subjects, { requestId });
  } catch (error) {
    if (error instanceof AcademicsServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('CLASS_SUBJECTS_FETCH_FAILED', 'Unable to fetch class subjects.', {
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

  const permissionError = assertCanManageAcademics(auth.session, requestId);
  if (permissionError) return permissionError;

  const params = await context?.params;
  const parsedId = classIdSchema.safeParse(params?.id);
  if (!parsedId.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid class ID.', { status: 400, requestId });
  }

  const parsedBody = await parseJsonBody(request, assignClassSubjectSchema, requestId);
  if (!parsedBody.ok) return parsedBody.response;

  try {
    const dbAcademics = getDomainDb(auth.workerEnv, D1_BINDINGS.ACADEMICS);
    const mapping = await assignClassSubjectService(
      dbAcademics,
      auth.workerEnv,
      auth.session,
      parsedId.data,
      parsedBody.data,
      {
        clientIp: getClientIp(request),
        requestId,
      }
    );
    return jsonOk(mapping, { status: 201, requestId });
  } catch (error) {
    if (error instanceof AcademicsServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('CLASS_SUBJECT_ASSIGN_FAILED', 'Unable to assign subject to class.', {
      status: 500,
      requestId,
    });
  }
}
