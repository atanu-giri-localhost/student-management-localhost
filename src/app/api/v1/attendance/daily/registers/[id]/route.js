import { requireAuth } from '@/lib/auth/session';
import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { createRequestId, jsonError, jsonOk } from '@/lib/http/response';
import { assertCanMarkDailyAttendance } from '@/modules/attendance/attendance.permissions';
import { registerIdSchema } from '@/modules/attendance/attendance.schemas';
import {
  AttendanceServiceError,
  getDailyRegisterByIdService,
} from '@/modules/attendance/attendance.service';

export async function GET(request, context) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const params = await context?.params;
  const parsedId = registerIdSchema.safeParse(params?.id);
  if (!parsedId.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid daily attendance register ID.', {
      status: 400,
      requestId,
    });
  }

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

    return jsonOk(register, { requestId });
  } catch (error) {
    if (error instanceof AttendanceServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('DAILY_REGISTER_FETCH_FAILED', 'Unable to fetch daily attendance register.', {
      status: 500,
      requestId,
    });
  }
}
