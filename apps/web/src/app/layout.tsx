import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RegisterKaro — GST Registration',
  description: 'Internal ops platform for GST REG-01 automation',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
