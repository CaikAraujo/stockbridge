'use client';

import { IconPackage, IconSearch, IconTruck } from '@tabler/icons-react';
import { useState } from 'react';
import { api } from '@/lib/trpc/client';

export function WarehouseAvailability() {
  const { data, isLoading } = api.drivers.warehouseAvailability.useQuery();
  const [search, setSearch] = useState('');

  const filtered = (data ?? []).filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.sku.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex-1 overflow-auto px-4 pt-4 pb-6">
      {/* Campo de busca */}
      <div className="relative mb-4">
        <IconSearch
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar artigo ou SKU…"
          className="w-full rounded-btn border border-surface-border bg-white py-3 pl-9 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-500 focus:outline-none"
        />
      </div>

      {/* Skeleton de carregamento */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="animate-pulse rounded-card border border-surface-border bg-white p-4"
            >
              <div className="mb-2 h-4 w-2/3 rounded bg-surface-border" />
              <div className="mb-3 h-3 w-1/3 rounded bg-surface-border" />
              <div className="h-8 w-1/2 rounded bg-surface-border" />
            </div>
          ))}
        </div>
      )}

      {/* Estado vazio */}
      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center py-12 text-text-muted">
          <IconPackage size={40} className="mb-3 opacity-30" />
          <p className="text-sm">
            {search
              ? 'Nenhum artigo encontrado para esta busca'
              : 'Nenhum artigo disponível no depósito'}
          </p>
        </div>
      )}

      {/* Lista de artigos */}
      {!isLoading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((item) => (
            <ArticleCard key={item.articleId} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

type ArticleItem = {
  articleId: string;
  name: string;
  sku: string;
  unit: string;
  warehouseQty: number;
  driversWithItem: Array<{
    driverName: string;
    truckName: string;
    quantity: number;
  }>;
};

function ArticleCard({ item }: { item: ArticleItem }) {
  const [expanded, setExpanded] = useState(false);
  const hasTrucks = item.driversWithItem.length > 0;

  return (
    <div className="rounded-card border border-surface-border bg-white">
      <div className="px-4 py-4">
        {/* Nome + SKU */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text-primary">{item.name}</p>
            <p className="mt-0.5 font-mono text-xs text-text-muted">{item.sku}</p>
          </div>
        </div>

        {/* Quantidade no depósito */}
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold text-status-ok">
            {item.warehouseQty.toFixed(3)}
          </span>
          <span className="text-sm font-medium text-status-ok">{item.unit}</span>
          <span className="ml-1 text-xs text-text-muted">no depósito</span>
        </div>
      </div>

      {/* Seção "Também em caminhões" */}
      {hasTrucks && (
        <div className="border-t border-surface-border">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="flex w-full items-center justify-between px-4 py-2.5 text-left"
          >
            <div className="flex items-center gap-1.5">
              <IconTruck size={13} className="text-text-muted" />
              <span className="text-xs text-text-muted">
                Também em caminhões ({item.driversWithItem.length})
              </span>
            </div>
            <span className="text-xs text-text-muted">{expanded ? '▲' : '▼'}</span>
          </button>

          {expanded && (
            <div className="divide-y divide-surface-border border-t border-surface-border">
              {item.driversWithItem.map((driver, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-4 py-2.5"
                >
                  <div>
                    <p className="text-xs font-medium text-text-secondary">{driver.driverName}</p>
                    <p className="text-xs text-text-muted">{driver.truckName}</p>
                  </div>
                  <span className="text-xs font-medium text-text-secondary">
                    {driver.quantity.toFixed(3)} {item.unit}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
