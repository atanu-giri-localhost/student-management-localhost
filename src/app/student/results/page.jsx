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

export default function StudentResultsPage() {
  const { sessionData, loading, errorMsg, handleRetry, handleLogout } = useSession();
  const [results, setResults] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState('');

  const isAuthorized = hasAnyRole(sessionData, ['STUDENT', 'SUPER_ADMIN', 'COACHING_ADMIN']);
  const studentId = sessionData?.profiles?.studentId || null;

  useEffect(() => {
    if (!sessionData || !isAuthorized || !studentId) return;

    let cancelled = false;
    async function loadResults() {
      setDataLoading(true);
      setDataError('');
      try {
        const res = await apiFetch(`/api/v1/performance/students/${studentId}/results`);
        if (!cancelled) {
          const rawResults = res?.data?.results ?? res?.data;
          setResults(Array.isArray(rawResults) ? rawResults : []);
        }
      } catch (err) {
        if (!cancelled) {
          setDataError(err?.message || 'Unable to load published exam results.');
        }
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    }

    loadResults();
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
        pageTitle="Exam Results"
        activePath="/student/results"
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
      pageTitle="Exam Results"
      activePath="/student/results"
      userLabel={sessionData.user.phoneNormalized}
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        <SectionHeader
          title="Exam Results"
          description="Published examination results from DB_PERFORMANCE."
        />

        {dataError ? <ErrorBanner title="Results unavailable" message={dataError} /> : null}

        {!studentId ? (
          <EmptyState
            title="No student profile linked"
            description="An active student profile is required to view exam results."
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Published Examinations</CardTitle>
              <CardDescription>Only published examination results are visible to students.</CardDescription>
            </CardHeader>
            <CardContent>
              {dataLoading ? (
                <LoadingSkeleton rows={4} />
              ) : results.length === 0 ? (
                <EmptyState
                  title="No published results yet"
                  description="Published exam marks and grades will appear here once released."
                />
              ) : (
                <div className="space-y-2">
                  {results.map((item, idx) => (
                    <div
                      key={item.id || item.examinationId || idx}
                      className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
                    >
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {item.examinationName || item.subjectName || 'Examination'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {item.marksObtained !== undefined
                            ? `Marks: ${item.marksObtained}/${item.maxMarks ?? '—'}`
                            : 'Result published'}
                        </p>
                      </div>
                      <Badge variant="success">{item.grade || item.status || 'PUBLISHED'}</Badge>
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
