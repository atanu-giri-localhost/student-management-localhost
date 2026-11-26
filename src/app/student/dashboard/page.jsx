'use client';

import Link from 'next/link';
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

export default function StudentDashboardPage() {
  const { sessionData, loading, errorMsg, handleRetry, handleLogout } = useSession();
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState('');
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [examResults, setExamResults] = useState([]);
  const [timetableSlots, setTimetableSlots] = useState([]);

  const isAuthorized = hasAnyRole(sessionData, ['STUDENT', 'SUPER_ADMIN', 'COACHING_ADMIN']);
  const studentId = sessionData?.profiles?.studentId || null;

  useEffect(() => {
    if (!sessionData || !isAuthorized || !studentId) return;

    let cancelled = false;
    async function loadStudentDashboard() {
      setDataLoading(true);
      setDataError('');
      const [attRes, resRes, ttRes] = await Promise.allSettled([
        apiFetch(`/api/v1/attendance/students/${studentId}?page=1&pageSize=25`),
        apiFetch(`/api/v1/performance/students/${studentId}/results`),
        apiFetch(`/api/v1/timetable/student/${studentId}`),
      ]);

      if (cancelled) return;
      if (attRes.status === 'fulfilled') {
        setAttendanceRecords(Array.isArray(attRes.value?.data) ? attRes.value.data : []);
      }
      if (resRes.status === 'fulfilled') {
        const rawResults = resRes.value?.data?.results ?? resRes.value?.data;
        setExamResults(Array.isArray(rawResults) ? rawResults : []);
      }
      if (ttRes.status === 'fulfilled') {
        setTimetableSlots(Array.isArray(ttRes.value?.data) ? ttRes.value.data : []);
      }
      if ([attRes, resRes, ttRes].every((r) => r.status === 'rejected')) {
        setDataError('Unable to load student portal summary.');
      }
      setDataLoading(false);
    }

    loadStudentDashboard();
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
        pageTitle="Student Dashboard"
        activePath="/student/dashboard"
        userLabel={sessionData.user.phoneNormalized}
        onLogout={handleLogout}
      >
        <ErrorBanner
          title="Access restricted"
          message="Student privileges are required to view this portal."
        />
      </PortalShell>
    );
  }

  const presentCount = attendanceRecords.filter((r) => r.status === 'PRESENT').length;

  return (
    <PortalShell
      roleName={primaryRole}
      roleLabel="Student"
      pageTitle="Student Dashboard"
      activePath="/student/dashboard"
      userLabel={sessionData.user.phoneNormalized}
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        <SectionHeader
          title="Student Dashboard"
          description="View your attendance, performance, published exam results, and weekly timetable."
        />

        {dataError ? <ErrorBanner title="Data unavailable" message={dataError} /> : null}

        {!studentId ? (
          <EmptyState
            title="No student profile linked"
            description="Your account does not have an active student profile linked yet."
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                title="Attendance Records"
                value={dataLoading ? '...' : `${presentCount}/${attendanceRecords.length}`}
                subtitle="Recent present entries"
              />
              <StatCard
                title="Published Exams"
                value={dataLoading ? '...' : String(examResults.length)}
                subtitle="Available result sheets"
              />
              <StatCard
                title="Weekly Timetable"
                value={dataLoading ? '...' : String(timetableSlots.length)}
                subtitle="Scheduled class periods"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Attendance</CardTitle>
                  <CardDescription>Latest attendance entries from DB_ATTENDANCE</CardDescription>
                </CardHeader>
                <CardContent>
                  {dataLoading ? (
                    <LoadingSkeleton rows={3} />
                  ) : attendanceRecords.length === 0 ? (
                    <EmptyState
                      title="No attendance records yet"
                      description="Attendance entries will appear once your class register is marked."
                    />
                  ) : (
                    <div className="space-y-2">
                      {attendanceRecords.slice(0, 5).map((rec) => (
                        <div
                          key={rec.id || `${rec.attendanceDate}-${rec.registerType}`}
                          className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
                        >
                          <span className="text-slate-700 dark:text-slate-300">
                            {rec.attendanceDate || rec.date || 'Session'}
                          </span>
                          <Badge variant={rec.status === 'PRESENT' ? 'success' : 'warning'}>
                            {rec.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Portal Sections</CardTitle>
                  <CardDescription>Navigate to detailed academic views</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Profile', href: '/student/profile' },
                    { label: 'Attendance', href: '/student/attendance' },
                    { label: 'Performance', href: '/student/performance' },
                    { label: 'Exam Results', href: '/student/results' },
                    { label: 'Timetable', href: '/student/timetable' },
                  ].map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      {item.label}
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </PortalShell>
  );
}
