/**
 * Direct Cloudflare D1 (`DB_STUDENTS`) repository for `parent_profiles` and `parent_students`.
 */

function mapParentRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    fullName: row.full_name,
    phoneNormalized: row.phone_normalized,
    email: row.email ?? null,
    relationshipType: row.relationship_type,
    createdAt: row.created_at,
  };
}

/**
 * Fetch a parent profile by ID along with linked children.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbStudents
 * @param {string} parentId
 */
export async function findParentById(dbStudents, parentId) {
  const [parentRes, childrenRes] = await dbStudents.batch([
    dbStudents
      .prepare(
        `SELECT id, user_id, full_name, phone_normalized, email, relationship_type, created_at
         FROM parent_profiles
         WHERE id = ?
         LIMIT 1`
      )
      .bind(parentId),
    dbStudents
      .prepare(
        `SELECT
           ps.id AS link_id,
           ps.student_id,
           ps.is_primary,
           ps.verification_status,
           ps.created_at AS linked_at,
           s.admission_number,
           s.full_name,
           s.lifecycle_status,
           s.photo_file_id
         FROM parent_students ps
         INNER JOIN students s ON s.id = ps.student_id
         WHERE ps.parent_profile_id = ?
         ORDER BY ps.is_primary DESC, s.full_name ASC`
      )
      .bind(parentId),
  ]);

  const parent = mapParentRow(parentRes.results?.[0]);
  if (!parent) {
    return null;
  }

  return {
    ...parent,
    children: (childrenRes.results || []).map((c) => ({
      linkId: c.link_id,
      studentId: c.student_id,
      admissionNumber: c.admission_number,
      fullName: c.full_name,
      lifecycleStatus: c.lifecycle_status,
      photoFileId: c.photo_file_id ?? null,
      isPrimary: c.is_primary === 1,
      verificationStatus: c.verification_status,
      linkedAt: c.linked_at,
    })),
  };
}

/**
 * List `VERIFIED` linked children for an authenticated parent (`GET /api/v1/parents/my-children`).
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbStudents
 * @param {string} parentProfileId
 */
export async function listVerifiedChildrenForParent(dbStudents, parentProfileId) {
  const { results } = await dbStudents
    .prepare(
      `SELECT
         ps.id AS link_id,
         ps.student_id,
         ps.is_primary,
         ps.verification_status,
         s.admission_number,
         s.full_name,
         s.date_of_birth,
         s.gender,
         s.photo_file_id,
         s.lifecycle_status
       FROM parent_students ps
       INNER JOIN students s ON s.id = ps.student_id
       WHERE ps.parent_profile_id = ?
         AND ps.verification_status = 'VERIFIED'
       ORDER BY ps.is_primary DESC, s.full_name ASC`
    )
    .bind(parentProfileId)
    .all();

  return (results || []).map((row) => ({
    linkId: row.link_id,
    studentId: row.student_id,
    admissionNumber: row.admission_number,
    fullName: row.full_name,
    dateOfBirth: row.date_of_birth,
    gender: row.gender,
    photoFileId: row.photo_file_id ?? null,
    lifecycleStatus: row.lifecycle_status,
    isPrimary: row.is_primary === 1,
    verificationStatus: row.verification_status,
  }));
}

export async function createParentBatch(dbStudents, { parent, auditStatement }) {
  return await dbStudents.batch([
    dbStudents
      .prepare(
        `INSERT INTO parent_profiles (
          id, user_id, full_name, phone_normalized, email, relationship_type, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        parent.id,
        parent.userId,
        parent.fullName,
        parent.phoneNormalized,
        parent.email ?? null,
        parent.relationshipType,
        parent.createdAt
      ),
    auditStatement,
  ]);
}

export async function updateParentBatch(dbStudents, { parentId, fields, auditStatement }) {
  const columnMap = {
    fullName: 'full_name',
    phoneNormalized: 'phone_normalized',
    email: 'email',
    relationshipType: 'relationship_type',
  };

  const sets = [];
  const params = [];
  for (const [key, col] of Object.entries(columnMap)) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      sets.push(`${col} = ?`);
      params.push(fields[key] ?? null);
    }
  }
  params.push(parentId);

  return await dbStudents.batch([
    dbStudents.prepare(`UPDATE parent_profiles SET ${sets.join(', ')} WHERE id = ?`).bind(...params),
    auditStatement,
  ]);
}

export async function linkParentStudentBatch(dbStudents, { link, auditStatement }) {
  return await dbStudents.batch([
    dbStudents
      .prepare(
        `INSERT INTO parent_students (
          id, parent_profile_id, student_id, is_primary, verification_status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        link.id,
        link.parentProfileId,
        link.studentId,
        link.isPrimaryInt,
        link.verificationStatus,
        link.createdAt
      ),
    auditStatement,
  ]);
}

export async function unlinkParentStudentBatch(dbStudents, { parentProfileId, studentId, auditStatement }) {
  return await dbStudents.batch([
    dbStudents
      .prepare('DELETE FROM parent_students WHERE parent_profile_id = ? AND student_id = ?')
      .bind(parentProfileId, studentId),
    auditStatement,
  ]);
}
