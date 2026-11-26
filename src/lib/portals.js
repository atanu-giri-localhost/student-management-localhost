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
      icon: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
      tabActive: 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300',
      darkIcon: 'bg-blue-400/10 text-blue-300',
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
      icon: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
      tabActive: 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300',
      darkIcon: 'bg-blue-400/10 text-blue-300',
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
      icon: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
      tabActive: 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300',
      darkIcon: 'bg-blue-400/10 text-blue-300',
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
      icon: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
      tabActive: 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300',
      darkIcon: 'bg-blue-400/10 text-blue-300',
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
      icon: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
      tabActive: 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300',
      darkIcon: 'bg-blue-400/10 text-blue-300',
    },
  },
];

const PORTALS_BY_KEY = Object.fromEntries(PORTALS.map((portal) => [portal.key]));

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