'use client';

import { IconArrowBack, IconBan, IconCircleCheck, IconTruck } from '@tabler/icons-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';

const LIFECYCLE_CONFIG = {
  in_truck: {
    label: 'No caminhão',
    icon: IconTruck,
    color: 'text-brand-500',
    bg: 'bg-blue-50',
  },
  returned: {
    label: 'Devolvido',
    icon: IconArrowBack,
    color: 'text-status-ok',
    bg: 'bg-green-50',
  },
  consumed: {
    label: 'Consumido',
    icon: IconCircleCheck,
    color: 'text-text-secondary',
    bg: 'bg-gray-50',
  },
  voided: {
    label: 'Estornado',
    icon: IconBan,
    color: 'text-text-muted',
    bg: 'bg-gray-50',
  },
} as const;

type LifecycleKey = keyof typeof LIFECYCLE_CONFIG;

type Operation = {
  transferId: string | null;
  transferCode: string | null;
  articleName: string;
  articleSku: string;
  articleUnit: string;
  qty: number;
  movementType: string;
  lifecycle: LifecycleKey;
  createdAt: Date;
  createdByName: string;
  voidedAt: Date | null;
};

type Driver = { id: string; name: string; email: string | null; phone: string | null };
type Truck = { id: string; name: string; code: string };

type History = {
  driver: Driver | null | undefined;
  truck: Truck | null | undefined;
  operations: Operation[];
};

type StatusFilter = LifecycleKey | '';

const PILL_OPTIONS: [LifecycleKey, string, string][] = [
  ['in_truck', 'No caminhão', 'bg-blue-50 text-brand-500'],
  ['returned', 'Devolvido', 'bg-green-50 text-status-ok'],
  ['consumed', 'Consumido', 'bg-gray-50 text-text-secondary'],
  ['voided', 'Estornado', 'bg-gray-50 text-text-muted'],
];

export function DriverHistory({ history }: { history: History }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');

  const filtered = history.operations.filter((op) => {
    const date = new Date(op.createdAt);
    const matchFrom = !from || date >= new Date(from);
    const matchTo = !to || date <= new Date(`${to}T23:59:59`);
    const matchStatus = !statusFilter || op.lifecycle === statusFilter;
    return matchFrom && matchTo && matchStatus;
  });

  const counts = {
    in_truck: history.operations.filter((o) => o.lifecycle === 'in_truck').length,
    returned: history.operations.filter((o) => o.lifecycle === 'returned').length,
    consumed: history.operations.filter((o) => o.lifecycle === 'consumed').length,
    voided: history.operations.filter((o) => o.lifecycle === 'voided').length,
  };

  const hasFilters = from || to || statusFilter;

  return (
    <div className="space-y-4">
      {/* Pills de status */}
      <div className="flex flex-wrap gap-2">
        {PILL_OPTIONS.map(([val, label, activeCls]) => (
          <button
            key={val}
            type="button"
            onClick={() => setStatusFilter(statusFilter === val ? '' : val)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === val
                ? `${activeCls} ring-1 ring-current`
                : 'bg-surface text-text-secondary hover:bg-brand-50'
            }`}
          >
            {label} ({counts[val]})
          </button>
        ))}
      </div>

      {/* Filtros de data */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="dh-from" className="text-xs text-text-secondary">
            De
          </label>
          <input
            id="dh-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-btn border border-surface-border px-2 py-1.5 text-xs text-text-primary focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="dh-to" className="text-xs text-text-secondary">
            Até
          </label>
          <input
            id="dh-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-btn border border-surface-border px-2 py-1.5 text-xs text-text-primary focus:border-brand-500 focus:outline-none"
          />
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setFrom('');
              setTo('');
              setStatusFilter('');
            }}
            className="text-xs text-text-muted hover:text-text-secondary"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Lista de operações */}
      <div className="divide-y divide-surface-border rounded-card border border-surface-border bg-white">
        {filtered.map((op) => {
          const cfg = LIFECYCLE_CONFIG[op.lifecycle];
          const Icon = cfg.icon;
          const key = `${op.transferId ?? op.articleSku}-${op.movementType}-${String(op.createdAt)}`;

          return (
            <div key={key} className="flex items-center gap-3 px-4 py-3">
              <div
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${cfg.bg}`}
              >
                <Icon size={16} className={cfg.color} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">
                  {op.articleName}
                  <span className="ml-2 font-mono text-xs text-text-muted">{op.articleSku}</span>
                </p>
                <p className="text-xs text-text-secondary">
                  {op.qty.toFixed(3)} {op.articleUnit} ·{' '}
                  {format(new Date(op.createdAt), 'dd/MM HH:mm', { locale: ptBR })} ·{' '}
                  {op.createdByName}
                  {op.transferCode ? ` · ${op.transferCode}` : ''}
                </p>
              </div>

              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.bg} ${cfg.color}`}
              >
                <Icon size={11} />
                {cfg.label}
              </span>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-text-muted">
            Nenhuma operação encontrada para os filtros selecionados.
          </p>
        )}
      </div>

      <p className="text-xs text-text-muted">
        {filtered.length} de {history.operations.length} operações
      </p>
    </div>
  );
}
