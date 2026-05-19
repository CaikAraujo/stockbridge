'use client';

import { IconSearch } from '@tabler/icons-react';
import { useMemo, useState } from 'react';

type Item = {
  articleId: string;
  sku: string;
  barcode: string | null;
  name: string;
  unit: string;
  quantity: string;
  minStock: string;
  reorderPoint: string;
  costPriceCents: number | null;
  refrigerantType: string | null;
};

type StatusKey = 'ok' | 'low' | 'critical' | 'empty';
type FilterKey = 'all' | 'ok' | 'low' | 'critical';

function getStatus(qty: number, reorder: number, min: number): StatusKey {
  if (qty <= 0) return 'empty';
  if (qty <= reorder) return qty <= min ? 'critical' : 'low';
  return 'ok';
}

const STATUS_STYLE: Record<StatusKey, { dot: string; text: string; label: string }> = {
  ok: { dot: 'bg-status-ok', text: 'text-status-ok', label: 'Ok' },
  low: { dot: 'bg-status-low', text: 'text-status-low', label: 'Baixo' },
  critical: { dot: 'bg-status-critical', text: 'text-status-critical', label: 'Crítico' },
  empty: { dot: 'bg-gray-300', text: 'text-gray-400', label: 'Zerado' },
};

function itemStatus(i: Item): StatusKey {
  return getStatus(parseFloat(i.quantity), parseFloat(i.reorderPoint), parseFloat(i.minStock));
}

const FILTER_PILLS: [FilterKey, string][] = [
  ['all', 'Todos'],
  ['ok', 'Ok'],
  ['low', 'Baixo'],
  ['critical', 'Crítico'],
];

interface Props {
  items: Item[];
  truckId: string;
}

export function TruckInventoryTable({ items }: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  const counts = useMemo<Record<FilterKey, number>>(
    () => ({
      all: items.length,
      ok: items.filter((i) => itemStatus(i) === 'ok').length,
      low: items.filter((i) => itemStatus(i) === 'low').length,
      critical: items.filter((i) => itemStatus(i) === 'critical').length,
    }),
    [items],
  );

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const matchSearch =
          !search ||
          item.name.toLowerCase().includes(search.toLowerCase()) ||
          item.sku.toLowerCase().includes(search.toLowerCase()) ||
          (item.barcode ?? '').includes(search);

        const matchFilter = filter === 'all' || itemStatus(item) === filter;

        return matchSearch && matchFilter;
      }),
    [items, search, filter],
  );

  return (
    <div className="rounded-card border border-surface-border bg-white">
      {/* Filtros */}
      <div className="flex items-center gap-3 border-b border-surface-border px-4 py-3">
        <div className="relative flex-1">
          <IconSearch
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="text"
            placeholder="Buscar artigo, SKU ou código de barras..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-btn border border-surface-border py-2 pl-8 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-500 focus:outline-none"
          />
        </div>

        <div className="flex gap-1.5">
          {FILTER_PILLS.map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setFilter(val)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === val
                  ? 'bg-brand-500 text-white'
                  : 'bg-surface text-text-secondary hover:bg-brand-50 hover:text-brand-500'
              }`}
            >
              {label} ({counts[val]})
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface">
              {['Artigo', 'Unid.', 'Qtd. atual', 'Mínimo', 'Status'].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-left text-xs font-medium text-text-muted uppercase tracking-wide"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-surface-border">
            {filtered.map((item) => {
              const status = itemStatus(item);
              const st = STATUS_STYLE[status];
              const qty = parseFloat(item.quantity);

              return (
                <tr key={item.articleId} className="hover:bg-surface transition-colors">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-text-primary">{item.name}</p>
                    <p className="font-mono text-xs text-text-muted">{item.sku}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="rounded bg-surface px-1.5 py-0.5 text-xs font-medium text-text-secondary">
                      {item.unit}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`font-medium ${st.text}`}>{qty.toFixed(3)}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-text-muted">
                    mín. {parseFloat(item.minStock).toFixed(3)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-medium ${st.text}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                      {st.label}
                    </span>
                  </td>
                </tr>
              );
            })}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-text-muted">
                  {search
                    ? 'Nenhum item encontrado para esta busca.'
                    : 'Caminhão sem itens em estoque.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
