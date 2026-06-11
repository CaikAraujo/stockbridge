'use client';

import { IconEdit, IconPackage, IconPlus, IconPrinter, IconSearch, IconTrash } from '@tabler/icons-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { generateQRLabelsPDF } from '@/lib/qr-pdf';
import { api } from '@/lib/trpc/client';
import { EmptyState } from '@/components/admin/shared/empty-state';
import { SbTable } from '@/components/admin/shared/sb-table';
import { StateBadge } from '@/components/admin/shared/state-badge';

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

type ArtRow = Record<string, unknown> & Article;

export function ArticlesTable({ initialData }: { initialData: ArticlesListResult }) {
  const [search,   setSearch]   = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [printing, setPrinting] = useState(false);
  const [data,     setData]     = useState(initialData);

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
    <div className="card">
      {/* Barra de ações */}
      <div
        className="card-head"
        style={{ paddingBottom: 14, flexWrap: 'wrap', gap: 12 }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="field" style={{ height: 36, width: 'min(320px, 100%)' }}>
            <IconSearch size={15} />
            <input
              type="text"
              placeholder="Buscar artigo ou SKU…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={handlePrint}
              disabled={printing}
              className="btn btn-soft btn-sm"
            >
              <IconPrinter size={14} />
              {printing ? 'Gerando…' : `Imprimir etiquetas (${selected.size})`}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>
            {filtered.length} de {data.total} artigos
          </span>
          <Link href="/articles/new" className="btn btn-primary btn-sm" style={{ gap: 6 }}>
            <IconPlus size={14} /> Novo artigo
          </Link>
        </div>
      </div>

      {/* Checkbox header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px var(--card-pad) 0',
          borderBottom: '1px solid var(--border-soft)',
        }}
      >
        <input
          type="checkbox"
          checked={allSelected}
          onChange={toggleAll}
          style={{ flexShrink: 0 }}
        />
        <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--faint)' }}>
          {selected.size > 0 ? `${selected.size} selecionados` : 'Selecionar todos'}
        </span>
      </div>

      <SbTable<ArtRow>
        columns={[
          { key: 'sel',  label: '',          width: '36px'                 },
          { key: 'sku',  label: 'SKU',        width: '0.9fr'               },
          { key: 'nome', label: 'Nome',       width: '1.2fr', wide: true   },
          { key: 'un',   label: 'Unidade',    width: '0.7fr'               },
          { key: 'min',  label: 'Mín.',       width: '0.7fr'               },
          { key: 'rep',  label: 'Reposição',  width: '0.8fr'               },
          { key: 'gas',  label: 'Tipo gás',   width: '0.7fr'               },
          { key: 'acoes',label: '',           width: '110px', align: 'right', wide: true },
        ]}
        rows={filtered as ArtRow[]}
        rowKey={(r) => r.id}
        empty={
          <EmptyState
            icon={IconPackage}
            title={search ? 'Nenhum artigo encontrado' : 'Nenhum artigo cadastrado'}
            sub={search ? 'Tente outro termo de busca.' : 'Crie o primeiro artigo do catálogo.'}
            action={
              !search ? (
                <Link href="/articles/new" className="btn btn-primary btn-sm">
                  <IconPlus size={14} /> Novo artigo
                </Link>
              ) : undefined
            }
          />
        }
        renderCell={(r, k) => {
          if (k === 'sel')
            return (
              <input
                type="checkbox"
                checked={selected.has(r.id)}
                onChange={() => toggleSelect(r.id)}
              />
            );
          if (k === 'sku')
            return <span className="mono" style={{ color: 'var(--primary)' }}>{r.sku}</span>;
          if (k === 'nome')
            return <span style={{ fontWeight: 700 }}>{r.name}</span>;
          if (k === 'un')
            return <StateBadge kind="info">{r.unit}</StateBadge>;
          if (k === 'min')
            return <span style={{ color: 'var(--ink-2)' }}>{parseFloat(r.minStock).toFixed(3)}</span>;
          if (k === 'rep')
            return <span style={{ color: 'var(--ink-2)' }}>{parseFloat(r.reorderPoint).toFixed(3)}</span>;
          if (k === 'gas')
            return <span style={{ color: 'var(--ink-2)' }}>{r.refrigerantType ?? '—'}</span>;
          if (k === 'acoes')
            return (
              <span style={{ display: 'inline-flex', gap: 4 }}>
                <Link
                  href={`/articles/${r.id}/edit`}
                  className="btn btn-icon btn-ghost btn-sm"
                  title="Editar"
                >
                  <IconEdit size={14} />
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(r.id, r.name)}
                  disabled={deleteArticle.isPending}
                  className="btn btn-icon btn-danger-ghost btn-sm"
                  title="Eliminar artigo"
                >
                  <IconTrash size={14} />
                </button>
              </span>
            );
          return null;
        }}
      />
    </div>
  );
}
