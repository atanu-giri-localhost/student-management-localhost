import { requireAuth } from '@/lib/auth/session';
import { createRequestId, jsonOk } from '@/lib/http/response';
import {
  assertCanReadClassTimetable,
  assertCanReadTeacherTimetable,
  assertCanReadTimetableReference,
} from '@/modules/timetable/timetable.permissions';
import { dailyTimetableQuerySchema } from '@/modules/timetable/timetable.schemas';
import { getDailyTimetableService } from '@/modules/timetable/timetable.service';
import {
  handleTimetableError,
  parseQueryParams,
  resolveAcademicsDb,
  resolveStudentsDb,
  resolveTimetableDb,
} from '../_lib';

export async function GET(request) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const forbidden = assertCanReadTimetableReference(auth.session, requestId);
  if (forbidden) return forbidden;

  const query = parseQueryParams(request, dailyTimetableQuerySchema, requestId);
  if (!query.ok) return query.response;

  if (query.data.classId) {
    const academicsDbRes = resolveAcademicsDb(auth.workerEnv, requestId);
    if (!academicsDbRes.ok) return academicsDbRes.response;

    const studentsDbRes = resolveStudentsDb(auth.workerEnv, requestId);
    if (!studentsDbRes.ok) return studentsDbRes.response;

    const classForbidden = await assertCanReadClassTimetable(
      academicsDbRes.db,
      studentsDbRes.db,
      auth.session,
      {
        academicSessionId: query.data.academicSessionId,
        classId: query.data.classId,
      },
      requestId
    );
    if (classForbidden) return classForbidden;
  }

  if (query.data.teacherProfileId) {
    const teacherForbidden = assertCanReadTeacherTimetable(
      auth.session,
      query.data.teacherProfileId,
      requestId
    );
    if (teacherForbidden) return teacherForbidden;
  }

  const dbRes = resolveTimetableDb(auth.workerEnv, requestId);
  if (!dbRes.ok) return dbRes.response;

  try {
    const daily = await getDailyTimetableService(dbRes.db, auth.workerEnv, query.data);
    return jsonOk(daily, { requestId });
  } catch (err) {
    return handleTimetableError(err, requestId);
  }
}
