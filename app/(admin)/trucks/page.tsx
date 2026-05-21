import { AdminTopbar } from '@/components/admin/layout/topbar';
import { TrucksManager } from '@/components/admin/trucks/trucks-manager';
import { createServerClient } from '@/lib/trpc/server';

export default async function TrucksPage() {
  const api = await createServerClient();
  const [trucks, drivers] = await Promise.all([
    api.locations.list({ type: 'truck', active: true }),
    api.drivers.list(),
  ]);

  return (
    <>
      <AdminTopbar title="Caminhões" subtitle="Atribuição de motoristas" />
      <main className="flex-1 overflow-auto p-5">
        <TrucksManager trucks={trucks} drivers={drivers} />
      </main>
    </>
  );
}
