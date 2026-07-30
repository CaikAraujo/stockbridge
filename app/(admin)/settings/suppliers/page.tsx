import { AdminTopbar } from '@/components/admin/layout/topbar';
import { createServerClient } from '@/lib/trpc/server';
import { SuppliersManager } from './suppliers-manager';

export default async function SuppliersPage() {
  const api = await createServerClient();
  const data = await api.suppliers.list({ page: 1, limit: 50, includeInactive: false });

  return (
    <>
      <AdminTopbar title="Fournisseurs" subtitle="Gestion des fournisseurs" />
      <main className="flex-1 overflow-auto p-5 screen-enter">
        <SuppliersManager initialData={data} />
      </main>
    </>
  );
}
