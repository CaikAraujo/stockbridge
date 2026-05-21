import { ArticleForm } from '@/components/admin/articles/article-form';
import { AdminTopbar } from '@/components/admin/layout/topbar';

export default function NewArticlePage() {
  return (
    <>
      <AdminTopbar title="Novo artigo" subtitle="Cadastro de item no estoque" />
      <main className="flex-1 overflow-auto p-5">
        <div className="mx-auto max-w-2xl rounded-card border border-surface-border bg-white p-6">
          <ArticleForm mode="create" />
        </div>
      </main>
    </>
  );
}
