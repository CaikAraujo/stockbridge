'use client';

import { IconBuildingWarehouse, IconEdit, IconPackage, IconPlus, IconPrinter, IconSearch, IconTrash, IconTruck } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { generateQRLabelsPDF } from '@/lib/qr-pdf';
import { api } from '@/lib/trpc/client';
import { CsvImportArticlesDialog } from '@/components/admin/articles/csv-import-articles-dialog';
import { EmptyState } from '@/components/admin/shared/empty-state';
import { SbTable } from '@/components/admin/shared/sb-table';
import { StateBadge } from '@/components/admin/shared/state-badge';
import { BulkAssignSupplierModal } from './bulk-assign-supplier-modal';

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

type ArticlesListResult = { items: Article[]; total: number };
type PrintItem = { id: string; sku: string; name: string };
type ArtRow = Record<string, unknown> & Article;

const PAGE_SIZE = 100;

export function ArticlesTable({ initialData }: { initialData: ArticlesListResult }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [printing, setPrinting] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);
  const [allPrintItems, setAllPrintItems] = useState<PrintItem[] | null>(null);
  const [bulkSupplierOpen, setBulkSupplierOpen] = useState(false);
  const [displayData, setDisplayData] = useState<ArticlesListResult>(initialData);
  const checkboxRef = useRef<HTMLInputElement>(null);

  const trimmedSearch = search.trim() || undefined;

  const { data: queryData } = api.articles.list.useQuery({
    page,
    limit: PAGE_SIZE,
    search: trimmedSearch,
    active: true,
  });

  const listAllIds = api.articles.listAllIds.useQuery(
    { search: trimmedSearch, active: true },
    { enabled: false },
  );

  const listWarehouseIds = api.articles.listWarehouseIds.useQuery(undefined, { enabled: false });
  const [selectingWarehouse, setSelectingWarehouse] = useState(false);

  const deleteArticle = api.articles.delete.useMutation();

  useEffect(() => {
    if (queryData) setDisplayData(queryData);
  }, [queryData]);

  useEffect(() => {
    setPage(1);
    setSelected(new Set());
    setAllPrintItems(null);
  }, [search]);

  useEffect(() => {
    setSelected(new Set());
    setAllPrintItems(null);
  }, [page]);

  useEffect(() => {
    const el = checkboxRef.current;
    if (!el) return;
    const allTotal = displayData.total > 0 && selected.size === displayData.total;
    const someOnPage = displayData.items.some((a) => selected.has(a.id));
    el.checked = allTotal;
    el.indeterminate = !allTotal && someOnPage;
  }, [selected, displayData]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = async () => {
    if (selected.size === displayData.total && displayData.total > 0) {
      setSelected(new Set());
      setAllPrintItems(null);
      return;
    }
    setSelectingAll(true);
    try {
      const result = await listAllIds.refetch();
      if (result.data) {
        setSelected(new Set(result.data.ids));
        setAllPrintItems(result.data.items);
      }
    } finally {
      setSelectingAll(false);
    }
  };

  const handlePrint = async () => {
    if (selected.size === 0) return;
    setPrinting(true);
    try {
      const allSelected = selected.size === displayData.total;
      const source =
        allSelected && allPrintItems
          ? allPrintItems.filter((a) => selected.has(a.id))
          : displayData.items.filter((a) => selected.has(a.id));
      await generateQRLabelsPDF(
        source.map((a) => ({ sku: a.sku, name: a.name })),
        window.location.origin,
      );
      toast.success(`PDF gerado com ${source.length} etiqueta(s)`);
    } catch {
      toast.error('Erro ao gerar PDF');
    } finally {
      setPrinting(false);
    }
  };

  const handleSelectWarehouse = async () => {
    setSelectingWarehouse(true);
    try {
      const result = await listWarehouseIds.refetch();
      if (result.data) {
        setSelected(new Set(result.data.ids));
        setAllPrintItems(result.data.items);
      }
    } finally {
      setSelectingWarehouse(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Eliminar "${name}"?`)) return;
    try {
      await deleteArticle.mutateAsync({ id });
      setDisplayData((prev) => ({
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

  const totalPages = Math.ceil(displayData.total / PAGE_SIZE);

  return (
    <div className="card">
      <div className="card-head" style={{ paddingBottom: 14, flexWrap: 'wrap', gap: 12 }}>
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
          <button
            type="button"
            onClick={handleSelectWarehouse}
            disabled={selectingWarehouse}
            className="btn btn-soft btn-sm"
          >
            <IconBuildingWarehouse size={14} />
            {selectingWarehouse ? 'A carregar…' : 'Stock no Depósito'}
          </button>
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
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => setBulkSupplierOpen(true)}
              className="btn btn-soft btn-sm"
            >
              <IconTruck size={14} />
              Associer fournisseur ({selected.size})
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>
            {displayData.items.length} de {displayData.total} artigos
          </span>
          <CsvImportArticlesDialog onSuccess={() => router.refresh()} />
          <Link href="/articles/new" className="btn btn-primary btn-sm" style={{ gap: 6 }}>
            <IconPlus size={14} /> Novo artigo
          </Link>
        </div>
      </div>

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
          ref={checkboxRef}
          type="checkbox"
          disabled={selectingAll}
          onChange={toggleAll}
          style={{ flexShrink: 0 }}
        />
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: 'var(--faint)',
          }}
        >
          {selectingAll
            ? 'A carregar…'
            : selected.size > 0
              ? `${selected.size} selecionados`
              : 'Selecionar todos'}
        </span>
      </div>

      <SbTable<ArtRow>
        columns={[
          { key: 'sel',   label: '',          width: '36px'                       },
          { key: 'sku',   label: 'SKU',        width: '0.9fr'                     },
          { key: 'nome',  label: 'Nome',       width: '1.2fr', wide: true         },
          { key: 'un',    label: 'Unidade',    width: '0.7fr'                     },
          { key: 'min',   label: 'Mín.',       width: '0.7fr'                     },
          { key: 'rep',   label: 'Reposição',  width: '0.8fr'                     },
          { key: 'gas',   label: 'Tipo gás',   width: '0.7fr'                     },
          { key: 'acoes', label: '',           width: '110px', align: 'right', wide: true },
        ]}
        rows={displayData.items as ArtRow[]}
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

      {bulkSupplierOpen && (
        <BulkAssignSupplierModal
          selectedIds={[...selected]}
          onClose={() => setBulkSupplierOpen(false)}
          onSuccess={() => {
            setBulkSupplierOpen(false);
            setSelected(new Set());
            router.refresh();
          }}
        />
      )}

      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: '12px var(--card-pad)',
            borderTop: '1px solid var(--border-soft)',
          }}
        >
          <button
            type="button"
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 1}
            className="btn btn-ghost btn-sm"
          >
            ← Anterior
          </button>
          <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
            Página {page} de {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages}
            className="btn btn-ghost btn-sm"
          >
            Próxima →
          </button>
        </div>
      )}
    </div>
  );
}
