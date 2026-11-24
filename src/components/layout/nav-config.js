/**
 * Presentation-only role navigation links matching FRONTEND_AND_UI_SPEC.
 * Note: UI navigation is never an authorization boundary; server RBAC enforces all routes.
 */

export const ROLE_PORTAL_NAVIGATION = {
  SUPER_ADMIN: [
    { label: 'Dashboard', href: '/admin/dashboard' },
    { label: 'Students', href: '/admin/students' },
    { label: 'Parents', href: '/admin/parents' },
    { label: 'Teachers', href: '/admin/teachers' },
    { label: 'Academics', href: '/admin/academics' },
    { label: 'Attendance', href: '/admin/attendance' },
    { label: 'Examinations', href: '/admin/examinations' },
    { label: 'Timetable', href: '/admin/timetable' },
    { label: 'Finance & Mess Fees', href: '/admin/finance' },
    { label: 'Reports', href: '/admin/reports' },
    { label: 'Audit Logs', href: '/admin/audit-logs' },
  ],
  COACHING_ADMIN: [
    { label: 'Dashboard', href: '/admin/dashboard' },
    { label: 'Students', href: '/admin/students' },
    { label: 'Parents', href: '/admin/parents' },
    { label: 'Teachers', href: '/admin/teachers' },
    { label: 'Academics', href: '/admin/academics' },
    { label: 'Attendance', href: '/admin/attendance' },
    { label: 'Examinations', href: '/admin/examinations' },
    { label: 'Timetable', href: '/admin/timetable' },
    { label: 'Finance & Mess Fees', href: '/admin/finance' },
    { label: 'Reports', href: '/admin/reports' },
  ],
  TEACHER: [
    { label: 'Dashboard', href: '/teacher/dashboard' },
    { label: 'My Classes', href: '/teacher/my-classes' },
    { label: 'Attendance', href: '/teacher/attendance' },
    { label: 'Daily Performance', href: '/teacher/performance' },
    { label: 'Examinations', href: '/teacher/examinations' },
    { label: 'Timetable', href: '/teacher/timetable' },
    { label: 'Assigned Student Fees', href: '/teacher/assigned-fees' },
  ],
  STUDENT: [
    // Student role MUST NOT have any fee or finance links in MVP.
    { label: 'Dashboard', href: '/student/dashboard' },
    { label: 'Profile', href: '/student/profile' },
    { label: 'Attendance', href: '/student/attendance' },
    { label: 'Performance', href: '/student/performance' },
    { label: 'Exam Results', href: '/student/results' },
    { label: 'Timetable', href: '/student/timetable' },
  ],
  PARENT: [
    { label: 'Dashboard', href: '/parent/dashboard' },
    { label: 'Child Profile', href: '/parent/profile' },
    { label: 'Attendance', href: '/parent/attendance' },
    { label: 'Performance', href: '/parent/performance' },
    { label: 'Exam Results', href: '/parent/exam-results' },
    { label: 'Timetable', href: '/parent/timetable' },
    { label: 'Fee Status (View Only)', href: '/parent/fees' },
  ],
};

/**
 * Return navigation items for a given role name.
 *
 * @param {string} roleName
 * @returns {{ label: string, href: string }[]}
 */
export function getNavItemsForRole(roleName) {
  return ROLE_PORTAL_NAVIGATION[roleName] ?? [];
}
