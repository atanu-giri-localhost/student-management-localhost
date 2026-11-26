'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/http/api-client';

let cachedSessionPromise = null;
let cachedSessionData = null;

/**
 * Clear in-memory session deduplication cache (used on logout or explicit retry).
 */
export function resetClientSessionCache() {
  cachedSessionPromise = null;
  cachedSessionData = null;
}

async function fetchSessionOnce(forceRefresh = false) {
  if (!forceRefresh && cachedSessionData) {
    return cachedSessionData;
  }
  if (!forceRefresh && cachedSessionPromise) {
    return cachedSessionPromise;
  }

  const promise = apiFetch('/api/v1/auth/session', { cache: 'no-store' })
    .then((payload) => {
      cachedSessionData = payload?.data ?? null;
      return cachedSessionData;
    })
    .finally(() => {
      cachedSessionPromise = null;
    });

  cachedSessionPromise = promise;
  return promise;
}

/**
 * Client-side session hydration hook backed by `GET /api/v1/auth/session`
 * and `POST /api/v1/auth/logout`.
 *
 * Note: Server-side RBAC on every `/api/v1/*` route remains authoritative.
 *
 * @param {{ redirectOnUnauthenticated?: boolean }} [options]
 */
export function useSession(options = {}) {
  const { redirectOnUnauthenticated = false } = options;
  const router = useRouter();
  const [sessionData, setSessionData] = useState(cachedSessionData);
  const [loading, setLoading] = useState(!cachedSessionData);
  const [errorMsg, setErrorMsg] = useState('');

  const applySessionResult = useCallback(
    (data) => {
      setSessionData(data);
      setErrorMsg('');
      setLoading(false);
    },
    []
  );

  const applySessionError = useCallback(
    (err) => {
      resetClientSessionCache();
      setSessionData(null);
      if (err?.status === 401) {
        setErrorMsg('Your session has expired or you are not signed in.');
        if (redirectOnUnauthenticated) {
          router.replace('/login');
        }
      } else {
        setErrorMsg(err?.message || 'Unable to verify session. Please try again.');
      }
      setLoading(false);
    },
    [redirectOnUnauthenticated, router]
  );

  useEffect(() => {
    let cancelled = false;
    fetchSessionOnce(false).then(
      (data) => {
        if (!cancelled) applySessionResult(data);
      },
      (err) => {
        if (!cancelled) applySessionError(err);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [applySessionError, applySessionResult]);

  const handleRetry = useCallback(() => {
    setLoading(true);
    setErrorMsg('');
    fetchSessionOnce(true).then(applySessionResult, applySessionError);
  }, [applySessionError, applySessionResult]);

  const handleLogout = useCallback(async () => {
    try {
      await apiFetch('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // Proceed with local cleanup and login redirect even if session was already expired.
    } finally {
      resetClientSessionCache();
      setSessionData(null);
      router.replace('/login');
    }
  }, [router]);

  return {
    sessionData,
    loading,
    errorMsg,
    handleRetry,
    handleLogout,
  };
}
