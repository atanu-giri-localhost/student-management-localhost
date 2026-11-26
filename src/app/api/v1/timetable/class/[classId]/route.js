import { requireAuth } from '@/lib/auth/session';
import { createRequestId, jsonOk } from '@/lib/http/response';
import { uuidSchema } from '@/lib/validation/common';
import { assertCanReadClassTimetable } from '@/modules/timetable/timetable.permissions';
import { classTimetableQuerySchema } from '@/modules/timetable/timetable.schemas';
import { getClassTimetableService } from '@/modules/timetable/timetable.service';
import {
  handleTimetableError,
  parsePathParam,
  parseQueryParams,
  resolveAcademicsDb,
  resolveStudentsDb,
  resolveTimetableDb,
} from '../../_lib';

export async function GET(request, context) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const classIdParam = await parsePathParam(context?.params, 'classId', uuidSchema, requestId);
  if (!classIdParam.ok) return classIdParam.response;

  const query = parseQueryParams(request, classTimetableQuerySchema, requestId);
  if (!query.ok) return query.response;

  const academicsDbRes = resolveAcademicsDb(auth.workerEnv, requestId);
  if (!academicsDbRes.ok) return academicsDbRes.response;

  const studentsDbRes = resolveStudentsDb(auth.workerEnv, requestId);
  if (!studentsDbRes.ok) return studentsDbRes.response;

  const forbidden = await assertCanReadClassTimetable(
    academicsDbRes.db,
    studentsDbRes.db,
    auth.session,
    {
      academicSessionId: query.data.academicSessionId,
      classId: classIdParam.value,
    },
    requestId
  );
  if (forbidden) return forbidden;

  const timetableDbRes = resolveTimetableDb(auth.workerEnv, requestId);
  if (!timetableDbRes.ok) return timetableDbRes.response;

  try {
    const timetable = await getClassTimetableService(
      timetableDbRes.db,
      auth.workerEnv,
      classIdParam.value,
      query.data
    );
    return jsonOk(timetable, { requestId });
  } catch (err) {
    return handleTimetableError(err, requestId);
  }
}
