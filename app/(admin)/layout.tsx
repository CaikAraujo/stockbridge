import { redirect } from 'next/navigation';
import { AdminSidebar } from '@/components/admin/layout/sidebar';
import { auth } from '@/lib/auth/config';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role === 'driver') redirect('/driver');

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <AdminSidebar />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">{children}</div>
    </div>
  );
}
