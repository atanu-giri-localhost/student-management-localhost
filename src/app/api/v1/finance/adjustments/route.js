import { requireAuth } from '@/lib/auth/session';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonError, jsonOk, jsonPaginated } from '@/lib/http/response';
import { parseJsonBody } from '@/lib/validation/common';
import {
  assertCanManageFinance,
  assertCanReadStudentFinance,
} from '@/modules/finance/finance.permissions';
import {
  createAdjustmentSchema,
  listAdjustmentsQuerySchema,
} from '@/modules/finance/finance.schemas';
import {
  createAdjustmentService,
  listAdjustmentsService,
} from '@/modules/finance/finance.service';
import {
  buildAuditMeta,
  handleFinanceError,
  isParentOnlySession,
  parseQueryParams,
  resolveFinanceDb,
  resolveStudentsDb,
} from '../_lib';

export async function GET(request) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const query = parseQueryParams(request, listAdjustmentsQuerySchema, requestId);
  if (!query.ok) return query.response;

  if (isParentOnlySession(auth.session)) {
    if (!query.data.studentId) {
      return jsonError('FORBIDDEN', 'Parents must filter by an authorized studentId.', {
        status: 403,
        requestId,
      });
    }
    const studentsDbRes = resolveStudentsDb(auth.workerEnv, requestId);
    if (!studentsDbRes.ok) return studentsDbRes.response;
    const forbidden = await assertCanReadStudentFinance(
      studentsDbRes.db,
      auth.session,
      query.data.studentId,
      requestId
    );
    if (forbidden) return forbidden;
  } else {
    const forbidden = assertCanManageFinance(auth.session, requestId);
    if (forbidden) return forbidden;
  }

  const dbRes = resolveFinanceDb(auth.workerEnv, requestId);
  if (!dbRes.ok) return dbRes.response;

  try {
    const result = await listAdjustmentsService(dbRes.db, query.data);
    return jsonPaginated(
      result.adjustments,
      { page: query.data.page, pageSize: query.data.pageSize, total: result.total },
      { requestId }
    );
  } catch (err) {
    return handleFinanceError(err, requestId);
  }
}

export async function POST(request) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const csrfError = assertSameOrigin(request, { workerEnv: auth.workerEnv, requestId });
  if (csrfError) return csrfError;

  const forbidden = assertCanManageFinance(auth.session, requestId);
  if (forbidden) return forbidden;

  const body = await parseJsonBody(request, createAdjustmentSchema, requestId);
  if (!body.ok) return body.response;

  const dbRes = resolveFinanceDb(auth.workerEnv, requestId);
  if (!dbRes.ok) return dbRes.response;

  try {
    const created = await createAdjustmentService(
      dbRes.db,
      auth.workerEnv,
      auth.session,
      body.data,
      buildAuditMeta(request, requestId)
    );
    return jsonOk(created, { status: 201, requestId });
  } catch (err) {
    return handleFinanceError(err, requestId);
  }
}
