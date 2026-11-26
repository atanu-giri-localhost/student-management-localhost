'use client';

import { useEffect } from 'react';
import { useSyncExternalStore } from 'react';
import { MoonIcon, SunIcon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

function subscribe(callback) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}

function getSnapshot() {
  return document.documentElement.classList.contains('dark');
}

function getServerSnapshot() {
  return false;
}

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    const stored = localStorage.getItem('sms-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored ? stored === 'dark' : prefersDark;
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('sms-theme', next ? 'dark' : 'light');
  }

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={dark}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={cn(
        'relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition-colors duration-300',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2',
        dark
          ? 'border-slate-600 bg-slate-700'
          : 'border-slate-300 bg-slate-200',
      )}
    >
      <span
        className={cn(
          'inline-flex h-6 w-6 items-center justify-center rounded-full transition-all duration-300 ease-in-out',
          dark
            ? 'translate-x-7 bg-slate-900 text-amber-400'
            : 'translate-x-1 bg-white text-slate-600',
        )}
      >
        <span className="relative flex h-4 w-4 items-center justify-center">
          <SunIcon
            className={cn(
              'absolute h-4 w-4 transition-all duration-300',
              dark ? 'scale-0 rotate-90 opacity-0' : 'scale-100 rotate-0 opacity-100',
            )}
          />
          <MoonIcon
            className={cn(
              'absolute h-4 w-4 transition-all duration-300',
              dark ? 'scale-100 rotate-0 opacity-100' : 'scale-0 -rotate-90 opacity-0',
            )}
          />
        </span>
      </span>
    </button>
  );
}