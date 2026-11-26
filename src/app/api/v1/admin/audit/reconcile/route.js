import { requireAuth } from '@/lib/auth/session';
import { assertSameOrigin } from '@/lib/http/csrf';
import { createRequestId, jsonError, jsonOk } from '@/lib/http/response';
import { formatZodIssues } from '@/lib/validation/common';
import { assertCanAccessAudit } from '@/modules/audit/audit.permissions';
import { reconcileAuditSchema } from '@/modules/audit/audit.schemas';
import { reconcileAuditOutboxes } from '@/modules/audit/audit.service';

/**
 * Administratively reconcile pending domain `audit_outbox` events into `DB_AUDIT.audit_logs`
 * (`POST /api/v1/admin/audit/reconcile`). Restricted to `SUPER_ADMIN` (OD-01).
 *
 * @param {Request} request
 */
export async function POST(request) {
  const requestId = createRequestId(request);
  const auth = await requireAuth(request, { requestId });
  if (!auth.ok) return auth.response;

  const csrfError = assertSameOrigin(request, { workerEnv: auth.workerEnv, requestId });
  if (csrfError) return csrfError;

  const permissionError = assertCanAccessAudit(auth.session, requestId);
  if (permissionError) return permissionError;

  let rawBody = {};
  const contentLength = request.headers.get('content-length');
  if (contentLength !== '0') {
    try {
      const text = await request.text();
      if (text.trim().length > 0) {
        rawBody = JSON.parse(text);
      }
    } catch {
      return jsonError('VALIDATION_ERROR', 'Request body must be valid JSON.', {
        status: 400,
        requestId,
      });
    }
  }

  const parsed = reconcileAuditSchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid audit reconciliation parameters.', {
      status: 400,
      details: formatZodIssues(parsed.error),
      requestId,
    });
  }

  const summary = await reconcileAuditOutboxes(auth.workerEnv, parsed.data);
  if (!summary.ok && summary.error === 'AUDIT_DB_UNAVAILABLE') {
    return jsonError('AUDIT_DB_UNAVAILABLE', 'Central audit database is unavailable.', {
      status: 503,
      requestId,
    });
  }

  return jsonOk(summary, { requestId });
}
