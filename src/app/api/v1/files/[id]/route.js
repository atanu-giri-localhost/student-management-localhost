import { getClientIp, requireAuth } from '@/lib/auth/session';
import { D1_BINDINGS, getDomainDb, getStorage } from '@/lib/cloudflare/bindings';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonError, jsonOk } from '@/lib/http/response';
import { assertCanDeleteFile, assertCanReadFile } from '@/modules/files/files.permissions';
import { fileIdSchema } from '@/modules/files/files.schemas';
import {
  deleteFileService,
  downloadFileFromStorage,
  FilesServiceError,
  getFileRecordOrThrow,
  toPublicFileDto,
} from '@/modules/files/files.service';

export async function GET(request, context) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const params = await context?.params;
  const parsedId = fileIdSchema.safeParse(params?.id);
  if (!parsedId.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid file ID.', { status: 400, requestId });
  }

  try {
    const dbStudents = getDomainDb(auth.workerEnv, D1_BINDINGS.STUDENTS);
    const fileRecord = await getFileRecordOrThrow(dbStudents, parsedId.data);

    const permissionError = await assertCanReadFile(
      auth.session,
      fileRecord,
      dbStudents,
      requestId
    );
    if (permissionError) return permissionError;

    const url = new URL(request.url);
    if (url.searchParams.get('meta') === '1') {
      return jsonOk(toPublicFileDto(fileRecord), { requestId });
    }

    const storage = getStorage(auth.workerEnv);
    const { bytes, mimeType } = await downloadFileFromStorage(storage, fileRecord);

    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Request-Id': requestId,
      },
    });
  } catch (error) {
    if (error instanceof FilesServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('FILE_FETCH_FAILED', 'Unable to retrieve file.', { status: 500, requestId });
  }
}

export async function DELETE(request, context) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const csrfError = assertSameOrigin(request, { workerEnv: auth.workerEnv, requestId });
  if (csrfError) return csrfError;

  const permissionError = assertCanDeleteFile(auth.session, requestId);
  if (permissionError) return permissionError;

  const params = await context?.params;
  const parsedId = fileIdSchema.safeParse(params?.id);
  if (!parsedId.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid file ID.', { status: 400, requestId });
  }

  try {
    const dbStudents = getDomainDb(auth.workerEnv, D1_BINDINGS.STUDENTS);
    const storage = getStorage(auth.workerEnv);
    const result = await deleteFileService(dbStudents, storage, auth.session, parsedId.data, {
      clientIp: getClientIp(request),
      requestId,
    });
    return jsonOk(result, { requestId });
  } catch (error) {
    if (error instanceof FilesServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('FILE_DELETE_FAILED', 'Unable to delete file.', { status: 500, requestId });
  }
}
