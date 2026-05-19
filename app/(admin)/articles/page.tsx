import { ArticlesTable } from '@/components/admin/articles/articles-table';
import { AdminTopbar } from '@/components/admin/layout/topbar';
import { createServerClient } from '@/lib/trpc/server';

export default async function ArticlesPage() {
  const api = await createServerClient();
  const data = await api.articles.list({ page: 1, limit: 100, active: true });

  return (
    <>
      <AdminTopbar title="Artigos" subtitle="Catálogo de itens do estoque" />
      <main className="flex-1 overflow-auto p-5">
        <ArticlesTable initialData={data} />
      </main>
    </>
  );
}
