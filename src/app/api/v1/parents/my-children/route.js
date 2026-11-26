import { requireAuth } from '@/lib/auth/session';
import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { createRequestId, jsonOk } from '@/lib/http/response';
import { assertIsAuthenticatedParent } from '@/modules/parents/parents.permissions';
import { getMyChildrenService } from '@/modules/parents/parents.service';

export async function GET(request) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const permissionError = assertIsAuthenticatedParent(auth.session, requestId);
  if (permissionError) return permissionError;

  const dbStudents = getDomainDb(auth.workerEnv, D1_BINDINGS.STUDENTS);
  const children = await getMyChildrenService(dbStudents, auth.session.profiles.parentProfileId);

  return jsonOk(children, { requestId });
}
