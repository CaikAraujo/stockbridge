import { AdminTopbar } from '@/components/admin/layout/topbar';
import { MovementsTable } from '@/components/admin/movements/movements-table';
import { createServerClient } from '@/lib/trpc/server';

export default async function MovementsPage() {
  const api = await createServerClient();

  const [movements, locations, drivers] = await Promise.all([
    api.movements.list({ page: 1, limit: 50 }),
    api.locations.list({ active: true }),
    api.drivers.list(),
  ]);

  return (
    <>
      <AdminTopbar title="Movimentações" subtitle="Histórico completo de entradas e saídas" />
      <main className="flex-1 overflow-auto p-5">
        <MovementsTable initialData={movements} locations={locations} drivers={drivers} />
      </main>
    </>
  );
}
