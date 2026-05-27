import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { AdminSidebar } from '@/components/admin/layout/sidebar';
import { db } from '@/db/client';
import { auth } from '@/lib/auth/config';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role === 'driver') redirect('/driver');

  // Admins com TOTP ativo devem ter verificado o código nesta sessão
  if (session.user.role === 'admin') {
    const user = await db.query.users.findFirst({
      where: (u) => eq(u.id, session.user.id),
      columns: { totpSecret: true },
    });

    if (user?.totpSecret) {
      const currentSession = await db.query.sessions.findFirst({
        where: (s) => eq(s.userId, session.user.id),
        columns: { totpVerified: true },
      });

      if (!currentSession?.totpVerified) {
        redirect('/login/totp');
      }
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <AdminSidebar />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">{children}</div>
    </div>
  );
}
