import { requireAuth } from '@/lib/auth/session';
import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { createRequestId, jsonError, jsonPaginated } from '@/lib/http/response';
import { formatZodIssues, uuidSchema } from '@/lib/validation/common';
import { assertCanReadStudentAttendance } from '@/modules/attendance/attendance.permissions';
import { studentAttendanceQuerySchema } from '@/modules/attendance/attendance.schemas';
import {
  AttendanceServiceError,
  getStudentAttendanceService,
} from '@/modules/attendance/attendance.service';

export async function GET(request, context) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const params = await context?.params;
  const parsedStudentId = uuidSchema.safeParse(params?.studentId);
  if (!parsedStudentId.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid student ID.', { status: 400, requestId });
  }

  const dbStudents = auth.workerEnv?.[D1_BINDINGS.STUDENTS] ?? null;
  const permissionError = await assertCanReadStudentAttendance(
    dbStudents,
    auth.session,
    parsedStudentId.data,
    requestId
  );
  if (permissionError) return permissionError;

  const sp = new URL(request.url).searchParams;
  const parsedQuery = studentAttendanceQuerySchema.safeParse({
    page: sp.get('page') ?? undefined,
    pageSize: sp.get('pageSize') ?? undefined,
    academicSessionId: sp.get('academicSessionId') ?? undefined,
    registerType: sp.get('registerType') ?? undefined,
    fromDate: sp.get('fromDate') ?? undefined,
    toDate: sp.get('toDate') ?? undefined,
  });
  if (!parsedQuery.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid student attendance query parameters.', {
      status: 400,
      details: formatZodIssues(parsedQuery.error),
      requestId,
    });
  }

  try {
    const dbAttendance = getDomainDb(auth.workerEnv, D1_BINDINGS.ATTENDANCE);
    const { records, total } = await getStudentAttendanceService(
      dbAttendance,
      auth.workerEnv,
      parsedStudentId.data,
      parsedQuery.data
    );
    return jsonPaginated(
      records,
      { page: parsedQuery.data.page, pageSize: parsedQuery.data.pageSize, total },
      { requestId }
    );
  } catch (error) {
    if (error instanceof AttendanceServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('STUDENT_ATTENDANCE_FETCH_FAILED', 'Unable to fetch student attendance.', {
      status: 500,
      requestId,
    });
  }
}
