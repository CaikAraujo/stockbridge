import { GasBottlesList } from '@/components/admin/gas-bottles/gas-bottles-list';
import { AdminTopbar } from '@/components/admin/layout/topbar';
import { createServerClient } from '@/lib/trpc/server';

export default async function GasBottlesPage() {
  const api = await createServerClient();
  const [bottles, locations] = await Promise.all([
    api.gasBottles.list(),
    api.locations.list({ active: true }),
  ]);

  return (
    <>
      <AdminTopbar title="Garrafas de gás" subtitle="Gestão e rastreio de garrafas" />
      <main className="flex-1 overflow-auto p-5">
        <GasBottlesList initialData={bottles} locations={locations} />
      </main>
    </>
  );
}
