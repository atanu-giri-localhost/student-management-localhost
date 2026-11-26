import { requireRole } from '@/lib/auth/session';
import { jsonError } from '@/lib/http/response';

/**
 * Restrict parent profile administration and parent-student linking to `SUPER_ADMIN` and `COACHING_ADMIN`.
 */
export function assertCanManageParents(session, requestId) {
  return requireRole(session, ['SUPER_ADMIN', 'COACHING_ADMIN'], requestId);
}

/**
 * Allow `SUPER_ADMIN` / `COACHING_ADMIN`, or a `PARENT` reading their own `parentProfileId`.
 */
export function assertCanReadParentProfile(session, parentProfileId, requestId) {
  const roles = Array.isArray(session?.roles) ? session.roles : [];
  if (roles.includes('SUPER_ADMIN') || roles.includes('COACHING_ADMIN')) {
    return null;
  }
  if (roles.includes('PARENT') && session?.profiles?.parentProfileId === parentProfileId) {
    return null;
  }
  return jsonError('FORBIDDEN', 'You do not have permission to access this parent profile.', {
    status: 403,
    requestId,
  });
}

/**
 * Require an authenticated `PARENT` with a resolved `parentProfileId`.
 */
export function assertIsAuthenticatedParent(session, requestId) {
  const roles = Array.isArray(session?.roles) ? session.roles : [];
  if (!roles.includes('PARENT') || !session?.profiles?.parentProfileId) {
    return jsonError('FORBIDDEN', 'Parent profile access is required.', {
      status: 403,
      requestId,
    });
  }
  return null;
}
