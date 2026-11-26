import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';

const EMPTY_PROFILES = Object.freeze({
  parentProfileId: null,
  teacherProfileId: null,
  studentId: null,
});

/**
 * Hydrate linked domain profile IDs from `DB_STUDENTS` and `DB_ACADEMICS` without cross-D1 SQL joins.
 * Skips queries for roles that do not have linked profiles (e.g., `SUPER_ADMIN`, `COACHING_ADMIN`).
 * Degrades gracefully to `null` IDs if a profile D1 binding is unavailable or inactive.
 *
 * @param {Record<string, unknown>} workerEnv
 * @param {{ userId: string, roles: string[] }} identity
 * @returns {Promise<{ parentProfileId: string | null, teacherProfileId: string | null, studentId: string | null }>}
 */
export async function hydrateUserProfiles(workerEnv, { userId, roles }) {
  const roleSet = new Set(Array.isArray(roles) ? roles : []);
  const needsParent = roleSet.has('PARENT');
  const needsStudent = roleSet.has('STUDENT');
  const needsTeacher = roleSet.has('TEACHER');

  if (!needsParent && !needsStudent && !needsTeacher) {
    return { ...EMPTY_PROFILES };
  }

  let parentProfileId = null;
  let studentId = null;
  let teacherProfileId = null;

  const tasks = [];

  if (needsParent || needsStudent) {
    tasks.push(
      (async () => {
        try {
          const dbStudents = getDomainDb(workerEnv, D1_BINDINGS.STUDENTS);
          if (needsParent) {
            const parentRow = await dbStudents
              .prepare('SELECT id FROM parent_profiles WHERE user_id = ? LIMIT 1')
              .bind(userId)
              .first();
            parentProfileId = parentRow?.id ?? null;
          }
          if (needsStudent) {
            const studentRow = await dbStudents
              .prepare(
                `SELECT id
                 FROM students
                 WHERE user_id = ?
                   AND lifecycle_status IN ('ACTIVE', 'ALUMNI')
                 LIMIT 1`
              )
              .bind(userId)
              .first();
            studentId = studentRow?.id ?? null;
          }
        } catch {
          // Degrade gracefully when DB_STUDENTS is unavailable; identity/roles from DB_IDENTITY remain authoritative.
        }
      })()
    );
  }

  if (needsTeacher) {
    tasks.push(
      (async () => {
        try {
          const dbAcademics = getDomainDb(workerEnv, D1_BINDINGS.ACADEMICS);
          const teacherRow = await dbAcademics
            .prepare(
              `SELECT id
               FROM teacher_profiles
               WHERE user_id = ?
                 AND employment_status = 'ACTIVE'
               LIMIT 1`
            )
            .bind(userId)
            .first();
          teacherProfileId = teacherRow?.id ?? null;
        } catch {
          // Degrade gracefully when DB_ACADEMICS is unavailable; identity/roles from DB_IDENTITY remain authoritative.
        }
      })()
    );
  }

  await Promise.all(tasks);

  return {
    parentProfileId,
    teacherProfileId,
    studentId,
  };
}
