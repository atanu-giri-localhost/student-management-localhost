import { requireAuth } from '@/lib/auth/session';
import { createRequestId, jsonOk } from '@/lib/http/response';
import { assertCanReadStudentFinance } from '@/modules/finance/finance.permissions';
import { financeIdSchema } from '@/modules/finance/finance.schemas';
import { getStudentBalanceService } from '@/modules/finance/finance.service';
import {
  handleFinanceError,
  parsePathParam,
  resolveFinanceDb,
  resolveStudentsDb,
} from '../../../_lib';

export async function GET(request, context) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const studentIdParam = await parsePathParam(
    context?.params,
    'studentId',
    financeIdSchema,
    requestId
  );
  if (!studentIdParam.ok) return studentIdParam.response;

  const studentsDbRes = resolveStudentsDb(auth.workerEnv, requestId);
  if (!studentsDbRes.ok) return studentsDbRes.response;

  const forbidden = await assertCanReadStudentFinance(
    studentsDbRes.db,
    auth.session,
    studentIdParam.value,
    requestId
  );
  if (forbidden) return forbidden;

  const dbRes = resolveFinanceDb(auth.workerEnv, requestId);
  if (!dbRes.ok) return dbRes.response;

  try {
    const summary = await getStudentBalanceService(
      dbRes.db,
      auth.workerEnv,
      studentIdParam.value
    );
    return jsonOk(summary, { requestId });
  } catch (err) {
    return handleFinanceError(err, requestId);
  }
}
