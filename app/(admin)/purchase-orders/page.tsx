import { AdminTopbar } from '@/components/admin/layout/topbar';
import { createServerClient } from '@/lib/trpc/server';
import { PurchaseOrdersList } from './purchase-orders-list';

export default async function PurchaseOrdersPage() {
  const api = await createServerClient();
  const data = await api.purchaseOrders.list({ page: 1, limit: 50 });

  return (
    <>
      <AdminTopbar title="Commandes fournisseurs" subtitle="Historique des commandes d'achat" />
      <main className="flex-1 overflow-auto p-5 screen-enter">
        <PurchaseOrdersList initialData={data} />
      </main>
    </>
  );
}
