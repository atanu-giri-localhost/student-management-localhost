import { requireAuth } from '@/lib/auth/session';
import { createRequestId, jsonOk } from '@/lib/http/response';
import { uuidSchema } from '@/lib/validation/common';
import { assertCanReadTeacherTimetable } from '@/modules/timetable/timetable.permissions';
import { teacherTimetableQuerySchema } from '@/modules/timetable/timetable.schemas';
import { getTeacherTimetableService } from '@/modules/timetable/timetable.service';
import {
  handleTimetableError,
  parsePathParam,
  parseQueryParams,
  resolveTimetableDb,
} from '../../_lib';

export async function GET(request, context) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const teacherIdParam = await parsePathParam(context?.params, 'teacherId', uuidSchema, requestId);
  if (!teacherIdParam.ok) return teacherIdParam.response;

  const forbidden = assertCanReadTeacherTimetable(auth.session, teacherIdParam.value, requestId);
  if (forbidden) return forbidden;

  const query = parseQueryParams(request, teacherTimetableQuerySchema, requestId);
  if (!query.ok) return query.response;

  const dbRes = resolveTimetableDb(auth.workerEnv, requestId);
  if (!dbRes.ok) return dbRes.response;

  try {
    const timetable = await getTeacherTimetableService(
      dbRes.db,
      auth.workerEnv,
      teacherIdParam.value,
      query.data
    );
    return jsonOk(timetable, { requestId });
  } catch (err) {
    return handleTimetableError(err, requestId);
  }
}
