import { requireAuth } from '@/lib/auth/session';
import { createRequestId, jsonOk } from '@/lib/http/response';
import { uuidSchema } from '@/lib/validation/common';
import { assertCanReadStudentTimetable } from '@/modules/timetable/timetable.permissions';
import { studentTimetableQuerySchema } from '@/modules/timetable/timetable.schemas';
import { getStudentTimetableService } from '@/modules/timetable/timetable.service';
import {
  handleTimetableError,
  parsePathParam,
  parseQueryParams,
  resolveStudentsDb,
  resolveTimetableDb,
} from '../../_lib';

export async function GET(request, context) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const studentIdParam = await parsePathParam(context?.params, 'studentId', uuidSchema, requestId);
  if (!studentIdParam.ok) return studentIdParam.response;

  const studentsDbRes = resolveStudentsDb(auth.workerEnv, requestId);
  if (!studentsDbRes.ok) return studentsDbRes.response;

  const forbidden = await assertCanReadStudentTimetable(
    studentsDbRes.db,
    auth.session,
    studentIdParam.value,
    requestId
  );
  if (forbidden) return forbidden;

  const query = parseQueryParams(request, studentTimetableQuerySchema, requestId);
  if (!query.ok) return query.response;

  const timetableDbRes = resolveTimetableDb(auth.workerEnv, requestId);
  if (!timetableDbRes.ok) return timetableDbRes.response;

  try {
    const timetable = await getStudentTimetableService(
      timetableDbRes.db,
      auth.workerEnv,
      studentIdParam.value,
      query.data
    );
    return jsonOk(timetable, { requestId });
  } catch (err) {
    return handleTimetableError(err, requestId);
  }
}
