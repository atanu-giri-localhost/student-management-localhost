import './globals.css';

export const metadata = {
  title: 'Shri Ramkrishna Bhaban — Student Management System',
  description:
    'Unified Student Management System for coaching academics, dual attendance, and integer-paise fee & mess ledger.',
};

/**
 * Root Next.js App Router layout for the SMS portal.
 *
 * @param {{ children: import('react').ReactNode }} props
 */
export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('sms-theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}
