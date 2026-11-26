import { nowIso } from '@/lib/dates/format';
import { createAuditOutboxStatement } from '@/modules/audit/audit.service';
import {
  deleteFileObjectBatch,
  findFileObjectById,
  insertFileObjectBatch,
} from '@/modules/files/files.repository';
import {
  detectMimeFromMagicBytes,
  MAX_FILE_SIZE_BYTES,
  MIME_TO_EXT,
} from '@/modules/files/files.schemas';

export class FilesServiceError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {number} status
   */
  constructor(code, message, status) {
    super(message);
    this.name = 'FilesServiceError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Strip internal R2 object key from public API responses.
 */
export function toPublicFileDto(fileRecord) {
  return {
    id: fileRecord.id,
    category: fileRecord.category,
    mimeType: fileRecord.mimeType,
    sizeBytes: fileRecord.sizeBytes,
    ownerEntityType: fileRecord.ownerEntityType,
    ownerEntityId: fileRecord.ownerEntityId,
    uploadedByUserId: fileRecord.uploadedByUserId,
    createdAt: fileRecord.createdAt,
  };
}

/**
 * Validate file binary, upload to private R2 (`STORAGE`), persist `DB_STUDENTS.file_objects` + `audit_outbox`,
 * and compensate by deleting the R2 object if D1 persistence fails.
 */
export async function uploadFileService(
  dbStudents,
  storage,
  actorSession,
  { fileBytes, declaredMime, category, ownerEntityType, ownerEntityId },
  meta
) {
  const bytes = fileBytes instanceof Uint8Array ? fileBytes : new Uint8Array(fileBytes);
  if (bytes.byteLength <= 0 || bytes.byteLength > MAX_FILE_SIZE_BYTES) {
    throw new FilesServiceError(
      'VALIDATION_ERROR',
      `File size must be between 1 byte and ${MAX_FILE_SIZE_BYTES} bytes (5 MB).`,
      400
    );
  }

  const verifiedMime = detectMimeFromMagicBytes(bytes);
  if (!verifiedMime) {
    throw new FilesServiceError(
      'VALIDATION_ERROR',
      'Unsupported or invalid file content. Allowed types: JPEG, PNG, WebP, PDF.',
      400
    );
  }
  if (declaredMime && declaredMime !== verifiedMime) {
    throw new FilesServiceError(
      'VALIDATION_ERROR',
      'Declared file Content-Type does not match actual binary signature.',
      400
    );
  }

  if (ownerEntityType === 'STUDENT' && ownerEntityId) {
    const studentRow = await dbStudents
      .prepare('SELECT id FROM students WHERE id = ? LIMIT 1')
      .bind(ownerEntityId)
      .first();
    if (!studentRow) {
      throw new FilesServiceError('NOT_FOUND', 'Target student not found.', 404);
    }
  } else if (ownerEntityType === 'PARENT' && ownerEntityId) {
    const parentRow = await dbStudents
      .prepare('SELECT id FROM parent_profiles WHERE id = ? LIMIT 1')
      .bind(ownerEntityId)
      .first();
    if (!parentRow) {
      throw new FilesServiceError('NOT_FOUND', 'Target parent profile not found.', 404);
    }
  }

  const fileId = crypto.randomUUID();
  const ext = MIME_TO_EXT[verifiedMime];
  const r2ObjectKey = `uploads/${category.toLowerCase()}/${fileId}.${ext}`;
  const timestamp = nowIso();

  try {
    await storage.put(r2ObjectKey, bytes, {
      httpMetadata: { contentType: verifiedMime },
    });
  } catch {
    throw new FilesServiceError('STORAGE_UNAVAILABLE', 'Unable to store uploaded file.', 503);
  }

  const auditStatement = createAuditOutboxStatement(dbStudents, {
    actorUserId: actorSession.userId,
    action: 'CREATE',
    entityType: 'FILE_OBJECT',
    entityId: fileId,
    newValues: {
      category,
      mimeType: verifiedMime,
      sizeBytes: bytes.byteLength,
      ownerEntityType: ownerEntityType ?? null,
      ownerEntityId: ownerEntityId ?? null,
    },
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
    createdAt: timestamp,
  });

  try {
    await insertFileObjectBatch(dbStudents, {
      fileRecord: {
        id: fileId,
        r2ObjectKey,
        category,
        mimeType: verifiedMime,
        sizeBytes: bytes.byteLength,
        ownerEntityType: ownerEntityType ?? null,
        ownerEntityId: ownerEntityId ?? null,
        uploadedByUserId: actorSession.userId,
        createdAt: timestamp,
      },
      auditStatement,
    });
  } catch {
    try {
      await storage.delete(r2ObjectKey);
    } catch {
      console.error(
        JSON.stringify({
          level: 'ERROR',
          event: 'R2_COMPENSATION_DELETE_FAILED',
          fileId,
          requestId: meta.requestId ?? null,
        })
      );
    }
    throw new FilesServiceError('FILE_METADATA_FAILED', 'Unable to save file metadata.', 500);
  }

  const saved = await findFileObjectById(dbStudents, fileId);
  return toPublicFileDto(saved);
}

export async function getFileRecordOrThrow(dbStudents, fileId) {
  const record = await findFileObjectById(dbStudents, fileId);
  if (!record) {
    throw new FilesServiceError('NOT_FOUND', 'File not found.', 404);
  }
  return record;
}

export async function downloadFileFromStorage(storage, fileRecord) {
  const obj = await storage.get(fileRecord.r2ObjectKey);
  if (!obj) {
    throw new FilesServiceError('NOT_FOUND', 'File binary not found in storage.', 404);
  }
  const bytes = await obj.arrayBuffer();
  return {
    bytes,
    mimeType: fileRecord.mimeType,
  };
}

export async function deleteFileService(dbStudents, storage, actorSession, fileId, meta) {
  const existing = await getFileRecordOrThrow(dbStudents, fileId);
  const timestamp = nowIso();

  const auditStatement = createAuditOutboxStatement(dbStudents, {
    actorUserId: actorSession.userId,
    action: 'DELETE',
    entityType: 'FILE_OBJECT',
    entityId: fileId,
    oldValues: {
      category: existing.category,
      mimeType: existing.mimeType,
      ownerEntityType: existing.ownerEntityType,
      ownerEntityId: existing.ownerEntityId,
    },
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
    createdAt: timestamp,
  });

  await deleteFileObjectBatch(dbStudents, { fileId, auditStatement });
  try {
    await storage.delete(existing.r2ObjectKey);
  } catch {
    console.warn(
      JSON.stringify({
        level: 'WARN',
        event: 'R2_POST_DELETE_CLEANUP_FAILED',
        fileId,
        requestId: meta.requestId ?? null,
      })
    );
  }

  return { deleted: true, id: fileId };
}
