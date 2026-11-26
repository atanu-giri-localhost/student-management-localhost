'use client';

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/http/api-client';

/**
 * Fetch a paginated `/api/v1/*` list endpoint with loading/error/empty state.
 *
 * @template T
 * @param {string | null} url
 * @returns {{ data: T[], loading: boolean, errorMsg: string, total: number, reload: () => void }}
 */
export function useApiList(url) {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(Boolean(url));
  const [errorMsg, setErrorMsg] = useState('');
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!url) {
      setData([]);
      setTotal(0);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setErrorMsg('');

    apiFetch(url)
      .then((res) => {
        if (cancelled) return;
        setData(Array.isArray(res.data) ? res.data : []);
        setTotal(res.pagination?.total ?? 0);
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(err?.message || 'Unable to load data.');
        setData([]);
        setTotal(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [url, tick]);

  return { data, total, loading, errorMsg, reload };
}