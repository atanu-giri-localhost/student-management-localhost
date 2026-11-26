/**
 * Direct Cloudflare D1 (`DB_ACADEMICS`) repository for `academic_sessions`, `classes`,
 * `subjects`, and `class_subjects`.
 */

function mapAcademicSessionRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  };
}

function mapClassRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    gradeLevel: Number(row.grade_level),
    section: row.section ?? null,
  };
}

function mapSubjectRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    createdAt: row.created_at,
  };
}

function mapClassSubjectRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    academicSessionId: row.academic_session_id,
    academicSessionName: row.academic_session_name ?? null,
    classId: row.class_id,
    subjectId: row.subject_id,
    subjectName: row.subject_name ?? null,
    subjectCode: row.subject_code ?? null,
  };
}

/**
 * List academic sessions with bounded pagination and optional `isActive` filter.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {{ isActive?: boolean, limit: number, offset: number }} filters
 */
export async function listAcademicSessionsPaginated(dbAcademics, filters) {
  const where = [];
  const params = [];

  if (typeof filters.isActive === 'boolean') {
    where.push('is_active = ?');
    params.push(filters.isActive ? 1 : 0);
  }

  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const [countRes, rowsRes] = await dbAcademics.batch([
    dbAcademics.prepare(`SELECT COUNT(*) AS total FROM academic_sessions ${clause}`).bind(...params),
    dbAcademics
      .prepare(
        `SELECT id, name, start_date, end_date, is_active, created_at
         FROM academic_sessions
         ${clause}
         ORDER BY start_date DESC, created_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(...params, filters.limit, filters.offset),
  ]);

  return {
    total: Number(countRes.results[0]?.total ?? 0),
    academicSessions: (rowsRes.results || []).map(mapAcademicSessionRow),
  };
}

/**
 * Fetch a single academic session by ID.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {string} sessionId
 */
export async function findAcademicSessionById(dbAcademics, sessionId) {
  const row = await dbAcademics
    .prepare(
      `SELECT id, name, start_date, end_date, is_active, created_at
       FROM academic_sessions
       WHERE id = ?
       LIMIT 1`
    )
    .bind(sessionId)
    .first();

  return mapAcademicSessionRow(row);
}

/**
 * Insert an academic session. When `isActive === 1`, atomically deactivates any currently
 * active session inside `DB_ACADEMICS.batch([...])` to satisfy `idx_academic_sessions_single_active`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {{ id: string, name: string, startDate: string, endDate: string, isActive: number, createdAt: string }} sessionData
 */
export async function createAcademicSession(dbAcademics, sessionData) {
  const insertStmt = dbAcademics
    .prepare(
      `INSERT INTO academic_sessions (id, name, start_date, end_date, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(
      sessionData.id,
      sessionData.name,
      sessionData.startDate,
      sessionData.endDate,
      sessionData.isActive,
      sessionData.createdAt
    );

  if (sessionData.isActive === 1) {
    await dbAcademics.batch([
      dbAcademics.prepare('UPDATE academic_sessions SET is_active = 0 WHERE is_active = 1'),
      insertStmt,
    ]);
    return;
  }

  await insertStmt.run();
}

/**
 * Update an academic session. When `isActive === 1`, atomically deactivates any other
 * active session inside `DB_ACADEMICS.batch([...])`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {string} sessionId
 * @param {{ name: string, startDate: string, endDate: string, isActive: number }} updates
 */
export async function updateAcademicSession(dbAcademics, sessionId, updates) {
  const updateStmt = dbAcademics
    .prepare(
      `UPDATE academic_sessions
       SET name = ?, start_date = ?, end_date = ?, is_active = ?
       WHERE id = ?`
    )
    .bind(updates.name, updates.startDate, updates.endDate, updates.isActive, sessionId);

  if (updates.isActive === 1) {
    await dbAcademics.batch([
      dbAcademics
        .prepare('UPDATE academic_sessions SET is_active = 0 WHERE is_active = 1 AND id != ?')
        .bind(sessionId),
      updateStmt,
    ]);
    return;
  }

  await updateStmt.run();
}

/**
 * List classes with bounded pagination, optional grade-level filter, and search.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {{ gradeLevel?: number, search?: string, limit: number, offset: number }} filters
 */
export async function listClassesPaginated(dbAcademics, filters) {
  const where = [];
  const params = [];

  if (typeof filters.gradeLevel === 'number') {
    where.push('grade_level = ?');
    params.push(filters.gradeLevel);
  }
  if (filters.search) {
    where.push('(name LIKE ? OR COALESCE(section, \'\') LIKE ?)');
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const [countRes, rowsRes] = await dbAcademics.batch([
    dbAcademics.prepare(`SELECT COUNT(*) AS total FROM classes ${clause}`).bind(...params),
    dbAcademics
      .prepare(
        `SELECT id, name, grade_level, section
         FROM classes
         ${clause}
         ORDER BY grade_level ASC, name ASC, section ASC
         LIMIT ? OFFSET ?`
      )
      .bind(...params, filters.limit, filters.offset),
  ]);

  return {
    total: Number(countRes.results[0]?.total ?? 0),
    classes: (rowsRes.results || []).map(mapClassRow),
  };
}

/**
 * Fetch a single class by ID.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {string} classId
 */
export async function findClassById(dbAcademics, classId) {
  const row = await dbAcademics
    .prepare(
      `SELECT id, name, grade_level, section
       FROM classes
       WHERE id = ?
       LIMIT 1`
    )
    .bind(classId)
    .first();

  return mapClassRow(row);
}

/**
 * Insert a new class record.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {{ id: string, name: string, gradeLevel: number, section: string | null }} classData
 */
export async function createClass(dbAcademics, classData) {
  await dbAcademics
    .prepare(
      `INSERT INTO classes (id, name, grade_level, section)
       VALUES (?, ?, ?, ?)`
    )
    .bind(classData.id, classData.name, classData.gradeLevel, classData.section ?? null)
    .run();
}

/**
 * Update a class record.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {string} classId
 * @param {{ name: string, gradeLevel: number, section: string | null }} updates
 */
export async function updateClass(dbAcademics, classId, updates) {
  await dbAcademics
    .prepare(
      `UPDATE classes
       SET name = ?, grade_level = ?, section = ?
       WHERE id = ?`
    )
    .bind(updates.name, updates.gradeLevel, updates.section ?? null, classId)
    .run();
}

/**
 * List subjects assigned to a class, optionally filtered by `academicSessionId`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {string} classId
 * @param {{ academicSessionId?: string }} [filters]
 */
export async function listClassSubjects(dbAcademics, classId, filters = {}) {
  const where = ['cs.class_id = ?'];
  const params = [classId];

  if (filters.academicSessionId) {
    where.push('cs.academic_session_id = ?');
    params.push(filters.academicSessionId);
  }

  const res = await dbAcademics
    .prepare(
      `SELECT
         cs.id,
         cs.academic_session_id,
         acs.name AS academic_session_name,
         cs.class_id,
         cs.subject_id,
         s.name AS subject_name,
         s.code AS subject_code
       FROM class_subjects cs
       INNER JOIN subjects s ON s.id = cs.subject_id
       INNER JOIN academic_sessions acs ON acs.id = cs.academic_session_id
       WHERE ${where.join(' AND ')}
       ORDER BY acs.start_date DESC, s.code ASC`
    )
    .bind(...params)
    .all();

  return (res.results || []).map(mapClassSubjectRow);
}

/**
 * Fetch a specific class-subject mapping for `(academicSessionId, classId, subjectId)`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {{ academicSessionId: string, classId: string, subjectId: string }} keys
 */
export async function findClassSubjectMapping(dbAcademics, keys) {
  const row = await dbAcademics
    .prepare(
      `SELECT
         cs.id,
         cs.academic_session_id,
         acs.name AS academic_session_name,
         cs.class_id,
         cs.subject_id,
         s.name AS subject_name,
         s.code AS subject_code
       FROM class_subjects cs
       INNER JOIN subjects s ON s.id = cs.subject_id
       INNER JOIN academic_sessions acs ON acs.id = cs.academic_session_id
       WHERE cs.academic_session_id = ?
         AND cs.class_id = ?
         AND cs.subject_id = ?
       LIMIT 1`
    )
    .bind(keys.academicSessionId, keys.classId, keys.subjectId)
    .first();

  return mapClassSubjectRow(row);
}

/**
 * Create a class-subject mapping in `class_subjects`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {{ id: string, academicSessionId: string, classId: string, subjectId: string }} mapping
 */
export async function createClassSubjectMapping(dbAcademics, mapping) {
  await dbAcademics
    .prepare(
      `INSERT INTO class_subjects (id, academic_session_id, class_id, subject_id)
       VALUES (?, ?, ?, ?)`
    )
    .bind(mapping.id, mapping.academicSessionId, mapping.classId, mapping.subjectId)
    .run();
}

/**
 * Delete a class-subject mapping from `class_subjects`.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {{ academicSessionId: string, classId: string, subjectId: string }} keys
 */
export async function deleteClassSubjectMapping(dbAcademics, keys) {
  const result = await dbAcademics
    .prepare(
      `DELETE FROM class_subjects
       WHERE academic_session_id = ?
         AND class_id = ?
         AND subject_id = ?`
    )
    .bind(keys.academicSessionId, keys.classId, keys.subjectId)
    .run();

  return Number(result?.meta?.changes ?? 0);
}

/**
 * List master subjects with bounded pagination and optional search.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {{ search?: string, limit: number, offset: number }} filters
 */
export async function listSubjectsPaginated(dbAcademics, filters) {
  const where = [];
  const params = [];

  if (filters.search) {
    where.push('(name LIKE ? OR code LIKE ?)');
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const [countRes, rowsRes] = await dbAcademics.batch([
    dbAcademics.prepare(`SELECT COUNT(*) AS total FROM subjects ${clause}`).bind(...params),
    dbAcademics
      .prepare(
        `SELECT id, name, code, created_at
         FROM subjects
         ${clause}
         ORDER BY code ASC, name ASC
         LIMIT ? OFFSET ?`
      )
      .bind(...params, filters.limit, filters.offset),
  ]);

  return {
    total: Number(countRes.results[0]?.total ?? 0),
    subjects: (rowsRes.results || []).map(mapSubjectRow),
  };
}

/**
 * Fetch a single subject by ID.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {string} subjectId
 */
export async function findSubjectById(dbAcademics, subjectId) {
  const row = await dbAcademics
    .prepare(
      `SELECT id, name, code, created_at
       FROM subjects
       WHERE id = ?
       LIMIT 1`
    )
    .bind(subjectId)
    .first();

  return mapSubjectRow(row);
}

/**
 * Insert a new subject record.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {{ id: string, name: string, code: string, createdAt: string }} subjectData
 */
export async function createSubject(dbAcademics, subjectData) {
  await dbAcademics
    .prepare(
      `INSERT INTO subjects (id, name, code, created_at)
       VALUES (?, ?, ?, ?)`
    )
    .bind(subjectData.id, subjectData.name, subjectData.code, subjectData.createdAt)
    .run();
}

/**
 * Update a subject record.
 *
 * @param {import('@cloudflare/workers-types').D1Database} dbAcademics
 * @param {string} subjectId
 * @param {{ name: string, code: string }} updates
 */
export async function updateSubject(dbAcademics, subjectId, updates) {
  await dbAcademics
    .prepare(
      `UPDATE subjects
       SET name = ?, code = ?
       WHERE id = ?`
    )
    .bind(updates.name, updates.code, subjectId)
    .run();
}
