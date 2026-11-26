import { hydrateUserProfiles } from '@/lib/auth/profile-hydration';
import { nowIso } from '@/lib/dates/format';
import { createAuditOutboxStatement } from '@/modules/audit/audit.service';
import {
  createUserBatch,
  deactivateUserBatch,
  findRolesByNames,
  findUserDetailById,
  listUsersPaginated,
  updateUserAndRolesBatch,
} from '@/modules/users/users.repository';

export class UsersServiceError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {number} status
   */
  constructor(code, message, status) {
    super(message);
    this.name = 'UsersServiceError';
    this.code = code;
    this.status = status;
  }
}

/**
 * List users with pagination and filters.
 *
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {{ page: number, pageSize: number, search?: string, role?: string, isActive?: string }} query
 */
export async function listUsersService(db, query) {
  const limit = query.pageSize;
  const offset = (query.page - 1) * query.pageSize;

  let isActive;
  if (query.isActive === '1' || query.isActive === 'true') isActive = 1;
  if (query.isActive === '0' || query.isActive === 'false') isActive = 0;

  return await listUsersPaginated(db, {
    search: query.search,
    role: query.role,
    isActive,
    limit,
    offset,
  });
}

/**
 * Create a new user account with assigned roles and audit event.
 *
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {{ userId: string }} actorSession
 * @param {{ phone: string, email?: string | null, roles: string[], isActive: boolean }} input
 * @param {{ clientIp: string, requestId: string }} meta
 */
export async function createUserService(db, actorSession, input, meta) {
  const matchedRoles = await findRolesByNames(db, input.roles);
  const uniqueRequested = Array.from(new Set(input.roles));
  if (matchedRoles.length !== uniqueRequested.length) {
    throw new UsersServiceError('VALIDATION_ERROR', 'One or more specified roles do not exist.', 400);
  }

  const timestamp = nowIso();
  const newUserId = crypto.randomUUID();
  const userRoleRows = matchedRoles.map((role) => ({
    id: crypto.randomUUID(),
    roleId: role.id,
  }));

  const auditStatement = createAuditOutboxStatement(db, {
    actorUserId: actorSession.userId,
    action: 'CREATE',
    entityType: 'USER',
    entityId: newUserId,
    newValues: {
      phoneNormalized: input.phone,
      email: input.email ?? null,
      roles: uniqueRequested,
      isActive: input.isActive,
    },
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
    createdAt: timestamp,
  });

  try {
    await createUserBatch(db, {
      user: {
        id: newUserId,
        phoneNormalized: input.phone,
        email: input.email ?? null,
        isActiveInt: input.isActive ? 1 : 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      userRoleRows,
      auditStatement,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      throw new UsersServiceError(
        'CONFLICT',
        'A user with this phone number or email already exists.',
        409
      );
    }
    throw error;
  }

  return await getUserByIdService(db, newUserId, meta.workerEnv);
}

/**
 * Fetch a single user detail by ID from `DB_IDENTITY` and hydrate linked domain profiles.
 *
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {string} userId
 * @param {Record<string, unknown>} [workerEnv]
 */
export async function getUserByIdService(db, userId, workerEnv = {}) {
  const user = await findUserDetailById(db, userId);
  if (!user) {
    throw new UsersServiceError('NOT_FOUND', 'User not found.', 404);
  }
  const profiles = await hydrateUserProfiles(workerEnv, {
    userId: user.id,
    roles: user.roles,
  });
  return {
    ...user,
    profiles,
  };
}

/**
 * Update user phone, email, and/or roles atomically.
 * Sensitive changes (phone or role changes) revoke all active sessions for the target user.
 *
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {{ userId: string }} actorSession
 * @param {string} targetUserId
 * @param {{ phone?: string, email?: string | null, roles?: string[] }} input
 * @param {{ clientIp: string, requestId: string }} meta
 */
export async function updateUserService(db, actorSession, targetUserId, input, meta) {
  const existing = await findUserDetailById(db, targetUserId);
  if (!existing) {
    throw new UsersServiceError('NOT_FOUND', 'User not found.', 404);
  }

  let newRoleRows;
  if (Array.isArray(input.roles)) {
    const matchedRoles = await findRolesByNames(db, input.roles);
    const uniqueRequested = Array.from(new Set(input.roles));
    if (matchedRoles.length !== uniqueRequested.length) {
      throw new UsersServiceError('VALIDATION_ERROR', 'One or more specified roles do not exist.', 400);
    }
    newRoleRows = matchedRoles.map((role) => ({
      id: crypto.randomUUID(),
      roleId: role.id,
    }));
  }

  const shouldRevokeSessions =
    (input.phone !== undefined && input.phone !== existing.phoneNormalized) ||
    Array.isArray(input.roles);

  const timestamp = nowIso();
  const auditStatement = createAuditOutboxStatement(db, {
    actorUserId: actorSession.userId,
    action: 'UPDATE',
    entityType: 'USER',
    entityId: targetUserId,
    oldValues: {
      phoneNormalized: existing.phoneNormalized,
      email: existing.email,
      roles: existing.roles,
    },
    newValues: {
      phoneNormalized: input.phone ?? existing.phoneNormalized,
      email: input.email !== undefined ? input.email : existing.email,
      roles: input.roles ? Array.from(new Set(input.roles)) : existing.roles,
      sessionsRevoked: shouldRevokeSessions,
    },
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
    createdAt: timestamp,
  });

  try {
    await updateUserAndRolesBatch(db, {
      userId: targetUserId,
      phoneNormalized: input.phone,
      email: input.email,
      hasEmail: input.email !== undefined,
      newRoleRows,
      shouldRevokeSessions,
      nowIso: timestamp,
      auditStatement,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      throw new UsersServiceError(
        'CONFLICT',
        'A user with this phone number or email already exists.',
        409
      );
    }
    throw error;
  }

  return await getUserByIdService(db, targetUserId, meta.workerEnv);
}

/**
 * Deactivate a user account (`is_active = 0`), revoke active sessions, and write `audit_outbox` entry.
 *
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {{ userId: string }} actorSession
 * @param {string} targetUserId
 * @param {{ clientIp: string, requestId: string, workerEnv?: Record<string, unknown> }} meta
 */
export async function deactivateUserService(db, actorSession, targetUserId, meta) {
  const existing = await findUserDetailById(db, targetUserId);
  if (!existing) {
    throw new UsersServiceError('NOT_FOUND', 'User not found.', 404);
  }
  if (actorSession.userId === targetUserId) {
    throw new UsersServiceError('CONFLICT', 'You cannot deactivate your own active account.', 409);
  }

  const timestamp = nowIso();
  const auditStatement = createAuditOutboxStatement(db, {
    actorUserId: actorSession.userId,
    action: 'UPDATE',
    entityType: 'USER',
    entityId: targetUserId,
    oldValues: { isActive: existing.isActive },
    newValues: { isActive: false, sessionsRevoked: true },
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
    createdAt: timestamp,
  });

  await deactivateUserBatch(db, {
    userId: targetUserId,
    nowIso: timestamp,
    auditStatement,
  });

  return await getUserByIdService(db, targetUserId, meta.workerEnv);
}
