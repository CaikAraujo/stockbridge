import { AdminTopbar } from '@/components/admin/layout/topbar';
import { ManualMovementForm } from '@/components/admin/movements/manual-movement-form';
import { createServerClient } from '@/lib/trpc/server';

export default async function NewMovementPage() {
  const api = await createServerClient();

  const [articlesResult, locations] = await Promise.all([
    api.articles.list({ page: 1, limit: 200, active: true }),
    api.locations.list({ active: true }),
  ]);

  return (
    <>
      <AdminTopbar title="Nova movimentação" subtitle="Entrada, ajuste ou transferência manual" />
      <main className="flex-1 overflow-auto p-5">
        <div className="mx-auto max-w-2xl">
          <ManualMovementForm
            articles={articlesResult.items.map((a) => ({
              id: a.id,
              name: a.name,
              sku: a.sku,
              unit: a.unit,
            }))}
            locations={locations.map((l) => ({
              id: l.id,
              name: l.name,
              code: l.code,
              type: l.type,
            }))}
          />
        </div>
      </main>
    </>
  );
}
