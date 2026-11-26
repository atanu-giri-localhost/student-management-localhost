'use client';

import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/data-display/empty-state';
import { ErrorBanner } from '@/components/data-display/error-banner';
import { LoadingSkeleton } from '@/components/data-display/loading-skeleton';
import { StatCard } from '@/components/data-display/stat-card';
import { PortalShell } from '@/components/layout/portal-shell';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession } from '@/lib/auth/use-session';
import { apiFetch } from '@/lib/http/api-client';
import { hasAnyRole } from '@/lib/portals';

function statusBadgeVariant(status) {
  if (status === 'PRESENT') return 'success';
  if (status === 'ABSENT') return 'danger';
  if (status === 'LATE') return 'warning';
  return 'default';
}

export default function StudentAttendancePage() {
  const { sessionData, loading, errorMsg, handleRetry, handleLogout } = useSession();
  const [records, setRecords] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState('');

  const isAuthorized = hasAnyRole(sessionData, ['STUDENT', 'SUPER_ADMIN', 'COACHING_ADMIN']);
  const studentId = sessionData?.profiles?.studentId || null;

  useEffect(() => {
    if (!sessionData || !isAuthorized || !studentId) return;

    let cancelled = false;
    async function loadAttendance() {
      setDataLoading(true);
      setDataError('');
      try {
        const res = await apiFetch(`/api/v1/attendance/students/${studentId}?page=1&pageSize=25`);
        if (!cancelled) {
          setRecords(Array.isArray(res?.data) ? res.data : []);
        }
      } catch (err) {
        if (!cancelled) {
          setDataError(err?.message || 'Unable to load attendance history.');
        }
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    }

    loadAttendance();
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
        pageTitle="Attendance"
        activePath="/student/attendance"
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

  const presentCount = records.filter((r) => r.status === 'PRESENT').length;
  const absentCount = records.filter((r) => r.status === 'ABSENT').length;

  return (
    <PortalShell
      roleName={primaryRole}
      roleLabel="Student"
      pageTitle="Attendance"
      activePath="/student/attendance"
      userLabel={sessionData.user.phoneNormalized}
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        <SectionHeader
          title="Attendance"
          description="Daily and period attendance records from DB_ATTENDANCE."
        />

        {dataError ? <ErrorBanner title="Attendance unavailable" message={dataError} /> : null}

        {!studentId ? (
          <EmptyState
            title="No student profile linked"
            description="An active student profile is required to view attendance records."
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard title="Total Entries" value={dataLoading ? '...' : String(records.length)} />
              <StatCard title="Present" value={dataLoading ? '...' : String(presentCount)} />
              <StatCard title="Absent" value={dataLoading ? '...' : String(absentCount)} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Attendance Log</CardTitle>
                <CardDescription>Loaded from GET /api/v1/attendance/students/{studentId}</CardDescription>
              </CardHeader>
              <CardContent>
                {dataLoading ? (
                  <LoadingSkeleton rows={4} />
                ) : records.length === 0 ? (
                  <EmptyState
                    title="No attendance records"
                    description="No attendance entries have been recorded yet."
                  />
                ) : (
                  <div className="space-y-2">
                    {records.map((rec) => (
                      <div
                        key={rec.id || `${rec.attendanceDate}-${rec.registerType}`}
                        className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
                      >
                        <div>
                          <p className="font-medium text-slate-900 dark:text-slate-100">
                            {rec.attendanceDate || rec.date || 'Date'}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {rec.registerType || 'DAILY'}
                            {rec.periodNumber ? ` • Period ${rec.periodNumber}` : ''}
                          </p>
                        </div>
                        <Badge variant={statusBadgeVariant(rec.status)}>{rec.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </PortalShell>
  );
}
