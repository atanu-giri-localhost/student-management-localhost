'use client';

import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/data-display/empty-state';
import { ErrorBanner } from '@/components/data-display/error-banner';
import { LoadingSkeleton } from '@/components/data-display/loading-skeleton';
import { PortalShell } from '@/components/layout/portal-shell';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession } from '@/lib/auth/use-session';
import { apiFetch } from '@/lib/http/api-client';
import { hasAnyRole } from '@/lib/portals';

export default function StudentPerformancePage() {
  const { sessionData, loading, errorMsg, handleRetry, handleLogout } = useSession();
  const [records, setRecords] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState('');

  const isAuthorized = hasAnyRole(sessionData, ['STUDENT', 'SUPER_ADMIN', 'COACHING_ADMIN']);
  const studentId = sessionData?.profiles?.studentId || null;

  useEffect(() => {
    if (!sessionData || !isAuthorized || !studentId) return;

    let cancelled = false;
    async function loadPerformance() {
      setDataLoading(true);
      setDataError('');
      try {
        const res = await apiFetch(
          `/api/v1/performance/records?studentId=${encodeURIComponent(studentId)}&page=1&pageSize=25`
        );
        if (!cancelled) {
          setRecords(Array.isArray(res?.data) ? res.data : []);
        }
      } catch (err) {
        if (!cancelled) {
          setDataError(err?.message || 'Unable to load performance records.');
        }
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    }

    loadPerformance();
    return () => {
      cancelled = true;
    };
  }, [sessionData, isAuthorized, studentId]);

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6">
        <LoadingSkeleton rows={4} />
      </main>
    );
  }

  if (errorMsg || !sessionData) {
    return (
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6">
        <ErrorBanner
          title="Session check failed"
          message={errorMsg || 'Please sign in again.'}
          onRetry={handleRetry}
        />
      </main>
    );
  }

  const primaryRole = sessionData.roles?.[0] || 'STUDENT';

  if (!isAuthorized) {
    return (
      <PortalShell
        roleName={primaryRole}
        roleLabel={primaryRole.replace(/_/g, ' ')}
        pageTitle="Performance"
        activePath="/student/performance"
        userLabel={sessionData.user.phoneNormalized}
        onLogout={handleLogout}
      >
        <ErrorBanner
          title="Access restricted"
          message="Student privileges are required to view this page."
        />
      </PortalShell>
    );
  }

  return (
    <PortalShell
      roleName={primaryRole}
      roleLabel="Student"
      pageTitle="Performance"
      activePath="/student/performance"
      userLabel={sessionData.user.phoneNormalized}
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        <SectionHeader
          title="Performance"
          description="Daily academic performance evaluations and teacher feedback."
        />

        {dataError ? <ErrorBanner title="Performance unavailable" message={dataError} /> : null}

        {!studentId ? (
          <EmptyState
            title="No student profile linked"
            description="An active student profile is required to view performance records."
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Performance Evaluations</CardTitle>
              <CardDescription>Loaded from GET /api/v1/performance/records</CardDescription>
            </CardHeader>
            <CardContent>
              {dataLoading ? (
                <LoadingSkeleton rows={4} />
              ) : records.length === 0 ? (
                <EmptyState
                  title="No performance records yet"
                  description="Evaluations will appear here once recorded by your teachers."
                />
              ) : (
                <div className="space-y-2">
                  {records.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
                    >
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {item.recordType || item.metricName || 'Evaluation'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {item.recordedDate || item.createdAt}
                          {item.remarks ? ` • ${item.remarks}` : ''}
                        </p>
                      </div>
                      <Badge variant="info">
                        {item.score !== undefined && item.maxScore !== undefined
                          ? `${item.score}/${item.maxScore}`
                          : item.rating || 'Recorded'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </PortalShell>
  );
}
