'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/**
 * Top bar header for authenticated role portals.
 *
 * @param {{
 *   title: string,
 *   userLabel?: string,
 *   roleLabel?: string,
 *   sessionLabel?: string,
 *   onOpenMobileMenu?: () => void,
 *   onLogout?: () => void,
 *   rightSlot?: import('react').ReactNode,
 * }} props
 */
export function Topbar({
  title,
  userLabel,
  roleLabel,
  sessionLabel = '2026-2027',
  onOpenMobileMenu,
  onLogout,
  rightSlot,
}) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3">
        {onOpenMobileMenu ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenMobileMenu}
            aria-label="Open navigation menu"
            className="lg:hidden"
          >
            Menu
          </Button>
        ) : null}
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        {sessionLabel ? <Badge variant="primary">Session {sessionLabel}</Badge> : null}
      </div>

      <div className="flex items-center gap-3">
        {rightSlot}
        {userLabel ? (
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-slate-900">{userLabel}</p>
            {roleLabel ? <p className="text-xs text-slate-500">{roleLabel}</p> : null}
          </div>
        ) : null}
        {onLogout ? (
          <Button variant="outline" size="sm" onClick={onLogout}>
            Sign out
          </Button>
        ) : null}
      </div>
    </header>
  );
}
