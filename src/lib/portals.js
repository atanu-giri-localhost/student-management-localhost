/**
 * Presentation metadata for the five role portals.
 *
 * UI navigation is never an authorization boundary; server-side RBAC remains
 * the source of truth for every protected operation.
 */
export const PORTALS = [
  {
    key: 'super_admin',
    label: 'Super Admin',
    title: 'Super Administrator',
    description: 'Full institutional access including audit logs and user management.',
    loginDescription: 'Manage users, roles, sessions, audit logs and all institutional settings.',
    icon: 'admin',
    href: '/login?portal=super_admin',
    accent: {
      icon: 'bg-purple-50 text-purple-600',
      tabActive: 'border-purple-300 bg-purple-50 text-purple-700',
      darkIcon: 'bg-purple-400/10 text-purple-300 ring-purple-400/30',
    },
  },
  {
    key: 'admin',
    label: 'Admin',
    title: 'Administrator',
    description: 'Students, staff, academics and fees.',
    loginDescription: 'Manage student records, academic setup, attendance and fees.',
    icon: 'admin',
    href: '/login?portal=admin',
    accent: {
      icon: 'bg-indigo-50 text-indigo-600',
      tabActive: 'border-indigo-300 bg-indigo-50 text-indigo-700',
      darkIcon: 'bg-indigo-400/10 text-indigo-300 ring-indigo-400/30',
    },
  },
  {
    key: 'teacher',
    label: 'Teacher',
    title: 'Teacher',
    description: 'Assigned classes, attendance and marks.',
    loginDescription: 'Access your assigned classes, attendance registers and marks.',
    icon: 'teacher',
    href: '/login?portal=teacher',
    accent: {
      icon: 'bg-sky-50 text-sky-600',
      tabActive: 'border-sky-300 bg-sky-50 text-sky-700',
      darkIcon: 'bg-sky-400/10 text-sky-300 ring-sky-400/30',
    },
  },
  {
    key: 'parent',
    label: 'Parent',
    title: 'Parent',
    description: "Your child's progress and fee receipts.",
    loginDescription: "View your children's attendance, results and fee receipts.",
    icon: 'parent',
    href: '/login?portal=parent',
    accent: {
      icon: 'bg-amber-50 text-amber-600',
      tabActive: 'border-amber-300 bg-amber-50 text-amber-700',
      darkIcon: 'bg-amber-400/10 text-amber-300 ring-amber-400/30',
    },
  },
  {
    key: 'student',
    label: 'Student',
    title: 'Student',
    description: 'Timetable, attendance and exam results.',
    loginDescription: 'View your timetable, attendance, performance and results.',
    icon: 'student',
    href: '/login?portal=student',
    accent: {
      icon: 'bg-emerald-50 text-emerald-600',
      tabActive: 'border-emerald-300 bg-emerald-50 text-emerald-700',
      darkIcon: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/30',
    },
  },
];

const PORTALS_BY_KEY = Object.fromEntries(PORTALS.map((portal) => [portal.key, portal]));

/**
 * Look up a portal by its URL key.
 *
 * @param {string | null | undefined} key
 * @returns {(typeof PORTALS)[number] | null}
 */
export function getPortalByKey(key) {
  if (typeof key !== 'string') {
    return null;
  }
  return PORTALS_BY_KEY[key] ?? null;
}
