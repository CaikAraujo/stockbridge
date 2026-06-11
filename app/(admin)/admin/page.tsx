import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { AdminScreen } from '@/components/admin/admin-screen/admin-screen';
import { AdminTopbar } from '@/components/admin/layout/topbar';
import { db } from '@/db/client';
import { auth } from '@/lib/auth/config';
import { createServerClient } from '@/lib/trpc/server';

interface AdminPageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'admin') redirect('/dashboard');

  const { tab = 'usuarios' } = await searchParams;

  const api = await createServerClient();
  const users = await api.users.list();

  const dbUser = await db.query.users.findFirst({
    where: (u) => eq(u.id, session.user.id),
    columns: { totpSecret: true },
  });

  const SUB: Record<string, string> = {
    usuarios:  'Gestão de motoristas e administradores',
    seguranca: 'Autenticação e proteção da conta',
  };

  return (
    <>
      <AdminTopbar
        title="Administração"
        subtitle={SUB[tab] ?? SUB.usuarios}
      />
      <main className="flex-1 overflow-auto p-5">
        <AdminScreen
          initialUsers={users}
          totpEnabled={!!dbUser?.totpSecret}
          defaultTab={tab}
        />
      </main>
    </>
  );
}
