import { requireAuth } from '@/lib/auth/session';
import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { createRequestId, jsonError, jsonPaginated } from '@/lib/http/response';
import { formatZodIssues } from '@/lib/validation/common';
import {
  assertCanManageAttendance,
  assertCanMarkDailyAttendance,
  assertCanMarkPeriodAttendance,
} from '@/modules/attendance/attendance.permissions';
import { attendanceSummaryQuerySchema } from '@/modules/attendance/attendance.schemas';
import {
  AttendanceServiceError,
  getAttendanceSummaryService,
} from '@/modules/attendance/attendance.service';

export async function GET(request) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const sp = new URL(request.url).searchParams;
  const parsedQuery = attendanceSummaryQuerySchema.safeParse({
    page: sp.get('page') ?? undefined,
    pageSize: sp.get('pageSize') ?? undefined,
    academicSessionId: sp.get('academicSessionId') ?? undefined,
    classId: sp.get('classId') ?? undefined,
    subjectId: sp.get('subjectId') ?? undefined,
    registerType: sp.get('registerType') ?? undefined,
    fromDate: sp.get('fromDate') ?? undefined,
    toDate: sp.get('toDate') ?? undefined,
  });
  if (!parsedQuery.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid attendance summary query parameters.', {
      status: 400,
      details: formatZodIssues(parsedQuery.error),
      requestId,
    });
  }

  const dbAcademics = auth.workerEnv?.[D1_BINDINGS.ACADEMICS] ?? null;
  let permissionError = null;
  if (parsedQuery.data.classId) {
    if (parsedQuery.data.registerType === 'PERIOD' && parsedQuery.data.subjectId) {
      permissionError = await assertCanMarkPeriodAttendance(
        dbAcademics,
        auth.session,
        {
          academicSessionId: parsedQuery.data.academicSessionId,
          classId: parsedQuery.data.classId,
          subjectId: parsedQuery.data.subjectId,
        },
        requestId
      );
    } else {
      permissionError = await assertCanMarkDailyAttendance(
        dbAcademics,
        auth.session,
        {
          academicSessionId: parsedQuery.data.academicSessionId,
          classId: parsedQuery.data.classId,
        },
        requestId
      );
    }
  } else {
    permissionError = assertCanManageAttendance(auth.session, requestId);
  }
  if (permissionError) return permissionError;

  try {
    const dbAttendance = getDomainDb(auth.workerEnv, D1_BINDINGS.ATTENDANCE);
    const { summaries, total } = await getAttendanceSummaryService(dbAttendance, parsedQuery.data);
    return jsonPaginated(
      summaries,
      { page: parsedQuery.data.page, pageSize: parsedQuery.data.pageSize, total },
      { requestId }
    );
  } catch (error) {
    if (error instanceof AttendanceServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('ATTENDANCE_SUMMARY_FAILED', 'Unable to fetch attendance summary.', {
      status: 500,
      requestId,
    });
  }
}
