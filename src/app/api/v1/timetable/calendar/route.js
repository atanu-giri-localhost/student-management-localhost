import { requireAuth } from '@/lib/auth/session';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonOk, jsonPaginated } from '@/lib/http/response';
import { parseJsonBody } from '@/lib/validation/common';
import {
  assertCanManageTimetable,
  assertCanReadTimetableReference,
} from '@/modules/timetable/timetable.permissions';
import {
  createAcademicCalendarEntrySchema,
  listAcademicCalendarQuerySchema,
} from '@/modules/timetable/timetable.schemas';
import {
  createAcademicCalendarEntryService,
  listAcademicCalendarService,
} from '@/modules/timetable/timetable.service';
import {
  buildAuditMeta,
  handleTimetableError,
  parseQueryParams,
  resolveTimetableDb,
} from '../_lib';

export async function GET(request) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const forbidden = assertCanReadTimetableReference(auth.session, requestId);
  if (forbidden) return forbidden;

  const query = parseQueryParams(request, listAcademicCalendarQuerySchema, requestId);
  if (!query.ok) return query.response;

  const dbRes = resolveTimetableDb(auth.workerEnv, requestId);
  if (!dbRes.ok) return dbRes.response;

  try {
    const result = await listAcademicCalendarService(dbRes.db, query.data);
    return jsonPaginated(
      result.items,
      { page: query.data.page, pageSize: query.data.pageSize, total: result.total },
      { requestId }
    );
  } catch (err) {
    return handleTimetableError(err, requestId);
  }
}

export async function POST(request) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const csrfError = assertSameOrigin(request, { workerEnv: auth.workerEnv, requestId });
  if (csrfError) return csrfError;

  const forbidden = assertCanManageTimetable(auth.session, requestId);
  if (forbidden) return forbidden;

  const body = await parseJsonBody(request, createAcademicCalendarEntrySchema, requestId);
  if (!body.ok) return body.response;

  const dbRes = resolveTimetableDb(auth.workerEnv, requestId);
  if (!dbRes.ok) return dbRes.response;

  try {
    const created = await createAcademicCalendarEntryService(
      dbRes.db,
      auth.workerEnv,
      auth.session,
      body.data,
      buildAuditMeta(request, requestId)
    );
    return jsonOk(created, { status: 201, requestId });
  } catch (err) {
    return handleTimetableError(err, requestId);
  }
}
