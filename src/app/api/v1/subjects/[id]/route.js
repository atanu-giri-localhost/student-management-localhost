import { getClientIp, requireAuth } from '@/lib/auth/session';
import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonError, jsonOk } from '@/lib/http/response';
import { parseJsonBody } from '@/lib/validation/common';
import {
  assertCanManageAcademics,
  assertCanReadAcademics,
} from '@/modules/academics/academics.permissions';
import { subjectIdSchema, updateSubjectSchema } from '@/modules/academics/academics.schemas';
import {
  AcademicsServiceError,
  getSubjectByIdService,
  updateSubjectService,
} from '@/modules/academics/academics.service';

export async function GET(request, context) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const permissionError = assertCanReadAcademics(auth.session, requestId);
  if (permissionError) return permissionError;

  const params = await context?.params;
  const parsedId = subjectIdSchema.safeParse(params?.id);
  if (!parsedId.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid subject ID.', { status: 400, requestId });
  }

  try {
    const dbAcademics = getDomainDb(auth.workerEnv, D1_BINDINGS.ACADEMICS);
    const subject = await getSubjectByIdService(dbAcademics, parsedId.data);
    return jsonOk(subject, { requestId });
  } catch (error) {
    if (error instanceof AcademicsServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('SUBJECT_FETCH_FAILED', 'Unable to fetch subject.', {
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

  const permissionError = assertCanManageAcademics(auth.session, requestId);
  if (permissionError) return permissionError;

  const params = await context?.params;
  const parsedId = subjectIdSchema.safeParse(params?.id);
  if (!parsedId.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid subject ID.', { status: 400, requestId });
  }

  const parsedBody = await parseJsonBody(request, updateSubjectSchema, requestId);
  if (!parsedBody.ok) return parsedBody.response;

  try {
    const dbAcademics = getDomainDb(auth.workerEnv, D1_BINDINGS.ACADEMICS);
    const updated = await updateSubjectService(
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
    return jsonOk(updated, { requestId });
  } catch (error) {
    if (error instanceof AcademicsServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('SUBJECT_UPDATE_FAILED', 'Unable to update subject.', {
      status: 500,
      requestId,
    });
  }
}
