'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * Responsive sidebar navigation panel for authenticated portals.
 *
 * @param {{
 *   items: { label: string, href: string }[],
 *   activePath?: string,
 *   roleLabel?: string,
 *   instituteName?: string,
 *   openMobile?: boolean,
 *   onCloseMobile?: () => void,
 * }} props
 */
export function Sidebar({
  items,
  activePath = '',
  roleLabel = 'Portal',
  instituteName = 'Apex Coaching Institute',
  openMobile = false,
  onCloseMobile,
}) {
  const navContent = (
    <div className="flex h-full flex-col justify-between bg-white px-4 py-5">
      <div>
        <div className="border-b border-slate-100 pb-4">
          <p className="text-[11px] font-semibold tracking-wider text-indigo-600 uppercase">
            {instituteName}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{roleLabel}</p>
        </div>

        <nav aria-label="Portal navigation" className="mt-4 flex flex-col gap-1">
          {items.map((item) => {
            const isActive = activePath === item.href || activePath.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm font-medium transition',
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-slate-100 pt-4 text-xs text-slate-400">
        <span>SMS Phase 1 Shell</span>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:block">
        {navContent}
      </aside>

      {openMobile ? (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={onCloseMobile}
            className="fixed inset-0 bg-slate-900/40"
          />
          <aside className="relative z-10 w-64 border-r border-slate-200 bg-white shadow-xl">
            {navContent}
          </aside>
        </div>
      ) : null}
    </>
  );
}
