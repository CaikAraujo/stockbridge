import { AdminTopbar } from '@/components/admin/layout/topbar';
import { RapportsList } from '@/components/admin/rapports/rapports-list';
import { createServerClient } from '@/lib/trpc/server';

export default async function RapportsPage() {
  const api = await createServerClient();

  const [rapports, trucks] = await Promise.all([
    api.rapports.list({ status: 'pending' }),
    api.locations.list({ type: 'truck', active: true }),
  ]);

  return (
    <>
      <AdminTopbar title="Rapports InterFast" subtitle="Consumos pendentes de confirmação" />
      <main className="flex-1 overflow-auto p-5">
        <RapportsList initialData={rapports} trucks={trucks} />
      </main>
    </>
  );
}
