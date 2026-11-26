import { getClientIp, requireAuth } from '@/lib/auth/session';
import { D1_BINDINGS, getDomainDb, getStorage } from '@/lib/cloudflare/bindings';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonError, jsonOk } from '@/lib/http/response';
import { formatZodIssues } from '@/lib/validation/common';
import { assertCanUploadFile } from '@/modules/files/files.permissions';
import { uploadFileFieldsSchema } from '@/modules/files/files.schemas';
import { FilesServiceError, uploadFileService } from '@/modules/files/files.service';

export async function POST(request) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const csrfError = assertSameOrigin(request, { workerEnv: auth.workerEnv, requestId });
  if (csrfError) return csrfError;

  const permissionError = assertCanUploadFile(auth.session, requestId);
  if (permissionError) return permissionError;

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError('VALIDATION_ERROR', 'Expected multipart/form-data upload.', {
      status: 400,
      requestId,
    });
  }

  const file = formData.get('file');
  if (!file || typeof file.arrayBuffer !== 'function') {
    return jsonError('VALIDATION_ERROR', 'A file field is required.', {
      status: 400,
      requestId,
    });
  }

  const fields = {
    category: formData.get('category'),
    ownerEntityType: formData.get('ownerEntityType') || undefined,
    ownerEntityId: formData.get('ownerEntityId') || undefined,
  };
  const parsedFields = uploadFileFieldsSchema.safeParse(fields);
  if (!parsedFields.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid file upload metadata.', {
      status: 400,
      details: formatZodIssues(parsedFields.error),
      requestId,
    });
  }

  try {
    const dbStudents = getDomainDb(auth.workerEnv, D1_BINDINGS.STUDENTS);
    const storage = getStorage(auth.workerEnv);
    const fileBytes = await file.arrayBuffer();

    const dto = await uploadFileService(
      dbStudents,
      storage,
      auth.session,
      {
        fileBytes,
        declaredMime: file.type || null,
        category: parsedFields.data.category,
        ownerEntityType: parsedFields.data.ownerEntityType ?? null,
        ownerEntityId: parsedFields.data.ownerEntityId ?? null,
      },
      { clientIp: getClientIp(request), requestId }
    );

    return jsonOk(dto, { status: 201, requestId });
  } catch (error) {
    if (error instanceof FilesServiceError) {
      return jsonError(error.code, error.message, { status: error.status, requestId });
    }
    return jsonError('FILE_UPLOAD_FAILED', 'Unable to upload file.', { status: 500, requestId });
  }
}
