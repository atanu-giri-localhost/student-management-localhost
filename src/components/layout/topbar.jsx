'use client';

import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { LogoutIcon, MenuIcon } from '@/components/ui/icons';

/**
 * Top bar header for authenticated role portals.
 *
 * @param {{
 *   title: string,
 *   userLabel?: string,
 *   roleLabel?: string,
 *   onOpenMobileMenu?: () => void,
 *   onLogout?: () => void,
 *   rightSlot?: import('react').ReactNode,
 * }} props
 */
export function Topbar({
  title,
  userLabel,
  roleLabel,
  onOpenMobileMenu,
  onLogout,
  rightSlot,
}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 sm:px-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        {onOpenMobileMenu ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenMobileMenu}
            aria-label="Open navigation menu"
            className="shrink-0 lg:hidden"
          >
            <MenuIcon className="h-4 w-4" />
          </Button>
        ) : null}
        <h1 className="truncate text-base font-semibold text-slate-900 sm:text-lg dark:text-slate-100">{title}</h1>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-3">
        {rightSlot}
        <ThemeToggle />
        {userLabel ? (
          <div className="hidden text-right md:block">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{userLabel}</p>
            {roleLabel ? <p className="text-xs text-slate-500 dark:text-slate-400">{roleLabel}</p> : null}
          </div>
        ) : null}
        {onLogout ? (
          <Button variant="outline" size="sm" onClick={onLogout} aria-label="Sign out" className="shrink-0">
            <LogoutIcon className="h-4 w-4 sm:hidden" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        ) : null}
      </div>
    </header>
  );
}