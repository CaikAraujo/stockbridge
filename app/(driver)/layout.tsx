import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Toaster } from 'sonner';
import { OfflineIndicator } from '@/components/driver/offline-indicator';
import { auth } from '@/lib/auth/config';

export const metadata: Metadata = {
  themeColor: '#1D5FE0',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'StockBridge',
    statusBarStyle: 'black-translucent',
  },
};

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) redirect('/login');
  if (session.user.role !== 'driver' && session.user.role !== 'admin') {
    redirect('/dashboard');
  }

  return (
    <div
      className="mx-auto flex h-screen max-w-[430px] flex-col overflow-hidden"
      style={{ background: 'var(--driver-bg)', fontFamily: 'var(--font-driver)' }}
    >
      <OfflineIndicator />
      <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
      <Toaster position="top-center" richColors />
    </div>
  );
}
