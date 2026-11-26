import { getClientIp, requireAuth } from '@/lib/auth/session';
import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonError, jsonOk, jsonPaginated } from '@/lib/http/response';
import { formatZodIssues, parseJsonBody } from '@/lib/validation/common';
import {
  assertCanManageAttendance,
  assertCanMarkPeriodAttendance,
} from '@/modules/attendance/attendance.permissions';
import {
  createPeriodRegisterSchema,
  listPeriodRegistersQuerySchema,
} from '@/modules/attendance/attendance.schemas';
import {
  AttendanceServiceError,
  createPeriodRegisterService,
  listPeriodRegistersService,
} from '@/modules/attendance/attendance.service';

export async function GET(request) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const sp = url.searchParams;
  const parsedQuery = listPeriodRegistersQuerySchema.safeParse({
    page: sp.get('page') ?? undefined,
    pageSize: sp.get('pageSize') ?? undefined,
    academicSessionId: sp.get('academicSessionId') ?? undefined,
    classId: sp.get('classId') ?? undefined,
    subjectId: sp.get('subjectId') ?? undefined,
    attendanceDate: sp.get('attendanceDate') ?? undefined,
    fromDate: sp.get('fromDate') ?? undefined,
    toDate: sp.get('toDate') ?? undefined,
    periodNumber: sp.get('periodNumber') ?? undefined,
    isLocked: sp.get('isLocked') ?? undefined,
  });
  if (!parsedQuery.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid period register list query parameters.', {
      status: 400,
      details: formatZodIssues(parsedQuery.error),
      requestId,
    });
  }

  const dbAcademics = auth.workerEnv?.[D1_BINDINGS.ACADEMICS] ?? null;
  const permissionError =
    parsedQuery.data.academicSessionId && parsedQuery.data.classId && parsedQuery.data.subjectId
      ? await assertCanMarkPeriodAttendance(
          dbAcademics,
          auth.session,
          {
            academicSessionId: parsedQuery.data.academicSessionId,
            classId: parsedQuery.data.classId,
            subjectId: parsedQuery.data.subjectId,
          },
          requestId
        )
      : assertCanManageAttendance(auth.session, requestId);
  if (permissionError) return permissionError;

  try {
    const dbAttendance = getDomainDb(auth.workerEnv, D1_BINDINGS.ATTENDANCE);
    const { registers, total } = await listPeriodRegistersService(dbAttendance, parsedQuery.data);
    return jsonPaginated(
      registers,
      { page: parsedQuery.data.page, pageSize: parsedQuery.data.pageSize, total },
      { requestId }
    );
  } catch (error) {
    if (error instanceof AttendanceServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('PERIOD_REGISTER_LIST_FAILED', 'Unable to list period attendance registers.', {
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

  const parsed = await parseJsonBody(request, createPeriodRegisterSchema, requestId);
  if (!parsed.ok) return parsed.response;

  const dbAcademics = auth.workerEnv?.[D1_BINDINGS.ACADEMICS] ?? null;
  const permissionError = await assertCanMarkPeriodAttendance(
    dbAcademics,
    auth.session,
    {
      academicSessionId: parsed.data.academicSessionId,
      classId: parsed.data.classId,
      subjectId: parsed.data.subjectId,
    },
    requestId
  );
  if (permissionError) return permissionError;

  try {
    const dbAttendance = getDomainDb(auth.workerEnv, D1_BINDINGS.ATTENDANCE);
    const register = await createPeriodRegisterService(
      dbAttendance,
      auth.workerEnv,
      auth.session,
      parsed.data,
      {
        clientIp: getClientIp(request),
        requestId,
      }
    );
    return jsonOk(register, { status: 201, requestId });
  } catch (error) {
    if (error instanceof AttendanceServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('PERIOD_REGISTER_CREATE_FAILED', 'Unable to create period attendance register.', {
      status: 500,
      requestId,
    });
  }
}
