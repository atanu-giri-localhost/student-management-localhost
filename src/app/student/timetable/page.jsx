'use client';

import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/components/data-display/empty-state';
import { ErrorBanner } from '@/components/data-display/error-banner';
import { LoadingSkeleton } from '@/components/data-display/loading-skeleton';
import { PortalShell } from '@/components/layout/portal-shell';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { WeeklyMatrix } from '@/components/timetable/weekly-matrix';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession } from '@/lib/auth/use-session';
import { apiFetch } from '@/lib/http/api-client';
import { hasAnyRole } from '@/lib/portals';

const DAY_NAMES = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function StudentTimetablePage() {
  const { sessionData, loading, errorMsg, handleRetry, handleLogout } = useSession();
  const [slots, setSlots] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState('');

  const isAuthorized = hasAnyRole(sessionData, ['STUDENT', 'SUPER_ADMIN', 'COACHING_ADMIN']);
  const studentId = sessionData?.profiles?.studentId || null;

  useEffect(() => {
    if (!sessionData || !isAuthorized || !studentId) return;

    let cancelled = false;
    async function loadTimetable() {
      setDataLoading(true);
      setDataError('');
      try {
        const res = await apiFetch(`/api/v1/timetable/student/${studentId}`);
        if (!cancelled) {
          setSlots(Array.isArray(res?.data) ? res.data : []);
        }
      } catch (err) {
        if (!cancelled) {
          setDataError(err?.message || 'Unable to load weekly timetable.');
        }
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    }

    loadTimetable();
    return () => {
      cancelled = true;
    };
  }, [sessionData, isAuthorized, studentId]);

  const scheduleMap = useMemo(() => {
    const map = {};
    for (const slot of slots) {
      const dayLabel = DAY_NAMES[slot.dayOfWeek];
      if (!dayLabel) continue;
      map[`${dayLabel}-${slot.periodNumber}`] = {
        subject: slot.subjectId,
        room: slot.roomName || slot.roomId || undefined,
        teacher: `${slot.startTime}–${slot.endTime}`,
      };
    }
    return map;
  }, [slots]);

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
        pageTitle="Timetable"
        activePath="/student/timetable"
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
      pageTitle="Timetable"
      activePath="/student/timetable"
      userLabel={sessionData.user.phoneNormalized}
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        <SectionHeader
          title="Timetable"
          description="Weekly class timetable loaded from DB_TIMETABLE."
        />

        {dataError ? <ErrorBanner title="Timetable unavailable" message={dataError} /> : null}

        {!studentId ? (
          <EmptyState
            title="No student profile linked"
            description="An active student profile is required to view your class timetable."
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Weekly Schedule</CardTitle>
              <CardDescription>Loaded from GET /api/v1/timetable/student/{studentId}</CardDescription>
            </CardHeader>
            <CardContent>
              {dataLoading ? (
                <LoadingSkeleton rows={5} />
              ) : slots.length === 0 ? (
                <EmptyState
                  title="No timetable slots scheduled"
                  description="Your class timetable has not been published yet."
                />
              ) : (
                <WeeklyMatrix schedule={scheduleMap} />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </PortalShell>
  );
}
