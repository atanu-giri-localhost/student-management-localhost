import { requireAuth } from '@/lib/auth/session';
import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { createRequestId, jsonError, jsonOk } from '@/lib/http/response';
import { assertCanMarkPeriodAttendance } from '@/modules/attendance/attendance.permissions';
import { registerIdSchema } from '@/modules/attendance/attendance.schemas';
import {
  AttendanceServiceError,
  getPeriodRegisterByIdService,
} from '@/modules/attendance/attendance.service';

export async function GET(request, context) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const params = await context?.params;
  const parsedId = registerIdSchema.safeParse(params?.id);
  if (!parsedId.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid period attendance register ID.', {
      status: 400,
      requestId,
    });
  }

  try {
    const dbAttendance = getDomainDb(auth.workerEnv, D1_BINDINGS.ATTENDANCE);
    const register = await getPeriodRegisterByIdService(dbAttendance, parsedId.data);

    const dbAcademics = auth.workerEnv?.[D1_BINDINGS.ACADEMICS] ?? null;
    const permissionError = await assertCanMarkPeriodAttendance(
      dbAcademics,
      auth.session,
      {
        academicSessionId: register.academicSessionId,
        classId: register.classId,
        subjectId: register.subjectId,
      },
      requestId
    );
    if (permissionError) return permissionError;

    return jsonOk(register, { requestId });
  } catch (error) {
    if (error instanceof AttendanceServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('PERIOD_REGISTER_FETCH_FAILED', 'Unable to fetch period attendance register.', {
      status: 500,
      requestId,
    });
  }
}
