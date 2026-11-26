import { getClientIp, requireAuth } from '@/lib/auth/session';
import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonError, jsonOk, jsonPaginated } from '@/lib/http/response';
import { formatZodIssues, parseJsonBody } from '@/lib/validation/common';
import { assertCanCorrectAttendance } from '@/modules/attendance/attendance.permissions';
import {
  createAttendanceCorrectionSchema,
  listAttendanceCorrectionsQuerySchema,
} from '@/modules/attendance/attendance.schemas';
import {
  AttendanceServiceError,
  createAttendanceCorrectionService,
  listAttendanceCorrectionsService,
} from '@/modules/attendance/attendance.service';

export async function GET(request) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const permissionError = assertCanCorrectAttendance(auth.session, requestId);
  if (permissionError) return permissionError;

  const sp = new URL(request.url).searchParams;
  const parsedQuery = listAttendanceCorrectionsQuerySchema.safeParse({
    page: sp.get('page') ?? undefined,
    pageSize: sp.get('pageSize') ?? undefined,
    registerType: sp.get('registerType') ?? undefined,
    registerId: sp.get('registerId') ?? undefined,
    recordId: sp.get('recordId') ?? undefined,
    enrollmentId: sp.get('enrollmentId') ?? undefined,
  });
  if (!parsedQuery.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid attendance correction query parameters.', {
      status: 400,
      details: formatZodIssues(parsedQuery.error),
      requestId,
    });
  }

  try {
    const dbAttendance = getDomainDb(auth.workerEnv, D1_BINDINGS.ATTENDANCE);
    const { corrections, total } = await listAttendanceCorrectionsService(
      dbAttendance,
      parsedQuery.data
    );
    return jsonPaginated(
      corrections,
      { page: parsedQuery.data.page, pageSize: parsedQuery.data.pageSize, total },
      { requestId }
    );
  } catch (error) {
    if (error instanceof AttendanceServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('ATTENDANCE_CORRECTION_LIST_FAILED', 'Unable to list attendance corrections.', {
      status: 500,
      requestId,
    });
  }
}

export async function POST(request) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const csrfError = assertSameOrigin(request, { workerEnv: auth.workerEnv, requestId });
  if (csrfError) return csrfError;

  const permissionError = assertCanCorrectAttendance(auth.session, requestId);
  if (permissionError) return permissionError;

  const parsed = await parseJsonBody(request, createAttendanceCorrectionSchema, requestId);
  if (!parsed.ok) return parsed.response;

  try {
    const dbAttendance = getDomainDb(auth.workerEnv, D1_BINDINGS.ATTENDANCE);
    const correction = await createAttendanceCorrectionService(
      dbAttendance,
      auth.session,
      parsed.data,
      {
        clientIp: getClientIp(request),
        requestId,
      }
    );
    return jsonOk(correction, { status: 201, requestId });
  } catch (error) {
    if (error instanceof AttendanceServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('ATTENDANCE_CORRECTION_FAILED', 'Unable to create attendance correction.', {
      status: 500,
      requestId,
    });
  }
}
