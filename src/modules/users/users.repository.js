/**
 * Direct Cloudflare D1 (`env.DB`) repository for `users`, `roles`, and `user_roles`.
 */

function mapUserRow(row) {
  if (!row) return null;
  const roles =
    typeof row.role_names === 'string' && row.role_names.length > 0
      ? Array.from(new Set(row.role_names.split(',').filter(Boolean)))
      : [];

  return {
    id: row.id,
    phoneNormalized: row.phone_normalized,
    email: row.email ?? null,
    isActive: row.is_active === 1,
    roles,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * List users with pagination and optional search, role, and active-status filters.
 *
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {{ search?: string, role?: string, isActive?: number, limit: number, offset: number }} filters
 */
export async function listUsersPaginated(db, filters) {
  const where = [];
  const params = [];

  if (typeof filters.isActive === 'number') {
    where.push('u.is_active = ?');
    params.push(filters.isActive);
  }
  if (filters.search) {
    where.push('(u.phone_normalized LIKE ? OR u.email LIKE ?)');
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }
  if (filters.role) {
    where.push(
      `EXISTS (
         SELECT 1 FROM user_roles ur_f
         INNER JOIN roles r_f ON r_f.id = ur_f.role_id
         WHERE ur_f.user_id = u.id AND r_f.name = ?
       )`
    );
    params.push(filters.role);
  }

  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const [countRes, rowsRes] = await db.batch([
    db.prepare(`SELECT COUNT(*) AS total FROM users u ${clause}`).bind(...params),
    db
      .prepare(
        `SELECT
           u.id,
           u.phone_normalized,
           u.email,
           u.is_active,
           u.created_at,
           u.updated_at,
           GROUP_CONCAT(r.name) AS role_names
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON r.id = ur.role_id
         ${clause}
         GROUP BY u.id
         ORDER BY u.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(...params, filters.limit, filters.offset),
  ]);

  return {
    total: Number(countRes.results[0]?.total ?? 0),
    users: (rowsRes.results || []).map(mapUserRow),
  };
}

/**
 * Find one user by ID with roles and linked profile IDs.
 *
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {string} userId
 */
export async function findUserDetailById(db, userId) {
  const row = await db
    .prepare(
      `SELECT
         u.id,
         u.phone_normalized,
         u.email,
         u.is_active,
         u.created_at,
         u.updated_at,
         GROUP_CONCAT(r.name) AS role_names,
         pp.id AS parent_profile_id,
         tp.id AS teacher_profile_id,
         st.id AS student_id
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       LEFT JOIN parent_profiles pp ON pp.user_id = u.id
       LEFT JOIN teacher_profiles tp ON tp.user_id = u.id
       LEFT JOIN students st ON st.user_id = u.id
       WHERE u.id = ?
       GROUP BY u.id`
    )
    .bind(userId)
    .first();

  if (!row) {
    return null;
  }

  return {
    ...mapUserRow(row),
    profiles: {
      parentProfileId: row.parent_profile_id ?? null,
      teacherProfileId: row.teacher_profile_id ?? null,
      studentId: row.student_id ?? null,
    },
  };
}

/**
 * Resolve role IDs from `roles` table for a set of canonical role names.
 *
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {string[]} roleNames
 */
export async function findRolesByNames(db, roleNames) {
  const uniqueNames = Array.from(new Set(roleNames));
  if (uniqueNames.length === 0) return [];
  const placeholders = uniqueNames.map(() => '?').join(', ');
  const { results } = await db
    .prepare(`SELECT id, name FROM roles WHERE name IN (${placeholders})`)
    .bind(...uniqueNames)
    .all();

  return results || [];
}

/**
 * Atomically create user, role assignments, and audit log row.
 */
export async function createUserBatch(db, { user, userRoleRows, auditStatement }) {
  const statements = [
    db
      .prepare(
        `INSERT INTO users (id, phone_normalized, email, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(user.id, user.phoneNormalized, user.email ?? null, user.isActiveInt, user.createdAt, user.updatedAt),
    ...userRoleRows.map((ur) =>
      db
        .prepare('INSERT INTO user_roles (id, user_id, role_id, created_at) VALUES (?, ?, ?, ?)')
        .bind(ur.id, user.id, ur.roleId, user.createdAt)
    ),
    auditStatement,
  ];

  return await db.batch(statements);
}

/**
 * Atomically update user profile fields, optionally replace roles, revoke sessions, and write audit log.
 */
export async function updateUserAndRolesBatch(
  db,
  { userId, phoneNormalized, email, hasEmail, newRoleRows, shouldRevokeSessions, nowIso, auditStatement }
) {
  const statements = [];

  if (phoneNormalized !== undefined || hasEmail) {
    const sets = ['updated_at = ?'];
    const params = [nowIso];

    if (phoneNormalized !== undefined) {
      sets.push('phone_normalized = ?');
      params.push(phoneNormalized);
    }
    if (hasEmail) {
      sets.push('email = ?');
      params.push(email ?? null);
    }
    params.push(userId);
    statements.push(db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).bind(...params));
  } else {
    statements.push(db.prepare('UPDATE users SET updated_at = ? WHERE id = ?').bind(nowIso, userId));
  }

  if (Array.isArray(newRoleRows)) {
    statements.push(db.prepare('DELETE FROM user_roles WHERE user_id = ?').bind(userId));
    for (const ur of newRoleRows) {
      statements.push(
        db
          .prepare('INSERT INTO user_roles (id, user_id, role_id, created_at) VALUES (?, ?, ?, ?)')
          .bind(ur.id, userId, ur.roleId, nowIso)
      );
    }
  }

  if (shouldRevokeSessions) {
    statements.push(
      db
        .prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL')
        .bind(nowIso, userId)
    );
  }

  statements.push(auditStatement);
  return await db.batch(statements);
}

/**
 * Atomically deactivate a user account, revoke all active sessions, and write audit log.
 */
export async function deactivateUserBatch(db, { userId, nowIso, auditStatement }) {
  return await db.batch([
    db.prepare('UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?').bind(nowIso, userId),
    db
      .prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL')
      .bind(nowIso, userId),
    auditStatement,
  ]);
}
