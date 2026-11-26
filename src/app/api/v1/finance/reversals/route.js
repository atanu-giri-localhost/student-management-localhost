import { requireAuth } from '@/lib/auth/session';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonOk, jsonPaginated } from '@/lib/http/response';
import { parseJsonBody } from '@/lib/validation/common';
import {
  assertCanManageFinance,
  assertCanReversePayment,
} from '@/modules/finance/finance.permissions';
import {
  createReversalSchema,
  listReversalsQuerySchema,
} from '@/modules/finance/finance.schemas';
import {
  listReversalsService,
  reversePaymentService,
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

  const query = parseQueryParams(request, listReversalsQuerySchema, requestId);
  if (!query.ok) return query.response;

  const dbRes = resolveFinanceDb(auth.workerEnv, requestId);
  if (!dbRes.ok) return dbRes.response;

  try {
    const result = await listReversalsService(dbRes.db, query.data);
    return jsonPaginated(
      result.reversals,
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

  const forbidden = assertCanReversePayment(auth.session, requestId);
  if (forbidden) return forbidden;

  const body = await parseJsonBody(request, createReversalSchema, requestId);
  if (!body.ok) return body.response;

  const dbRes = resolveFinanceDb(auth.workerEnv, requestId);
  if (!dbRes.ok) return dbRes.response;

  try {
    const reversed = await reversePaymentService(
      dbRes.db,
      auth.session,
      body.data,
      buildAuditMeta(request, requestId)
    );
    return jsonOk(reversed, { status: 201, requestId });
  } catch (err) {
    return handleFinanceError(err, requestId);
  }
}
