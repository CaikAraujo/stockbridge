'use client';

import { IconEdit, IconPlus, IconPrinter, IconSearch, IconTrash } from '@tabler/icons-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { generateQRLabelsPDF } from '@/lib/qr-pdf';
import { api } from '@/lib/trpc/client';

type Article = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  barcode: string | null;
  active: boolean;
  minStock: string;
  reorderPoint: string;
  refrigerantType: string | null;
  costPriceCents: number | null;
};

type ArticlesListResult = {
  items: Article[];
  total: number;
};

export function ArticlesTable({ initialData }: { initialData: ArticlesListResult }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [printing, setPrinting] = useState(false);
  const [data, setData] = useState(initialData);

  const deleteArticle = api.articles.delete.useMutation();

  const filtered = data.items.filter(
    (a) =>
      !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.sku.toLowerCase().includes(search.toLowerCase()),
  );

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length && filtered.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((a) => a.id)));
    }
  };

  const handlePrint = async () => {
    const toPrint = filtered.filter((a) => selected.has(a.id));
    if (toPrint.length === 0) return;

    setPrinting(true);
    try {
      await generateQRLabelsPDF(
        toPrint.map((a) => ({ sku: a.sku, name: a.name })),
        window.location.origin,
      );
      toast.success(`PDF gerado com ${toPrint.length} etiqueta(s)`);
    } catch {
      toast.error('Erro ao gerar PDF');
    } finally {
      setPrinting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Eliminar "${name}"?`)) return;
    try {
      await deleteArticle.mutateAsync({ id });
      setData((prev) => ({
        ...prev,
        items: prev.items.filter((a) => a.id !== id),
        total: prev.total - 1,
      }));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success('Artigo eliminado');
    } catch {
      toast.error('Erro ao eliminar artigo');
    }
  };

  const allSelected = selected.size === filtered.length && filtered.length > 0;

  return (
    <div className="space-y-4">
      {/* Barra de ações */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <IconSearch
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="text"
            placeholder="Buscar artigo ou SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-btn border border-surface-border py-2 pl-8 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-500 focus:outline-none"
          />
        </div>

        {selected.size > 0 && (
          <button
            type="button"
            onClick={handlePrint}
            disabled={printing}
            className="flex items-center gap-1.5 rounded-btn bg-brand-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
          >
            <IconPrinter size={15} />
            {printing ? 'Gerando...' : `Imprimir etiquetas (${selected.size})`}
          </button>
        )}

        <Link
          href="/articles/new"
          className="flex items-center gap-1.5 rounded-btn border border-surface-border bg-white px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface"
        >
          <IconPlus size={15} />
          Novo artigo
        </Link>
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-card border border-surface-border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface">
              <th className="w-10 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="rounded"
                />
              </th>
              {['SKU', 'Nome', 'Unidade', 'Mín.', 'Reposição', 'Tipo gás', '', ''].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-text-muted"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-surface-border">
            {filtered.map((a) => (
              <tr
                key={a.id}
                className={`transition-colors hover:bg-surface ${selected.has(a.id) ? 'bg-brand-50' : ''}`}
              >
                <td className="px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={selected.has(a.id)}
                    onChange={() => toggleSelect(a.id)}
                    className="rounded"
                  />
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-text-secondary">{a.sku}</td>
                <td className="px-4 py-2.5 font-medium text-text-primary">{a.name}</td>
                <td className="px-4 py-2.5">
                  <span className="rounded bg-surface px-1.5 py-0.5 text-xs text-text-secondary">
                    {a.unit}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-text-secondary">
                  {parseFloat(a.minStock).toFixed(3)}
                </td>
                <td className="px-4 py-2.5 text-text-secondary">
                  {parseFloat(a.reorderPoint).toFixed(3)}
                </td>
                <td className="px-4 py-2.5 text-text-secondary">{a.refrigerantType ?? '—'}</td>
                <td className="px-4 py-2.5">
                  <Link
                    href={`/articles/${a.id}/edit`}
                    className="flex items-center gap-1 rounded px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-surface"
                  >
                    <IconEdit size={13} />
                    Editar
                  </Link>
                </td>
                <td className="px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => handleDelete(a.id, a.name)}
                    disabled={deleteArticle.isPending}
                    title="Eliminar artigo"
                    className="flex items-center gap-1 rounded px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-red-50 hover:text-status-critical disabled:opacity-50"
                  >
                    <IconTrash size={13} />
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-text-muted">
                  {search
                    ? 'Nenhum artigo encontrado para esta busca.'
                    : 'Nenhum artigo cadastrado.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-text-muted">
        {filtered.length} de {initialData.total} artigos
      </p>
    </div>
  );
}
