import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { StoreProvider } from '@/lib/store';
import { AuthProvider } from '@/lib/auth-context';
import AppShell from '@/components/AppShell';

const jbMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jbm',
});

export const metadata: Metadata = {
  title: 'Gear Locker — TSD',
  description: 'Hub de operaciones de Team Six Devgru: eventos, roster, cuotas, inventario y briefings.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Gear Locker',
  },
};

export const viewport: Viewport = {
  themeColor: '#05080a',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={jbMono.variable}>
      <body>
        <AuthProvider>
          <StoreProvider>
            <AppShell>{children}</AppShell>
          </StoreProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
