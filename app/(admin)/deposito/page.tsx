import { DepositoView } from '@/components/admin/deposito/deposito-view';
import { AdminTopbar } from '@/components/admin/layout/topbar';
import { createServerClient } from '@/lib/trpc/server';

export default async function DepositoPage() {
  const api = await createServerClient();
  const data = await api.locations.warehouseStock();

  return (
    <>
      <AdminTopbar title="Depósito" subtitle={data.warehouse?.name ?? 'Stock central'} />
      <main className="flex-1 overflow-auto p-5">
        <DepositoView warehouse={data.warehouse} items={data.items} movements={data.movements} />
      </main>
    </>
  );
}
