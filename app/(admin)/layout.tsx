import { desc, eq } from 'drizzle-orm';
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
      // Sessão mais recente do usuário — Auth.js não expõe sessionToken no objeto Session
      const currentSession = await db.query.sessions.findFirst({
        where: (s) => eq(s.userId, session.user.id),
        columns: { totpVerified: true },
        orderBy: (s) => desc(s.createdAt),
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
