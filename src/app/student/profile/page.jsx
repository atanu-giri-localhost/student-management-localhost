'use client';

import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/data-display/empty-state';
import { ErrorBanner } from '@/components/data-display/error-banner';
import { LoadingSkeleton } from '@/components/data-display/loading-skeleton';
import { StatCard } from '@/components/data-display/stat-card';
import { PortalShell } from '@/components/layout/portal-shell';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession } from '@/lib/auth/use-session';
import { apiFetch } from '@/lib/http/api-client';
import { hasAnyRole } from '@/lib/portals';

export default function StudentProfilePage() {
  const { sessionData, loading, errorMsg, handleRetry, handleLogout } = useSession();
  const [profile, setProfile] = useState(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState('');

  const isAuthorized = hasAnyRole(sessionData, ['STUDENT', 'SUPER_ADMIN', 'COACHING_ADMIN']);
  const studentId = sessionData?.profiles?.studentId || null;

  useEffect(() => {
    if (!sessionData || !isAuthorized || !studentId) return;

    let cancelled = false;
    async function loadProfile() {
      setDataLoading(true);
      setDataError('');
      try {
        const res = await apiFetch(`/api/v1/students/${studentId}`);
        if (!cancelled) {
          setProfile(res?.data ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          setDataError(err?.message || 'Unable to load student profile.');
        }
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    }

    loadProfile();
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
        pageTitle="Student Profile"
        activePath="/student/profile"
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
      pageTitle="Student Profile"
      activePath="/student/profile"
      userLabel={sessionData.user.phoneNormalized}
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        <SectionHeader
          title="Student Profile"
          description="Your institutional student record, enrollment details, and linked guardians."
        />

        {dataError ? <ErrorBanner title="Profile unavailable" message={dataError} /> : null}

        {!studentId ? (
          <EmptyState
            title="No student profile linked"
            description="Contact administration to link your user account to a student record."
          />
        ) : dataLoading ? (
          <LoadingSkeleton rows={4} />
        ) : !profile ? (
          <EmptyState
            title="Profile not found"
            description="No student record details were returned."
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                title="Full Name"
                value={profile.fullName || '—'}
                subtitle={`Admission: ${profile.admissionNumber || '—'}`}
              />
              <StatCard
                title="Status"
                value={profile.status || 'ACTIVE'}
                subtitle="Enrollment lifecycle"
              />
              <StatCard
                title="Phone"
                value={sessionData.user.phoneNormalized}
                subtitle="Verified login number"
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Academic & Personal Details</CardTitle>
                <CardDescription>Loaded from GET /api/v1/students/{studentId}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Date of Birth: </span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {profile.dateOfBirth || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Gender: </span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {profile.gender || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Admission Date: </span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {profile.admissionDate || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Address: </span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {profile.address || '—'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </PortalShell>
  );
}
