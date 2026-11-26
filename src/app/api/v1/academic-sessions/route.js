import { getClientIp, requireAuth } from '@/lib/auth/session';
import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonError, jsonOk, jsonPaginated } from '@/lib/http/response';
import { formatZodIssues, parseJsonBody } from '@/lib/validation/common';
import {
  assertCanManageAcademics,
  assertCanReadAcademics,
} from '@/modules/academics/academics.permissions';
import {
  createAcademicSessionSchema,
  listAcademicSessionsQuerySchema,
} from '@/modules/academics/academics.schemas';
import {
  AcademicsServiceError,
  createAcademicSessionService,
  listAcademicSessionsService,
} from '@/modules/academics/academics.service';

export async function GET(request) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const permissionError = assertCanReadAcademics(auth.session, requestId);
  if (permissionError) return permissionError;

  const url = new URL(request.url);
  const rawQuery = {
    page: url.searchParams.get('page') ?? undefined,
    pageSize: url.searchParams.get('pageSize') ?? undefined,
    isActive: url.searchParams.get('isActive') ?? undefined,
  };

  const parsed = listAcademicSessionsQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid academic session query parameters.', {
      status: 400,
      details: formatZodIssues(parsed.error),
      requestId,
    });
  }

  const dbAcademics = getDomainDb(auth.workerEnv, D1_BINDINGS.ACADEMICS);
  const { academicSessions, total } = await listAcademicSessionsService(dbAcademics, parsed.data);

  return jsonPaginated(
    academicSessions,
    { page: parsed.data.page, pageSize: parsed.data.pageSize, total },
    { requestId }
  );
}

export async function POST(request) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const csrfError = assertSameOrigin(request, { workerEnv: auth.workerEnv, requestId });
  if (csrfError) return csrfError;

  const permissionError = assertCanManageAcademics(auth.session, requestId);
  if (permissionError) return permissionError;

  const parsed = await parseJsonBody(request, createAcademicSessionSchema, requestId);
  if (!parsed.ok) return parsed.response;

  try {
    const dbAcademics = getDomainDb(auth.workerEnv, D1_BINDINGS.ACADEMICS);
    const created = await createAcademicSessionService(
      dbAcademics,
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
    if (error instanceof AcademicsServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('ACADEMIC_SESSION_CREATE_FAILED', 'Unable to create academic session.', {
      status: 500,
      requestId,
    });
  }
}
