import { getClientIp, requireAuth } from '@/lib/auth/session';
import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonError, jsonOk } from '@/lib/http/response';
import { formatZodIssues } from '@/lib/validation/common';
import { assertCanManageAcademics } from '@/modules/academics/academics.permissions';
import {
  classIdSchema,
  deleteClassSubjectQuerySchema,
  subjectIdSchema,
} from '@/modules/academics/academics.schemas';
import {
  AcademicsServiceError,
  removeClassSubjectService,
} from '@/modules/academics/academics.service';

export async function DELETE(request, context) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const csrfError = assertSameOrigin(request, { workerEnv: auth.workerEnv, requestId });
  if (csrfError) return csrfError;

  const permissionError = assertCanManageAcademics(auth.session, requestId);
  if (permissionError) return permissionError;

  const params = await context?.params;
  const parsedClassId = classIdSchema.safeParse(params?.id);
  const parsedSubjectId = subjectIdSchema.safeParse(params?.subjectId);
  if (!parsedClassId.success || !parsedSubjectId.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid class ID or subject ID.', {
      status: 400,
      requestId,
    });
  }

  const url = new URL(request.url);
  const parsedQuery = deleteClassSubjectQuerySchema.safeParse({
    academicSessionId: url.searchParams.get('academicSessionId') ?? undefined,
  });
  if (!parsedQuery.success) {
    return jsonError('VALIDATION_ERROR', 'academicSessionId query parameter is required.', {
      status: 400,
      details: formatZodIssues(parsedQuery.error),
      requestId,
    });
  }

  try {
    const dbAcademics = getDomainDb(auth.workerEnv, D1_BINDINGS.ACADEMICS);
    const result = await removeClassSubjectService(
      dbAcademics,
      auth.workerEnv,
      auth.session,
      {
        classId: parsedClassId.data,
        subjectId: parsedSubjectId.data,
        academicSessionId: parsedQuery.data.academicSessionId,
      },
      {
        clientIp: getClientIp(request),
        requestId,
      }
    );
    return jsonOk(result, { requestId });
  } catch (error) {
    if (error instanceof AcademicsServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('CLASS_SUBJECT_DELETE_FAILED', 'Unable to remove subject from class.', {
      status: 500,
      requestId,
    });
  }
}
