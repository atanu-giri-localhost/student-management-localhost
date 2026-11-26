import { getClientIp, requireAuth } from '@/lib/auth/session';
import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonError, jsonOk, jsonPaginated } from '@/lib/http/response';
import { formatZodIssues, parseJsonBody } from '@/lib/validation/common';
import {
  assertCanManageAttendance,
  assertCanMarkDailyAttendance,
} from '@/modules/attendance/attendance.permissions';
import {
  createDailyRegisterSchema,
  getDailyRegisterByScopeQuerySchema,
  listDailyRegistersQuerySchema,
} from '@/modules/attendance/attendance.schemas';
import {
  AttendanceServiceError,
  createDailyRegisterService,
  getDailyRegisterByScopeService,
  listDailyRegistersService,
} from '@/modules/attendance/attendance.service';

export async function GET(request) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const sp = url.searchParams;
  const isScopeLookup =
    sp.has('academicSessionId') &&
    sp.has('classId') &&
    sp.has('attendanceDate') &&
    !sp.has('page') &&
    !sp.has('pageSize') &&
    !sp.has('fromDate') &&
    !sp.has('toDate') &&
    !sp.has('isLocked');

  const dbAcademics = auth.workerEnv?.[D1_BINDINGS.ACADEMICS] ?? null;

  if (isScopeLookup) {
    const parsedScope = getDailyRegisterByScopeQuerySchema.safeParse({
      academicSessionId: sp.get('academicSessionId') ?? undefined,
      classId: sp.get('classId') ?? undefined,
      attendanceDate: sp.get('attendanceDate') ?? undefined,
    });
    if (!parsedScope.success) {
      return jsonError('VALIDATION_ERROR', 'Invalid daily attendance register scope parameters.', {
        status: 400,
        details: formatZodIssues(parsedScope.error),
        requestId,
      });
    }

    const permissionError = await assertCanMarkDailyAttendance(
      dbAcademics,
      auth.session,
      {
        academicSessionId: parsedScope.data.academicSessionId,
        classId: parsedScope.data.classId,
      },
      requestId
    );
    if (permissionError) return permissionError;

    try {
      const dbAttendance = getDomainDb(auth.workerEnv, D1_BINDINGS.ATTENDANCE);
      const register = await getDailyRegisterByScopeService(dbAttendance, parsedScope.data);
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

  const parsedQuery = listDailyRegistersQuerySchema.safeParse({
    page: sp.get('page') ?? undefined,
    pageSize: sp.get('pageSize') ?? undefined,
    academicSessionId: sp.get('academicSessionId') ?? undefined,
    classId: sp.get('classId') ?? undefined,
    attendanceDate: sp.get('attendanceDate') ?? undefined,
    fromDate: sp.get('fromDate') ?? undefined,
    toDate: sp.get('toDate') ?? undefined,
    isLocked: sp.get('isLocked') ?? undefined,
  });
  if (!parsedQuery.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid daily register list query parameters.', {
      status: 400,
      details: formatZodIssues(parsedQuery.error),
      requestId,
    });
  }

  const permissionError =
    parsedQuery.data.academicSessionId && parsedQuery.data.classId
      ? await assertCanMarkDailyAttendance(
          dbAcademics,
          auth.session,
          {
            academicSessionId: parsedQuery.data.academicSessionId,
            classId: parsedQuery.data.classId,
          },
          requestId
        )
      : assertCanManageAttendance(auth.session, requestId);
  if (permissionError) return permissionError;

  try {
    const dbAttendance = getDomainDb(auth.workerEnv, D1_BINDINGS.ATTENDANCE);
    const { registers, total } = await listDailyRegistersService(dbAttendance, parsedQuery.data);
    return jsonPaginated(
      registers,
      { page: parsedQuery.data.page, pageSize: parsedQuery.data.pageSize, total },
      { requestId }
    );
  } catch (error) {
    if (error instanceof AttendanceServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('DAILY_REGISTER_LIST_FAILED', 'Unable to list daily attendance registers.', {
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

  const parsed = await parseJsonBody(request, createDailyRegisterSchema, requestId);
  if (!parsed.ok) return parsed.response;

  const dbAcademics = auth.workerEnv?.[D1_BINDINGS.ACADEMICS] ?? null;
  const permissionError = await assertCanMarkDailyAttendance(
    dbAcademics,
    auth.session,
    {
      academicSessionId: parsed.data.academicSessionId,
      classId: parsed.data.classId,
    },
    requestId
  );
  if (permissionError) return permissionError;

  try {
    const dbAttendance = getDomainDb(auth.workerEnv, D1_BINDINGS.ATTENDANCE);
    const register = await createDailyRegisterService(
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
    return jsonError('DAILY_REGISTER_CREATE_FAILED', 'Unable to create daily attendance register.', {
      status: 500,
      requestId,
    });
  }
}
