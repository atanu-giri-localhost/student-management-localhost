'use client';

import { useState } from 'react';
import { getNavItemsForRole } from '@/components/layout/nav-config';
import { PageContainer } from '@/components/layout/PageContainer';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';

/**
 * Shared desktop & mobile portal shell wrapper.
 *
 * Desktop: fixed left sidebar (w-60 lg:w-64) + sticky topbar + scrollable content.
 * Mobile: sidebar drawer overlay via Sidebar component.
 *
 * @param {{
 *   roleName: string,
 *   roleLabel?: string,
 *   pageTitle: string,
 *   activePath?: string,
 *   userLabel?: string,
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
  onLogout,
  topbarRightSlot,
  children,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navItems = getNavItemsForRole(roleName);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Sidebar
        items={navItems}
        activePath={activePath}
        roleLabel={roleLabel ?? roleName}
        openMobile={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onLogout={onLogout}
      />

      <div className="flex min-w-0 flex-1 flex-col lg:ml-64 lg:w-[calc(100%-256px)]">
        <header className="sticky top-0 z-30 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700">
          <Topbar
            title={pageTitle}
            userLabel={userLabel}
            roleLabel={roleLabel ?? roleName}
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
            onLogout={onLogout}
            rightSlot={topbarRightSlot}
          />
        </header>
        <main className="flex-1">
          <PageContainer size="standard" padding="default">{children}</PageContainer>
        </main>
      </div>
    </div>
  );
}
