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

const TEACHER_QUICK_LINKS = [
  { label: 'My Classes', href: '/teacher/my-classes' },
  { label: 'Attendance', href: '/teacher/attendance' },
  { label: 'Performance', href: '/teacher/performance' },
  { label: 'Examinations', href: '/teacher/examinations' },
  { label: 'Timetable', href: '/teacher/timetable' },
];

export default function TeacherDashboardPage() {
  const { sessionData, loading, errorMsg, handleRetry, handleLogout } = useSession();
  const [assignments, setAssignments] = useState([]);
  const [slots, setSlots] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState('');

  const isAuthorized = hasAnyRole(sessionData, ['TEACHER', 'SUPER_ADMIN', 'COACHING_ADMIN']);
  const teacherProfileId = sessionData?.profiles?.teacherProfileId || null;

  useEffect(() => {
    if (!sessionData || !isAuthorized) return;

    let cancelled = false;
    async function loadTeacherData() {
      setDataLoading(true);
      setDataError('');
      try {
        const requests = [apiFetch('/api/v1/teacher-assignments?page=1&pageSize=25')];
        if (teacherProfileId) {
          requests.push(apiFetch(`/api/v1/timetable/teacher/${teacherProfileId}`));
        }
        const [assignRes, timetableRes] = await Promise.allSettled(requests);
        if (cancelled) return;

        if (assignRes.status === 'fulfilled') {
          setAssignments(Array.isArray(assignRes.value?.data) ? assignRes.value.data : []);
        }
        if (timetableRes && timetableRes.status === 'fulfilled') {
          setSlots(Array.isArray(timetableRes.value?.data) ? timetableRes.value.data : []);
        }
      } catch (err) {
        if (!cancelled) {
          setDataError(err?.message || 'Unable to load teacher assignments.');
        }
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    }

    loadTeacherData();
    return () => {
      cancelled = true;
    };
  }, [sessionData, isAuthorized, teacherProfileId]);

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

  const primaryRole = sessionData.roles?.[0] || 'TEACHER';

  if (!isAuthorized) {
    return (
      <PortalShell
        roleName={primaryRole}
        roleLabel={primaryRole.replace(/_/g, ' ')}
        pageTitle="Teacher Dashboard"
        activePath="/teacher/dashboard"
        userLabel={sessionData.user.phoneNormalized}
        onLogout={handleLogout}
      >
        <ErrorBanner
          title="Access restricted"
          message="Teacher or administrator privileges are required to view this portal."
        />
      </PortalShell>
    );
  }

  return (
    <PortalShell
      roleName={primaryRole}
      roleLabel="Teacher"
      pageTitle="Teacher Dashboard"
      activePath="/teacher/dashboard"
      userLabel={sessionData.user.phoneNormalized}
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        <SectionHeader
          title="Teacher Dashboard"
          description="View your assigned classes, attendance, performance records, and teaching schedule."
        />

        {dataError ? <ErrorBanner title="Unable to load teacher workspace" message={dataError} /> : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Phone"
            value={sessionData.user.phoneNormalized}
            subtitle="Verified via WhatsApp OTP"
          />
          <StatCard
            title="Assigned Classes"
            value={dataLoading ? '...' : String(assignments.length)}
            subtitle="Active class-subject mappings"
          />
          <StatCard
            title="Weekly Slots"
            value={dataLoading ? '...' : String(slots.length)}
            subtitle="Scheduled timetable periods"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Assigned Classes & Subjects</CardTitle>
            <CardDescription>Loaded from GET /api/v1/teacher-assignments</CardDescription>
          </CardHeader>
          <CardContent>
            {dataLoading ? (
              <LoadingSkeleton rows={3} />
            ) : assignments.length === 0 ? (
              <EmptyState
                title="No class assignments found"
                description="No active teacher assignments are linked to your profile yet."
              />
            ) : (
              <div className="space-y-2">
                {assignments.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
                  >
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {item.className || item.classId} — {item.subjectName || item.subjectId}
                    </span>
                    <Badge variant="info">{item.assignmentRole || 'TEACHER'}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:hidden">
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {TEACHER_QUICK_LINKS.map((item) => (
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
    </PortalShell>
  );
}
