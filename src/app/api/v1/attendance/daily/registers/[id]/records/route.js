import { getClientIp, requireAuth } from '@/lib/auth/session';
import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonError, jsonOk } from '@/lib/http/response';
import { parseJsonBody } from '@/lib/validation/common';
import { assertCanMarkDailyAttendance } from '@/modules/attendance/attendance.permissions';
import {
  markDailyAttendanceRecordsSchema,
  registerIdSchema,
} from '@/modules/attendance/attendance.schemas';
import {
  AttendanceServiceError,
  getDailyRegisterByIdService,
  markDailyAttendanceRecordsService,
} from '@/modules/attendance/attendance.service';

export async function PUT(request, context) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const csrfError = assertSameOrigin(request, { workerEnv: auth.workerEnv, requestId });
  if (csrfError) return csrfError;

  const params = await context?.params;
  const parsedId = registerIdSchema.safeParse(params?.id);
  if (!parsedId.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid daily attendance register ID.', {
      status: 400,
      requestId,
    });
  }

  const parsedBody = await parseJsonBody(request, markDailyAttendanceRecordsSchema, requestId);
  if (!parsedBody.ok) return parsedBody.response;

  try {
    const dbAttendance = getDomainDb(auth.workerEnv, D1_BINDINGS.ATTENDANCE);
    const register = await getDailyRegisterByIdService(dbAttendance, parsedId.data);

    const dbAcademics = auth.workerEnv?.[D1_BINDINGS.ACADEMICS] ?? null;
    const permissionError = await assertCanMarkDailyAttendance(
      dbAcademics,
      auth.session,
      {
        academicSessionId: register.academicSessionId,
        classId: register.classId,
      },
      requestId
    );
    if (permissionError) return permissionError;

    const updated = await markDailyAttendanceRecordsService(
      dbAttendance,
      auth.workerEnv,
      auth.session,
      parsedId.data,
      parsedBody.data,
      {
        clientIp: getClientIp(request),
        requestId,
      }
    );
    return jsonOk(updated, { requestId });
  } catch (error) {
    if (error instanceof AttendanceServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('DAILY_ATTENDANCE_MARK_FAILED', 'Unable to mark daily attendance records.', {
      status: 500,
      requestId,
    });
  }
}
