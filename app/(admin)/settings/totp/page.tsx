import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { AdminTopbar } from '@/components/admin/layout/topbar';
import { TotpSetup } from '@/components/admin/settings/totp-setup';
import { db } from '@/db/client';
import { auth } from '@/lib/auth/config';

export default async function TotpSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'admin') redirect('/dashboard');

  const user = await db.query.users.findFirst({
    where: (u) => eq(u.id, session.user.id),
    columns: { totpSecret: true },
  });

  return (
    <>
      <AdminTopbar
        title="Autenticação em dois fatores"
        subtitle="TOTP — Google Authenticator / Authy"
      />
      <main className="flex-1 overflow-auto p-5">
        <div className="mx-auto max-w-lg">
          <TotpSetup totpEnabled={!!user?.totpSecret} />
        </div>
      </main>
    </>
  );
}
