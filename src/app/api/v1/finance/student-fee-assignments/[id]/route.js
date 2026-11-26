import { requireAuth } from '@/lib/auth/session';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonOk } from '@/lib/http/response';
import { parseJsonBody } from '@/lib/validation/common';
import {
  assertCanManageFinance,
  assertCanReadStudentFinance,
} from '@/modules/finance/finance.permissions';
import {
  financeIdSchema,
  updateStudentFeeAssignmentSchema,
} from '@/modules/finance/finance.schemas';
import {
  getStudentFeeAssignmentByIdService,
  updateStudentFeeAssignmentService,
} from '@/modules/finance/finance.service';
import {
  buildAuditMeta,
  handleFinanceError,
  isParentOnlySession,
  parsePathParam,
  resolveFinanceDb,
  resolveStudentsDb,
} from '../../_lib';

export async function GET(request, context) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const parentOnly = isParentOnlySession(auth.session);
  if (!parentOnly) {
    const forbidden = assertCanManageFinance(auth.session, requestId);
    if (forbidden) return forbidden;
  }

  const idParam = await parsePathParam(context?.params, 'id', financeIdSchema, requestId);
  if (!idParam.ok) return idParam.response;

  const dbRes = resolveFinanceDb(auth.workerEnv, requestId);
  if (!dbRes.ok) return dbRes.response;

  try {
    const item = await getStudentFeeAssignmentByIdService(dbRes.db, idParam.value);
    if (parentOnly) {
      const studentsDbRes = resolveStudentsDb(auth.workerEnv, requestId);
      if (!studentsDbRes.ok) return studentsDbRes.response;
      const forbidden = await assertCanReadStudentFinance(
        studentsDbRes.db,
        auth.session,
        item.studentId,
        requestId
      );
      if (forbidden) return forbidden;
    }
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

  const body = await parseJsonBody(request, updateStudentFeeAssignmentSchema, requestId);
  if (!body.ok) return body.response;

  const dbRes = resolveFinanceDb(auth.workerEnv, requestId);
  if (!dbRes.ok) return dbRes.response;

  try {
    const updated = await updateStudentFeeAssignmentService(
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
