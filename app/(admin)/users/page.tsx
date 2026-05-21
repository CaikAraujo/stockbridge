import { AdminTopbar } from '@/components/admin/layout/topbar';
import { UsersTable } from '@/components/admin/users/users-table';
import { createServerClient } from '@/lib/trpc/server';

export default async function UsersPage() {
  const api = await createServerClient();
  const users = await api.users.list();

  return (
    <>
      <AdminTopbar title="Usuários" subtitle="Gestão de motoristas e administradores" />
      <main className="flex-1 overflow-auto p-5">
        <UsersTable initialData={users} />
      </main>
    </>
  );
}
