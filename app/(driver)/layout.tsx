import { redirect } from 'next/navigation';
import { Toaster } from 'sonner';
import { auth } from '@/lib/auth/config';

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) redirect('/login');
  if (session.user.role !== 'driver' && session.user.role !== 'admin') {
    redirect('/dashboard');
  }

  return (
    <div className="mx-auto flex h-screen max-w-[430px] flex-col overflow-hidden bg-surface">
      <Toaster position="top-center" richColors />
      {children}
    </div>
  );
}
