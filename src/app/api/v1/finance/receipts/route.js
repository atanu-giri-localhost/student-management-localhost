import { requireAuth } from '@/lib/auth/session';
import { createRequestId, jsonPaginated } from '@/lib/http/response';
import { assertCanManageFinance } from '@/modules/finance/finance.permissions';
import { listReceiptsQuerySchema } from '@/modules/finance/finance.schemas';
import { listReceiptsService } from '@/modules/finance/finance.service';
import {
  handleFinanceError,
  parseQueryParams,
  resolveFinanceDb,
} from '../_lib';

export async function GET(request) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const query = parseQueryParams(request, listReceiptsQuerySchema, requestId);
  if (!query.ok) return query.response;

  const forbidden = assertCanManageFinance(auth.session, requestId);
  if (forbidden) return forbidden;

  const dbRes = resolveFinanceDb(auth.workerEnv, requestId);
  if (!dbRes.ok) return dbRes.response;

  try {
    const result = await listReceiptsService(dbRes.db, query.data);
    return jsonPaginated(
      result.receipts,
      { page: query.data.page, pageSize: query.data.pageSize, total: result.total },
      { requestId }
    );
  } catch (err) {
    return handleFinanceError(err, requestId);
  }
}
