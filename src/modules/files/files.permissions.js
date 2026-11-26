import { requireRole } from '@/lib/auth/session';
import { jsonError } from '@/lib/http/response';
import { hasVerifiedParentLink } from '@/modules/students/students.repository';

export function assertCanUploadFile(session, requestId) {
  return requireRole(session, ['SUPER_ADMIN', 'COACHING_ADMIN'], requestId);
}

export function assertCanDeleteFile(session, requestId) {
  return requireRole(session, ['SUPER_ADMIN', 'COACHING_ADMIN'], requestId);
}

/**
 * Authorize reading/downloading a private R2 file object based on its `owner_entity_type` / `owner_entity_id`.
 *
 * @param {{ roles: string[], profiles?: { studentId?: string | null, parentProfileId?: string | null } }} session
 * @param {{ ownerEntityType: string | null, ownerEntityId: string | null }} fileRecord
 * @param {import('@cloudflare/workers-types').D1Database} dbStudents
 * @param {string} [requestId]
 * @returns {Promise<Response | null>}
 */
export async function assertCanReadFile(session, fileRecord, dbStudents, requestId) {
  const roles = Array.isArray(session?.roles) ? session.roles : [];

  if (roles.includes('SUPER_ADMIN') || roles.includes('COACHING_ADMIN')) {
    return null;
  }

  if (
    roles.includes('STUDENT') &&
    fileRecord.ownerEntityType === 'STUDENT' &&
    fileRecord.ownerEntityId &&
    fileRecord.ownerEntityId === session?.profiles?.studentId
  ) {
    return null;
  }

  if (roles.includes('PARENT') && session?.profiles?.parentProfileId) {
    if (
      fileRecord.ownerEntityType === 'PARENT' &&
      fileRecord.ownerEntityId === session.profiles.parentProfileId
    ) {
      return null;
    }
    if (fileRecord.ownerEntityType === 'STUDENT' && fileRecord.ownerEntityId) {
      const isLinked = await hasVerifiedParentLink(
        dbStudents,
        session.profiles.parentProfileId,
        fileRecord.ownerEntityId
      );
      if (isLinked) {
        return null;
      }
    }
  }

  return jsonError('FORBIDDEN', 'You do not have permission to access this file.', {
    status: 403,
    requestId,
  });
}
