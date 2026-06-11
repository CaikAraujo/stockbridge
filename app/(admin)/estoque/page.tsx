import { Suspense } from 'react';
import { EstoqueScreen } from '@/components/admin/estoque/estoque-screen';
import { AdminTopbar } from '@/components/admin/layout/topbar';
import { createServerClient } from '@/lib/trpc/server';

export default async function EstoquePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const api = await createServerClient();

  const [warehouseData, articlesData, bottles, movements, locations, drivers] =
    await Promise.all([
      api.locations.warehouseStock(),
      api.articles.list({ page: 1, limit: 100, active: true }),
      api.gasBottles.list(),
      api.movements.list({ page: 1, limit: 50 }),
      api.locations.list({ active: true }),
      api.drivers.list(),
    ]);

  return (
    <>
      <AdminTopbar title="Estoque" subtitle="Gestão de estoque" />
      <main className="flex-1 overflow-auto p-5">
        <Suspense>
          <EstoqueScreen
            defaultTab={tab ?? 'deposito'}
            warehouseData={warehouseData}
            articlesData={articlesData}
            bottles={bottles}
            movements={movements}
            locations={locations}
            drivers={drivers}
          />
        </Suspense>
      </main>
    </>
  );
}
