import { requireAuth } from '@/lib/auth/session';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonOk } from '@/lib/http/response';
import { parseJsonBody } from '@/lib/validation/common';
import {
  assertCanManageTimetable,
  assertCanReadTimetableReference,
} from '@/modules/timetable/timetable.permissions';
import {
  academicCalendarIdSchema,
  updateAcademicCalendarEntrySchema,
} from '@/modules/timetable/timetable.schemas';
import {
  deleteAcademicCalendarEntryService,
  getAcademicCalendarEntryByIdService,
  updateAcademicCalendarEntryService,
} from '@/modules/timetable/timetable.service';
import {
  buildAuditMeta,
  handleTimetableError,
  parsePathParam,
  resolveTimetableDb,
} from '../../_lib';

export async function GET(request, context) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const forbidden = assertCanReadTimetableReference(auth.session, requestId);
  if (forbidden) return forbidden;

  const idParam = await parsePathParam(context?.params, 'id', academicCalendarIdSchema, requestId);
  if (!idParam.ok) return idParam.response;

  const dbRes = resolveTimetableDb(auth.workerEnv, requestId);
  if (!dbRes.ok) return dbRes.response;

  try {
    const entry = await getAcademicCalendarEntryByIdService(dbRes.db, idParam.value);
    return jsonOk(entry, { requestId });
  } catch (err) {
    return handleTimetableError(err, requestId);
  }
}

export async function PATCH(request, context) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const csrfError = assertSameOrigin(request, { workerEnv: auth.workerEnv, requestId });
  if (csrfError) return csrfError;

  const forbidden = assertCanManageTimetable(auth.session, requestId);
  if (forbidden) return forbidden;

  const idParam = await parsePathParam(context?.params, 'id', academicCalendarIdSchema, requestId);
  if (!idParam.ok) return idParam.response;

  const body = await parseJsonBody(request, updateAcademicCalendarEntrySchema, requestId);
  if (!body.ok) return body.response;

  const dbRes = resolveTimetableDb(auth.workerEnv, requestId);
  if (!dbRes.ok) return dbRes.response;

  try {
    const updated = await updateAcademicCalendarEntryService(
      dbRes.db,
      auth.workerEnv,
      auth.session,
      idParam.value,
      body.data,
      buildAuditMeta(request, requestId)
    );
    return jsonOk(updated, { requestId });
  } catch (err) {
    return handleTimetableError(err, requestId);
  }
}

export async function DELETE(request, context) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const csrfError = assertSameOrigin(request, { workerEnv: auth.workerEnv, requestId });
  if (csrfError) return csrfError;

  const forbidden = assertCanManageTimetable(auth.session, requestId);
  if (forbidden) return forbidden;

  const idParam = await parsePathParam(context?.params, 'id', academicCalendarIdSchema, requestId);
  if (!idParam.ok) return idParam.response;

  const dbRes = resolveTimetableDb(auth.workerEnv, requestId);
  if (!dbRes.ok) return dbRes.response;

  try {
    const result = await deleteAcademicCalendarEntryService(
      dbRes.db,
      auth.workerEnv,
      auth.session,
      idParam.value,
      buildAuditMeta(request, requestId)
    );
    return jsonOk(result, { requestId });
  } catch (err) {
    return handleTimetableError(err, requestId);
  }
}
