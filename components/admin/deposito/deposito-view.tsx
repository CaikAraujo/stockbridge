'use client';

import { IconSearch } from '@tabler/icons-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CsvImportDialog } from './csv-import-dialog';

type StockItem = {
  articleId: string;
  quantity: string;
  articleName: string;
  articleSku: string;
  articleUnit: string;
  minStock: string;
  reorderPoint: string;
};

type Movement = {
  id: string;
  movementType: string;
  quantityDelta: string;
  createdAt: Date;
  voidedAt: Date | null;
  articleName: string;
  articleUnit: string;
  userName: string;
};

type Warehouse = { id: string; name: string };

function stockStatus(item: StockItem): 'ok' | 'low' | 'critical' {
  const qty = parseFloat(item.quantity);
  if (qty <= parseFloat(item.minStock)) return 'critical';
  if (qty <= parseFloat(item.reorderPoint)) return 'low';
  return 'ok';
}

const STATUS_CLASSES = {
  ok: 'bg-green-50 text-green-700',
  low: 'bg-amber-50 text-amber-700',
  critical: 'bg-red-50 text-red-700',
} as const;

const STATUS_LABEL = {
  ok: 'OK',
  low: 'Stock baixo',
  critical: 'Crítico',
} as const;

const MOVEMENT_META: Record<string, { label: string; className: string }> = {
  restock: { label: 'Entrada', className: 'bg-green-50 text-green-700' },
  transfer_out: { label: 'Retirada', className: 'bg-red-50 text-red-700' },
  transfer_in: { label: 'Devolução', className: 'bg-blue-50 text-blue-700' },
  return: { label: 'Devolução', className: 'bg-blue-50 text-blue-700' },
  adjustment: { label: 'Ajuste', className: 'bg-surface text-text-secondary' },
};

export function DepositoView({
  warehouse,
  items,
  movements,
}: {
  warehouse: Warehouse | null;
  items: StockItem[];
  movements: Movement[];
}) {
  const [search, setSearch] = useState('');
  const router = useRouter();

  if (!warehouse) {
    return (
      <div className="flex items-center justify-center py-16 text-text-muted">
        <p className="text-sm">Nenhum depósito configurado.</p>
      </div>
    );
  }

  const filtered = items.filter(
    (i) =>
      !search ||
      i.articleName.toLowerCase().includes(search.toLowerCase()) ||
      i.articleSku.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Secção 1 — Stock actual */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-text-primary">
            Stock actual
            <span className="ml-2 text-xs font-normal text-text-muted">
              ({items.length} artigos)
            </span>
          </h2>
          <div className="flex items-center gap-2">
            {warehouse && (
              <CsvImportDialog
                warehouseId={warehouse.id}
                onSuccess={() => router.refresh()}
              />
            )}
            <div className="relative">
              <IconSearch
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                type="text"
                placeholder="Buscar artigo ou SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-btn border border-surface-border py-1.5 pl-7 pr-3 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-card border border-surface-border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border bg-surface">
                {['Artigo', 'SKU', 'Unidade', 'Quantidade', 'Estado'].map((h) => (
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
              {filtered.map((item) => {
                const status = stockStatus(item);
                return (
                  <tr key={item.articleId} className="hover:bg-surface transition-colors">
                    <td className="px-4 py-2.5 font-medium text-text-primary">
                      {item.articleName}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-text-secondary">
                      {item.articleSku}
                    </td>
                    <td className="px-4 py-2.5 text-text-secondary">{item.articleUnit}</td>
                    <td className="px-4 py-2.5 font-medium text-text-primary">
                      {parseFloat(item.quantity).toFixed(3)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[status]}`}
                      >
                        {STATUS_LABEL[status]}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-text-muted">
                    {search ? 'Nenhum artigo encontrado.' : 'Sem artigos em stock.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Secção 2 — Histórico recente */}
      <div>
        <h2 className="mb-3 text-sm font-medium text-text-primary">
          Histórico recente
          <span className="ml-2 text-xs font-normal text-text-muted">(últimos 50)</span>
        </h2>

        <div className="overflow-hidden rounded-card border border-surface-border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border bg-surface">
                {['Data/hora', 'Artigo', 'Quantidade', 'Tipo', 'Operador'].map((h) => (
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
              {movements.map((m) => {
                const meta = MOVEMENT_META[m.movementType] ?? {
                  label: m.movementType,
                  className: 'bg-surface text-text-muted',
                };
                const voided = m.voidedAt !== null;
                const delta = parseFloat(m.quantityDelta);

                return (
                  <tr
                    key={m.id}
                    className={`transition-colors hover:bg-surface ${voided ? 'opacity-50' : ''}`}
                  >
                    <td
                      className={`px-4 py-2.5 text-xs text-text-secondary ${voided ? 'line-through' : ''}`}
                    >
                      {format(new Date(m.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                    </td>
                    <td className={`px-4 py-2.5 text-text-primary ${voided ? 'line-through' : ''}`}>
                      {m.articleName}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-text-primary">
                      {delta > 0 ? '+' : ''}
                      {delta.toFixed(3)} {m.articleUnit}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}
                      >
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-text-secondary">{m.userName}</td>
                  </tr>
                );
              })}
              {movements.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-text-muted">
                    Sem movimentos recentes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
