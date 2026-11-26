import { getClientIp, requireAuth } from '@/lib/auth/session';
import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonError, jsonOk } from '@/lib/http/response';
import { parseJsonBody } from '@/lib/validation/common';
import {
  assertCanManageAcademics,
  assertCanReadAcademics,
} from '@/modules/academics/academics.permissions';
import { classIdSchema, updateClassSchema } from '@/modules/academics/academics.schemas';
import {
  AcademicsServiceError,
  getClassByIdService,
  updateClassService,
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

  try {
    const dbAcademics = getDomainDb(auth.workerEnv, D1_BINDINGS.ACADEMICS);
    const cls = await getClassByIdService(dbAcademics, parsedId.data);
    return jsonOk(cls, { requestId });
  } catch (error) {
    if (error instanceof AcademicsServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('CLASS_FETCH_FAILED', 'Unable to fetch class.', { status: 500, requestId });
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
  const parsedId = classIdSchema.safeParse(params?.id);
  if (!parsedId.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid class ID.', { status: 400, requestId });
  }

  const parsedBody = await parseJsonBody(request, updateClassSchema, requestId);
  if (!parsedBody.ok) return parsedBody.response;

  try {
    const dbAcademics = getDomainDb(auth.workerEnv, D1_BINDINGS.ACADEMICS);
    const updated = await updateClassService(
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
    return jsonError('CLASS_UPDATE_FAILED', 'Unable to update class.', { status: 500, requestId });
  }
}
