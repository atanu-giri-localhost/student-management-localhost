'use client';

import { ErrorBanner } from '@/components/data-display/error-banner';
import { LoadingSkeleton } from '@/components/data-display/loading-skeleton';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { StatCard } from '@/components/data-display/stat-card';
import { PortalShell } from '@/components/layout/portal-shell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession } from '@/lib/auth/use-session';
import { cn } from '@/lib/utils';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PERIODS = [
  { period: 1, start: '08:30', end: '09:15' },
  { period: 2, start: '09:15', end: '10:00' },
  { period: 3, start: '10:15', end: '11:00' },
  { period: 4, start: '11:00', end: '11:45' },
  { period: 5, start: '12:00', end: '12:45' },
  { period: 6, start: '13:30', end: '14:15' },
  { period: 7, start: '14:15', end: '15:00' },
  { period: 8, start: '15:00', end: '15:45' },
];

const SUBJECT_COLORS = {
  Mathematics: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  Physics: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  Chemistry: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  Biology: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  English: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
};

const TIMETABLE = {
  Mon: { 1: { subject: 'Mathematics', room: 'R-201', teacher: 'Mr. A. Sharma' }, 2: { subject: 'Physics', room: 'R-202', teacher: 'Mrs. P. Sen' } },
  Tue: { 3: { subject: 'Chemistry', room: 'R-203', teacher: 'Dr. K. Mehta' }, 4: { subject: 'Biology', room: 'R-204', teacher: 'Mrs. R. Iyer' } },
  Wed: { 5: { subject: 'English', room: 'R-205', teacher: 'Mr. D. Roy' }, 6: { subject: 'Mathematics', room: 'R-201', teacher: 'Mr. A. Sharma' } },
  Thu: { 7: { subject: 'Physics', room: 'R-202', teacher: 'Mrs. P. Sen' }, 8: { subject: 'Chemistry', room: 'R-203', teacher: 'Dr. K. Mehta' } },
  Fri: { 2: { subject: 'Biology', room: 'R-204', teacher: 'Mrs. R. Iyer' }, 3: { subject: 'English', room: 'R-205', teacher: 'Mr. D. Roy' } },
  Sat: { 4: { subject: 'Mathematics', room: 'R-201', teacher: 'Mr. A. Sharma' }, 5: { subject: 'Physics', room: 'R-202', teacher: 'Mrs. P. Sen' } },
};

const TODAY = new Date().toLocaleDateString('en-US', { weekday: 'short' });

const TEACHERS = [
  { name: 'Mr. A. Sharma', subject: 'Mathematics', room: 'R-201', email: 'a.sharma@sms.edu.in' },
  { name: 'Mrs. P. Sen', subject: 'Physics', room: 'R-202', email: 'p.sen@sms.edu.in' },
  { name: 'Dr. K. Mehta', subject: 'Chemistry', room: 'R-203', email: 'k.mehta@sms.edu.in' },
  { name: 'Mrs. R. Iyer', subject: 'Biology', room: 'R-204', email: 'r.iyer@sms.edu.in' },
  { name: 'Mr. D. Roy', subject: 'English', room: 'R-205', email: 'd.roy@sms.edu.in' },
];

const EXAM_SCHEDULE = [
  { exam: 'Unit Test 4', date: '2026-12-05', day: 'Saturday', time: '09:00 – 12:00', subjects: 'Mathematics, Physics', room: 'Exam Hall A' },
  { exam: 'Mid-Term 2027', date: '2026-12-15', day: 'Tuesday', time: '09:00 – 12:00', subjects: 'All Subjects', room: 'Exam Hall A' },
];

function getClass(day, period) {
  return TIMETABLE[day]?.[period] ?? null;
}

