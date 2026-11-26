import { requireAuth } from '@/lib/auth/session';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonOk } from '@/lib/http/response';
import { parseJsonBody } from '@/lib/validation/common';
import { assertCanManageFinance } from '@/modules/finance/finance.permissions';
import {
  financeIdSchema,
  updateFeeStructureSchema,
} from '@/modules/finance/finance.schemas';
import {
  getFeeStructureByIdService,
  updateFeeStructureService,
} from '@/modules/finance/finance.service';
import {
  buildAuditMeta,
  handleFinanceError,
  parsePathParam,
  resolveFinanceDb,
} from '../../_lib';

export async function GET(request, context) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const forbidden = assertCanManageFinance(auth.session, requestId);
  if (forbidden) return forbidden;

  const idParam = await parsePathParam(context?.params, 'id', financeIdSchema, requestId);
  if (!idParam.ok) return idParam.response;

  const dbRes = resolveFinanceDb(auth.workerEnv, requestId);
  if (!dbRes.ok) return dbRes.response;

  try {
    const item = await getFeeStructureByIdService(dbRes.db, idParam.value);
    return jsonOk(item, { requestId });
  } catch (err) {
    return handleFinanceError(err, requestId);
  }
}

export async function PATCH(request, context) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const csrfError = assertSameOrigin(request, { workerEnv: auth.workerEnv, requestId });
  if (csrfError) return csrfError;

  const forbidden = assertCanManageFinance(auth.session, requestId);
  if (forbidden) return forbidden;

  const idParam = await parsePathParam(context?.params, 'id', financeIdSchema, requestId);
  if (!idParam.ok) return idParam.response;

  const body = await parseJsonBody(request, updateFeeStructureSchema, requestId);
  if (!body.ok) return body.response;

  const dbRes = resolveFinanceDb(auth.workerEnv, requestId);
  if (!dbRes.ok) return dbRes.response;

  try {
    const updated = await updateFeeStructureService(
      dbRes.db,
      auth.session,
      idParam.value,
      body.data,
      buildAuditMeta(request, requestId)
    );
    return jsonOk(updated, { requestId });
  } catch (err) {
    return handleFinanceError(err, requestId);
  }
}
