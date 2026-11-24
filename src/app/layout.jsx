import './globals.css';

export const metadata = {
  title: 'Apex Coaching Institute — Student Management System',
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
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
