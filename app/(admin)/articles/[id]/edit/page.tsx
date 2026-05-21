import { notFound } from 'next/navigation';
import { ArticleForm } from '@/components/admin/articles/article-form';
import { AdminTopbar } from '@/components/admin/layout/topbar';
import { createServerClient } from '@/lib/trpc/server';

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const api = await createServerClient();
  const article = await api.articles.getById({ id }).catch(() => null);
  if (!article) notFound();

  return (
    <>
      <AdminTopbar title={`Editar — ${article.name}`} subtitle={article.sku} />
      <main className="flex-1 overflow-auto p-5">
        <div className="mx-auto max-w-2xl rounded-card border border-surface-border bg-white p-6">
          <ArticleForm mode="edit" articleId={article.id} initial={article} />
        </div>
      </main>
    </>
  );
}
