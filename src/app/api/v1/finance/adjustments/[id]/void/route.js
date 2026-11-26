import { requireAuth } from '@/lib/auth/session';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonOk } from '@/lib/http/response';
import { parseJsonBody } from '@/lib/validation/common';
import { assertCanManageFinance } from '@/modules/finance/finance.permissions';
import {
  financeIdSchema,
  voidAdjustmentSchema,
} from '@/modules/finance/finance.schemas';
import { voidAdjustmentService } from '@/modules/finance/finance.service';
import {
  buildAuditMeta,
  handleFinanceError,
  parsePathParam,
  resolveFinanceDb,
} from '../../../_lib';

export async function POST(request, context) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const csrfError = assertSameOrigin(request, { workerEnv: auth.workerEnv, requestId });
  if (csrfError) return csrfError;

  const forbidden = assertCanManageFinance(auth.session, requestId);
  if (forbidden) return forbidden;

  const idParam = await parsePathParam(context?.params, 'id', financeIdSchema, requestId);
  if (!idParam.ok) return idParam.response;

  const body = await parseJsonBody(request, voidAdjustmentSchema, requestId);
  if (!body.ok) return body.response;

  const dbRes = resolveFinanceDb(auth.workerEnv, requestId);
  if (!dbRes.ok) return dbRes.response;

  try {
    const voided = await voidAdjustmentService(
      dbRes.db,
      auth.session,
      idParam.value,
      body.data.voidReason,
      buildAuditMeta(request, requestId)
    );
    return jsonOk(voided, { requestId });
  } catch (err) {
    return handleFinanceError(err, requestId);
  }
}
