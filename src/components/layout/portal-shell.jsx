'use client';

import { useState } from 'react';
import { getNavItemsForRole } from '@/components/layout/nav-config';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';

/**
 * Shared desktop & mobile portal shell wrapper.
 *
 * @param {{
 *   roleName: string,
 *   roleLabel?: string,
 *   pageTitle: string,
 *   activePath?: string,
 *   userLabel?: string,
 *   sessionLabel?: string,
 *   onLogout?: () => void,
 *   topbarRightSlot?: import('react').ReactNode,
 *   children: import('react').ReactNode,
 * }} props
 */
export function PortalShell({
  roleName,
  roleLabel,
  pageTitle,
  activePath,
  userLabel,
  sessionLabel,
  onLogout,
  topbarRightSlot,
  children,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navItems = getNavItemsForRole(roleName);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <Sidebar
        items={navItems}
        activePath={activePath}
        roleLabel={roleLabel ?? roleName}
        openMobile={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          title={pageTitle}
          userLabel={userLabel}
          roleLabel={roleLabel ?? roleName}
          sessionLabel={sessionLabel}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onLogout={onLogout}
          rightSlot={topbarRightSlot}
        />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
