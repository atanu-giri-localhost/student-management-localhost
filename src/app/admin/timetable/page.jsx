'use client';

import { ErrorBanner } from '@/components/data-display/error-banner';
import { LoadingSkeleton } from '@/components/data-display/loading-skeleton';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { StatCard } from '@/components/data-display/stat-card';
import { PortalShell } from '@/components/layout/portal-shell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { WeeklyMatrix } from '@/components/timetable/weekly-matrix';
import { useSession } from '@/lib/auth/use-session';

const STATS = [
  { label: 'Classes Scheduled', value: '18', subtitle: 'This week' },
  { label: 'Periods / Day', value: '8', subtitle: 'Mon–Sat' },
  { label: 'Free Slots', value: '12', subtitle: 'Open periods' },
  { label: 'Conflicts', value: '0', subtitle: 'No overlaps' },
];

const SCHEDULE = {
  'Mon-1': { subject: 'Mathematics', room: 'R-301' },
  'Mon-2': { subject: 'Science', room: 'R-201' },
  'Mon-3': { subject: 'English', room: 'R-101' },
  'Mon-4': { subject: 'Social Studies', room: 'R-202' },
  'Tue-1': { subject: 'Science', room: 'R-201' },
  'Tue-2': { subject: 'Mathematics', room: 'R-301' },
  'Tue-3': { subject: 'Hindi', room: 'R-102' },
  'Wed-1': { subject: 'English', room: 'R-101' },
  'Wed-2': { subject: 'Social Studies', room: 'R-202' },
  'Wed-3': { subject: 'Mathematics', room: 'R-301' },
  'Thu-1': { subject: 'Mathematics', room: 'R-301' },
  'Thu-2': { subject: 'Science', room: 'R-201' },
  'Thu-3': { subject: 'Computer', room: 'R-303' },
  'Fri-1': { subject: 'Social Studies', room: 'R-202' },
  'Fri-2': { subject: 'English', room: 'R-101' },
  'Fri-3': { subject: 'Hindi', room: 'R-102' },
  'Sat-1': { subject: 'Science', room: 'R-201' },
  'Sat-2': { subject: 'Computer', room: 'R-303' },
};

export default function AdminTimetablePage() {
  const { sessionData, loading, errorMsg, handleRetry, handleLogout } = useSession();

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

  const primaryRole = sessionData.roles?.[0] || 'SUPER_ADMIN';
  const isSuperAdmin = primaryRole === 'SUPER_ADMIN';

  return (
    <PortalShell
      roleName={primaryRole}
      roleLabel={isSuperAdmin ? 'Super Administrator' : 'Administrator'}
      pageTitle="Timetable"
      activePath="/admin/timetable"
      userLabel={sessionData.user.phoneNormalized}
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        <SectionHeader
          title="Timetable"
          description="Weekly schedule across classes, rooms, and subjects."
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat) => (
            <StatCard key={stat.label} title={stat.label} value={stat.value} subtitle={stat.subtitle} />
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Weekly Matrix</CardTitle>
            <CardDescription>Master timetable — Mon to Sat, periods 1–8.</CardDescription>
          </CardHeader>
          <CardContent>
            <WeeklyMatrix schedule={SCHEDULE} />
          </CardContent>
        </Card>
      </div>
    </PortalShell>
  );
}