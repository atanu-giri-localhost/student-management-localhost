import { getClientIp, requireAuth } from '@/lib/auth/session';
import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonError, jsonOk } from '@/lib/http/response';
import { parseJsonBody } from '@/lib/validation/common';
import { assertCanManageParents } from '@/modules/parents/parents.permissions';
import { createParentProfileSchema } from '@/modules/parents/parents.schemas';
import { createParentProfileService, ParentsServiceError } from '@/modules/parents/parents.service';

export async function POST(request) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const csrfError = assertSameOrigin(request, { workerEnv: auth.workerEnv, requestId });
  if (csrfError) return csrfError;

  const permissionError = assertCanManageParents(auth.session, requestId);
  if (permissionError) return permissionError;

  const parsed = await parseJsonBody(request, createParentProfileSchema, requestId);
  if (!parsed.ok) return parsed.response;

  try {
    const dbStudents = getDomainDb(auth.workerEnv, D1_BINDINGS.STUDENTS);
    const parent = await createParentProfileService(
      dbStudents,
      auth.workerEnv,
      auth.session,
      parsed.data,
      { clientIp: getClientIp(request), requestId }
    );
    return jsonOk(parent, { status: 201, requestId });
  } catch (error) {
    if (error instanceof ParentsServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('PARENT_CREATE_FAILED', 'Unable to create parent profile.', {
      status: 500,
      requestId,
    });
  }
}
