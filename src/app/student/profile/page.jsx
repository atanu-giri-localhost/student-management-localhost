'use client';

import { ErrorBanner } from '@/components/data-display/error-banner';
import { LoadingSkeleton } from '@/components/data-display/loading-skeleton';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { StatCard } from '@/components/data-display/stat-card';
import { PortalShell } from '@/components/layout/portal-shell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession } from '@/lib/auth/use-session';

const ACADEMIC_INFO = {
  rollNumber: 'SMS-2026-0042',
  admissionNumber: 'ADM-2024-0189',
  admissionDate: '2024-04-01',
  className: 'XII — Science',
  section: 'A',
  academicSession: '2026–2027',
  medium: 'English',
  category: 'General',
};

const CONTACT_INFO = {
  email: 'student.0042@sms.edu.in',
  alternatePhone: '+919876543210',
  address: '24, Park Street, Kolkata, West Bengal 700016',
  city: 'Kolkata',
  state: 'West Bengal',
  pincode: '700016',
};

const GUARDIAN_INFO = [
  {
    relation: 'Father',
    name: 'Mr. Rajesh Kumar',
    phone: '+919812345678',
    occupation: 'Business',
  },
  {
    relation: 'Mother',
    name: 'Mrs. Sunita Kumar',
    phone: '+919812345679',
    occupation: 'Homemaker',
  },
];

const HEALTH_INFO = {
  bloodGroup: 'B+',
  height: '168 cm',
  weight: '58 kg',
  allergies: 'None reported',
  medicalNotes: 'Mild myopia — uses spectacles',
};

const ACADEMIC_SUMMARY = [
  { label: 'Attendance', value: '84%', subtitle: '42 of 50 days present' },
  { label: 'Avg Score', value: '87.6', subtitle: 'Across 5 subjects' },
  { label: 'Exams Taken', value: '5', subtitle: 'This academic year' },
  { label: 'Subjects', value: '5', subtitle: 'Enrolled this session' },
];



export default function StudentProfilePage() {
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

  const primaryRole = sessionData.roles?.[0] || 'STUDENT';

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
          description="View your personal, academic, and guardian information."
        />

        {/* Quick Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ACADEMIC_SUMMARY.map((item) => (
            <StatCard
              key={item.label}
              title={item.label}
              value={item.value}
              subtitle={item.subtitle}
            />
          ))}
        </div>

        {/* Personal Information + Contact */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Your identity and admission details.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 text-sm">
              <DetailItem label="Student ID" value={sessionData.profiles?.studentId ?? '—'} />
              <DetailItem label="Roll Number" value={ACADEMIC_INFO.rollNumber} />
              <DetailItem label="Admission Number" value={ACADEMIC_INFO.admissionNumber} />
              <DetailItem label="Admission Date" value={ACADEMIC_INFO.admissionDate} />
              <DetailItem label="Class" value={ACADEMIC_INFO.className} />
              <DetailItem label="Section" value={ACADEMIC_INFO.section} />
              <DetailItem label="Academic Session" value={ACADEMIC_INFO.academicSession} />
              <DetailItem label="Medium" value={ACADEMIC_INFO.medium} />
              <DetailItem label="Category" value={ACADEMIC_INFO.category} />
              <DetailItem label="Phone" value={sessionData.user.phoneNormalized} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact & Address</CardTitle>
              <CardDescription>Communication details on file.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm">
              <DetailItem label="Email" value={CONTACT_INFO.email} />
              <DetailItem label="Alternate Phone" value={CONTACT_INFO.alternatePhone} />
              <DetailItem label="Address" value={CONTACT_INFO.address} full />
              <div className="grid grid-cols-2 gap-4">
                <DetailItem label="City" value={CONTACT_INFO.city} />
                <DetailItem label="State" value={CONTACT_INFO.state} />
              </div>
              <DetailItem label="Pincode" value={CONTACT_INFO.pincode} />
            </CardContent>
          </Card>
        </div>

        {/* Health Info */}
        <Card>
          <CardHeader>
            <CardTitle>Health & Medical</CardTitle>
            <CardDescription>Health records for emergency reference.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 text-sm">
            <DetailItem label="Blood Group" value={HEALTH_INFO.bloodGroup} />
            <DetailItem label="Height" value={HEALTH_INFO.height} />
            <DetailItem label="Weight" value={HEALTH_INFO.weight} />
            <DetailItem label="Allergies" value={HEALTH_INFO.allergies} />
            <DetailItem label="Medical Notes" value={HEALTH_INFO.medicalNotes} />
          </CardContent>
        </Card>

        {/* Guardian Details */}
        <Card>
          <CardHeader>
            <CardTitle>Guardian Details</CardTitle>
            <CardDescription>Parent / guardian contact information.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {GUARDIAN_INFO.map((g) => (
              <div
                key={g.relation}
                className="rounded-lg border border-slate-100 dark:border-slate-700 p-4 space-y-2"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">{g.relation}</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{g.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{g.phone}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{g.occupation}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Session Info */}
        <Card>
          <CardHeader>
            <CardTitle>Session & Account</CardTitle>
            <CardDescription>Your current login session details.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <DetailItem label="Role" value={primaryRole.replace(/_/g, ' ')} />
            <DetailItem label="Session Status" value="Active" />
            <DetailItem label="Teacher ID" value={sessionData.profiles?.teacherProfileId ?? '—'} />
            <DetailItem label="Parent ID" value={sessionData.profiles?.parentProfileId ?? '—'} />
          </CardContent>
        </Card>
      </div>
    </PortalShell>
  );
}

function DetailItem({ label, value, full }) {
  return (
    <div className={full ? 'sm:col-span-2' : undefined}>
      <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="text-slate-900 dark:text-slate-100 font-medium mt-1">{value}</p>
    </div>
  );
}