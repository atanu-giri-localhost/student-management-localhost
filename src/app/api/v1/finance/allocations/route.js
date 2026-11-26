import { requireAuth } from '@/lib/auth/session';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonOk, jsonPaginated } from '@/lib/http/response';
import { parseJsonBody } from '@/lib/validation/common';
import { assertCanManageFinance } from '@/modules/finance/finance.permissions';
import {
  createAllocationSchema,
  listAllocationsQuerySchema,
} from '@/modules/finance/finance.schemas';
import {
  createAllocationService,
  listAllocationsService,
} from '@/modules/finance/finance.service';
import {
  buildAuditMeta,
  handleFinanceError,
  parseQueryParams,
  resolveFinanceDb,
} from '../_lib';

export async function GET(request) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const forbidden = assertCanManageFinance(auth.session, requestId);
  if (forbidden) return forbidden;

  const query = parseQueryParams(request, listAllocationsQuerySchema, requestId);
  if (!query.ok) return query.response;

  const dbRes = resolveFinanceDb(auth.workerEnv, requestId);
  if (!dbRes.ok) return dbRes.response;

  try {
    const result = await listAllocationsService(dbRes.db, query.data);
    return jsonPaginated(
      result.allocations,
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

  const body = await parseJsonBody(request, createAllocationSchema, requestId);
  if (!body.ok) return body.response;

  const dbRes = resolveFinanceDb(auth.workerEnv, requestId);
  if (!dbRes.ok) return dbRes.response;

  try {
    const created = await createAllocationService(
      dbRes.db,
      auth.session,
      body.data,
      buildAuditMeta(request, requestId)
    );
    return jsonOk(created, { status: 201, requestId });
  } catch (err) {
    return handleFinanceError(err, requestId);
  }
}
