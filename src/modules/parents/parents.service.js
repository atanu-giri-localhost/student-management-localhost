import { D1_BINDINGS, getDomainDb } from '@/lib/cloudflare/bindings';
import { nowIso } from '@/lib/dates/format';
import { createAuditOutboxStatement } from '@/modules/audit/audit.service';
import {
  createParentBatch,
  findParentById,
  linkParentStudentBatch,
  listVerifiedChildrenForParent,
  unlinkParentStudentBatch,
  updateParentBatch,
} from '@/modules/parents/parents.repository';

export class ParentsServiceError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {number} status
   */
  constructor(code, message, status) {
    super(message);
    this.name = 'ParentsServiceError';
    this.code = code;
    this.status = status;
  }
}

export async function createParentProfileService(dbStudents, workerEnv, actorSession, input, meta) {
  const dbIdentity = getDomainDb(workerEnv, D1_BINDINGS.IDENTITY);
  const userRow = await dbIdentity
    .prepare('SELECT id, is_active FROM users WHERE id = ? LIMIT 1')
    .bind(input.userId)
    .first();

  if (!userRow || userRow.is_active !== 1) {
    throw new ParentsServiceError(
      'VALIDATION_ERROR',
      'Referenced user account does not exist or is inactive.',
      400
    );
  }

  const timestamp = nowIso();
  const parentId = crypto.randomUUID();
  const auditStatement = createAuditOutboxStatement(dbStudents, {
    actorUserId: actorSession.userId,
    action: 'CREATE',
    entityType: 'PARENT_PROFILE',
    entityId: parentId,
    newValues: {
      userId: input.userId,
      fullName: input.fullName,
      relationshipType: input.relationshipType,
    },
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
    createdAt: timestamp,
  });

  try {
    await createParentBatch(dbStudents, {
      parent: {
        id: parentId,
        userId: input.userId,
        fullName: input.fullName,
        phoneNormalized: input.phoneNormalized,
        email: input.email ?? null,
        relationshipType: input.relationshipType,
        createdAt: timestamp,
      },
      auditStatement,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      throw new ParentsServiceError(
        'CONFLICT',
        'A parent profile for this user account already exists.',
        409
      );
    }
    throw error;
  }

  return await findParentById(dbStudents, parentId);
}

export async function getParentProfileService(dbStudents, parentId) {
  const parent = await findParentById(dbStudents, parentId);
  if (!parent) {
    throw new ParentsServiceError('NOT_FOUND', 'Parent profile not found.', 404);
  }
  return parent;
}

export async function updateParentProfileService(dbStudents, actorSession, parentId, input, meta) {
  const existing = await findParentById(dbStudents, parentId);
  if (!existing) {
    throw new ParentsServiceError('NOT_FOUND', 'Parent profile not found.', 404);
  }

  const timestamp = nowIso();
  const auditStatement = createAuditOutboxStatement(dbStudents, {
    actorUserId: actorSession.userId,
    action: 'UPDATE',
    entityType: 'PARENT_PROFILE',
    entityId: parentId,
    oldValues: {
      fullName: existing.fullName,
      phoneNormalized: existing.phoneNormalized,
      relationshipType: existing.relationshipType,
    },
    newValues: input,
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
    createdAt: timestamp,
  });

  await updateParentBatch(dbStudents, {
    parentId,
    fields: input,
    auditStatement,
  });

  return await findParentById(dbStudents, parentId);
}

export async function getMyChildrenService(dbStudents, parentProfileId) {
  return await listVerifiedChildrenForParent(dbStudents, parentProfileId);
}

export async function linkParentStudentService(dbStudents, actorSession, parentId, input, meta) {
  const [parentRow, studentRow] = await dbStudents.batch([
    dbStudents.prepare('SELECT id FROM parent_profiles WHERE id = ? LIMIT 1').bind(parentId),
    dbStudents.prepare('SELECT id FROM students WHERE id = ? LIMIT 1').bind(input.studentId),
  ]);

  if (!parentRow.results?.[0]) {
    throw new ParentsServiceError('NOT_FOUND', 'Parent profile not found.', 404);
  }
  if (!studentRow.results?.[0]) {
    throw new ParentsServiceError('NOT_FOUND', 'Student not found.', 404);
  }

  const timestamp = nowIso();
  const linkId = crypto.randomUUID();
  const auditStatement = createAuditOutboxStatement(dbStudents, {
    actorUserId: actorSession.userId,
    action: 'CREATE',
    entityType: 'PARENT_STUDENT',
    entityId: linkId,
    newValues: {
      parentProfileId: parentId,
      studentId: input.studentId,
      isPrimary: input.isPrimary,
      verificationStatus: input.verificationStatus,
    },
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
    createdAt: timestamp,
  });

  try {
    await linkParentStudentBatch(dbStudents, {
      link: {
        id: linkId,
        parentProfileId: parentId,
        studentId: input.studentId,
        isPrimaryInt: input.isPrimary ? 1 : 0,
        verificationStatus: input.verificationStatus,
        createdAt: timestamp,
      },
      auditStatement,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      throw new ParentsServiceError(
        'CONFLICT',
        'This parent is already linked to the specified student.',
        409
      );
    }
    throw error;
  }

  return await findParentById(dbStudents, parentId);
}

export async function unlinkParentStudentService(dbStudents, actorSession, parentId, studentId, meta) {
  const existingLink = await dbStudents
    .prepare(
      'SELECT id, is_primary, verification_status FROM parent_students WHERE parent_profile_id = ? AND student_id = ? LIMIT 1'
    )
    .bind(parentId, studentId)
    .first();

  if (!existingLink) {
    throw new ParentsServiceError('NOT_FOUND', 'Parent-student relationship not found.', 404);
  }

  const timestamp = nowIso();
  const auditStatement = createAuditOutboxStatement(dbStudents, {
    actorUserId: actorSession.userId,
    action: 'UNLINK',
    entityType: 'PARENT_STUDENT',
    entityId: existingLink.id,
    oldValues: {
      parentProfileId: parentId,
      studentId,
      isPrimary: existingLink.is_primary === 1,
      verificationStatus: existingLink.verification_status,
    },
    ipAddress: meta.clientIp,
    requestId: meta.requestId,
    createdAt: timestamp,
  });

  await unlinkParentStudentBatch(dbStudents, {
    parentProfileId: parentId,
    studentId,
    auditStatement,
  });

  return {
    unlinked: true,
    parentProfileId: parentId,
    studentId,
  };
}
