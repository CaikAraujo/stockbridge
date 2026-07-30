import { AdminTopbar } from '@/components/admin/layout/topbar';
import { createServerClient } from '@/lib/trpc/server';
import { RestockTabs } from './restock-tabs';

export default async function RestockPage() {
  const api = await createServerClient();

  const [criticalRows, template] = await Promise.all([
    api.purchaseOrders.getCriticalArticles(),
    api.purchaseOrders.getEmailTemplate(),
  ]);

  const articles = criticalRows;

  return (
    <>
      <AdminTopbar
        title="Réapprovisionnement"
        subtitle="Articles critiques et commandes fournisseurs"
      />
      <main className="flex-1 overflow-auto p-5 screen-enter">
        <RestockTabs articles={articles} template={template} />
      </main>
    </>
  );
}