export default function StudentTimetablePage() {
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
      pageTitle="Student Timetable"
      activePath="/student/timetable"
      userLabel={sessionData.user.phoneNormalized}
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        <SectionHeader
          title="Timetable"
          description="Weekly class schedule, teacher contacts, and upcoming exams."
        />

        {/* Quick Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Periods/Day" value="8" subtitle="Monday to Saturday" />
          <StatCard title="Subjects" value="5" subtitle="Enrolled this session" />
          <StatCard title="Teachers" value={TEACHERS.length.toString()} subtitle="Assigned to your class" />
          <StatCard title="Upcoming Exams" value={EXAM_SCHEDULE.length.toString()} subtitle="Next 30 days" />
        </div>

        {/* Weekly Schedule Grid */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Schedule</CardTitle>
            <CardDescription>Monday to Saturday — 8 periods per day.</CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-[auto_repeat(6,1fr)] border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                <div className="px-2 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 text-center">Period</div>
                {DAYS.map((day) => (
                  <div
                    key={day}
                    className={cn(
                      'px-2 py-2 text-xs font-semibold text-center border-l border-slate-200 dark:border-slate-700',
                      day === TODAY
                        ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30'
                        : 'text-slate-600 dark:text-slate-400'
                    )}
                  >
                    {day}
                  </div>
                ))}
              </div>
              {PERIODS.map((p) => (
                <div key={p.period} className="grid grid-cols-[auto_repeat(6,1fr)] border-b border-slate-100 dark:border-slate-700 last:border-b-0">
                  <div className="px-2 py-2 text-center bg-slate-50 dark:bg-slate-800">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">P{p.period}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{p.start}</p>
                  </div>
                  {DAYS.map((day) => {
                    const cls = getClass(day, p.period);
                    return (
                      <div key={`${day}-${p.period}`} className="px-1 py-1 border-l border-slate-100 dark:border-slate-700">
                        {cls ? (
                          <div className={cn('rounded-lg border px-2 py-2 text-xs text-center', SUBJECT_COLORS[cls.subject])}>
                            <p className="font-medium">{cls.subject}</p>
                            <p className="text-xs opacity-75">{cls.room}, {cls.teacher}</p>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-600 px-2 py-2 text-xs text-center text-slate-400 dark:text-slate-500">
                            Free
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Subject Legend */}
          <Card>
            <CardHeader>
              <CardTitle>Subject Legend</CardTitle>
              <CardDescription>Color codes for subjects.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              {Object.entries(SUBJECT_COLORS).map(([subject, classes]) => (
                <Badge key={subject} variant="default" className={cn('border', classes)}>
                  {subject}
                </Badge>
              ))}
            </CardContent>
          </Card>

          {/* Today&apos;s Classes */}
          <Card>
            <CardHeader>
              <CardTitle>Today&apos;s Classes</CardTitle>
              <CardDescription>{TODAY}&apos;s schedule at a glance.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {PERIODS.map((p) => {
                const cls = getClass(TODAY, p.period);
                if (!cls) return null;
                return (
                  <div key={p.period} className="flex items-center gap-3 rounded-lg border border-slate-100 dark:border-slate-700 px-3 py-2">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 w-8">P{p.period}</span>
                    <Badge variant="default" className={cn('border', SUBJECT_COLORS[cls.subject])}>{cls.subject}</Badge>
                    <span className="text-xs text-slate-500 dark:text-slate-400 ml-auto">{p.start}–{p.end}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{cls.room}</span>
                  </div>
                );
              })}
              {PERIODS.every((p) => !getClass(TODAY, p.period)) && (
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">No classes today.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Teacher Directory */}
        <Card>
          <CardHeader>
            <CardTitle>Teacher Directory</CardTitle>
            <CardDescription>Subject teachers and their contact details.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-full border-collapse text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Teacher</th>
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Room</th>
                    <th className="px-4 py-3">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {TEACHERS.map((t) => (
                    <tr key={t.name} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">{t.name}</td>
                      <td className="px-4 py-3">
                        <Badge variant="default" className={cn('border', SUBJECT_COLORS[t.subject])}>{t.subject}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{t.room}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{t.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Exams */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Exams</CardTitle>
            <CardDescription>Scheduled examinations and their details.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-full border-collapse text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Exam</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Day</th>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Subjects</th>
                    <th className="px-4 py-3">Room</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {EXAM_SCHEDULE.map((row) => (
                    <tr key={row.exam} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">{row.exam}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{row.date}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{row.day}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{row.time}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{row.subjects}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{row.room}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </PortalShell>
  );
}