import { eq } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminSidebar } from '@/components/admin/layout/sidebar';
import { AdminShell } from '@/components/admin/layout/shell';
import { db } from '@/db/client';
import { auth } from '@/lib/auth/config';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role === 'driver') redirect('/driver');

  // Admins e managers com TOTP ativo devem ter verificado o código nesta sessão
  if (session.user.role === 'admin' || session.user.role === 'manager') {
    const headersList = await headers();
    const pathname = headersList.get('x-pathname') ?? '';
    const isTotpSetupPage = pathname.includes('/settings/totp');

    if (!isTotpSetupPage) {
      const user = await db.query.users.findFirst({
        where: (u) => eq(u.id, session.user.id),
        columns: { totpSecret: true },
      });

      if (!user?.totpSecret) {
        redirect('/login?error=totp_required');
      }

      const cookieStore = await cookies();
      const sessionToken =
        cookieStore.get('authjs.session-token')?.value ??
        cookieStore.get('__Secure-authjs.session-token')?.value;

      if (!sessionToken) redirect('/login');

      const currentSession = await db.query.sessions.findFirst({
        where: (s, { eq: eqFn }) => eqFn(s.sessionToken, sessionToken),
        columns: { totpVerified: true },
      });

      if (!currentSession?.totpVerified) {
        redirect('/login/totp');
      }
    }
  }

  return (
    <AdminShell>
      <AdminSidebar />
      <div className="main">{children}</div>
    </AdminShell>
  );
}
