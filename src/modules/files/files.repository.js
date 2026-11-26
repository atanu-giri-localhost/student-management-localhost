/**
 * Direct Cloudflare D1 (`DB_STUDENTS`) repository for `file_objects`.
 */

function mapFileRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    r2ObjectKey: row.r2_object_key,
    category: row.category,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    ownerEntityType: row.owner_entity_type ?? null,
    ownerEntityId: row.owner_entity_id ?? null,
    uploadedByUserId: row.uploaded_by_user_id ?? null,
    createdAt: row.created_at,
  };
}

export async function findFileObjectById(dbStudents, fileId) {
  const row = await dbStudents
    .prepare(
      `SELECT
         id, r2_object_key, category, mime_type, size_bytes,
         owner_entity_type, owner_entity_id, uploaded_by_user_id, created_at
       FROM file_objects
       WHERE id = ?
       LIMIT 1`
    )
    .bind(fileId)
    .first();

  return mapFileRow(row);
}

export async function insertFileObjectBatch(dbStudents, { fileRecord, auditStatement }) {
  return await dbStudents.batch([
    dbStudents
      .prepare(
        `INSERT INTO file_objects (
          id, r2_object_key, category, mime_type, size_bytes,
          owner_entity_type, owner_entity_id, uploaded_by_user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        fileRecord.id,
        fileRecord.r2ObjectKey,
        fileRecord.category,
        fileRecord.mimeType,
        fileRecord.sizeBytes,
        fileRecord.ownerEntityType ?? null,
        fileRecord.ownerEntityId ?? null,
        fileRecord.uploadedByUserId ?? null,
        fileRecord.createdAt
      ),
    auditStatement,
  ]);
}

export async function deleteFileObjectBatch(dbStudents, { fileId, auditStatement }) {
  return await dbStudents.batch([
    dbStudents.prepare('DELETE FROM file_objects WHERE id = ?').bind(fileId),
    auditStatement,
  ]);
}
