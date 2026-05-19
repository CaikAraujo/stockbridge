'use client';

import { IconAdjustments, IconArrowDownLeft, IconArrowUpRight, IconBan } from '@tabler/icons-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';

const TYPE_CONFIG = {
  consumption: {
    label: 'Consumo',
    icon: IconArrowUpRight,
    color: 'text-status-critical',
    bg: 'bg-red-50',
  },
  restock: {
    label: 'Entrada',
    icon: IconArrowDownLeft,
    color: 'text-status-ok',
    bg: 'bg-green-50',
  },
  transfer_out: {
    label: 'Saída (transf)',
    icon: IconArrowUpRight,
    color: 'text-status-low',
    bg: 'bg-amber-50',
  },
  transfer_in: {
    label: 'Entrada (transf)',
    icon: IconArrowDownLeft,
    color: 'text-brand-500',
    bg: 'bg-blue-50',
  },
  adjustment: {
    label: 'Ajuste',
    icon: IconAdjustments,
    color: 'text-text-secondary',
    bg: 'bg-gray-50',
  },
  initial: {
    label: 'Inicial',
    icon: IconArrowDownLeft,
    color: 'text-text-muted',
    bg: 'bg-gray-50',
  },
  return: {
    label: 'Devolução',
    icon: IconArrowDownLeft,
    color: 'text-status-ok',
    bg: 'bg-green-50',
  },
} as const;

type MovementType = keyof typeof TYPE_CONFIG;

type Movement = {
  id: string;
  movementType: MovementType;
  quantityDelta: string;
  createdAt: Date;
  voidedAt: Date | null;
  unitCostCents: number | null;
  reason: string | null;
  notes: string | null;
  articleName: string;
  articleSku: string;
  articleUnit: string;
  locationName: string;
  locationCode: string;
  createdByName: string;
};

type Location = { id: string; name: string };
type Driver = { id: string; name: string };

type Props = {
  initialData: Movement[];
  locations: Location[];
  drivers: Driver[];
};

const HEADERS = ['Tipo', 'Artigo', 'Quantidade', 'Location', 'Operador', 'Data/hora', ''] as const;

export function MovementsTable({ initialData, locations }: Props) {
  const [typeFilter, setTypeFilter] = useState<MovementType | ''>('');
  const [locationFilter, setLocationFilter] = useState('');

  const filtered = initialData.filter((m) => {
    const matchType = !typeFilter || m.movementType === typeFilter;
    const matchLocation = !locationFilter || m.locationName === locationFilter;
    return matchType && matchLocation;
  });

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as MovementType | '')}
          className="rounded-btn border border-surface-border bg-white px-3 py-2 text-sm text-text-primary focus:border-brand-500 focus:outline-none"
        >
          <option value="">Todos os tipos</option>
          {(
            Object.entries(TYPE_CONFIG) as [MovementType, (typeof TYPE_CONFIG)[MovementType]][]
          ).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>

        <select
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          className="rounded-btn border border-surface-border bg-white px-3 py-2 text-sm text-text-primary focus:border-brand-500 focus:outline-none"
        >
          <option value="">Todas as locations</option>
          {locations.map((l) => (
            <option key={l.id} value={l.name}>
              {l.name}
            </option>
          ))}
        </select>

        {(typeFilter || locationFilter) && (
          <button
            type="button"
            onClick={() => {
              setTypeFilter('');
              setLocationFilter('');
            }}
            className="text-xs text-text-muted hover:text-text-secondary"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-card border border-surface-border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border bg-surface">
                {HEADERS.map((h) => (
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
              {filtered.map((m) => {
                const cfg = TYPE_CONFIG[m.movementType];
                const Icon = cfg.icon;
                const qty = parseFloat(m.quantityDelta);

                return (
                  <tr
                    key={m.id}
                    className={`transition-colors hover:bg-surface ${m.voidedAt ? 'opacity-50' : ''}`}
                  >
                    <td className="px-4 py-2.5">
                      <div
                        className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium ${cfg.bg} ${cfg.color}`}
                      >
                        <Icon size={12} />
                        {cfg.label}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-text-primary">{m.articleName}</p>
                      <p className="font-mono text-xs text-text-muted">{m.articleSku}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`font-medium ${qty < 0 ? 'text-status-critical' : 'text-status-ok'}`}
                      >
                        {qty > 0 ? '+' : ''}
                        {qty.toFixed(3)} {m.articleUnit}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-text-secondary">{m.locationName}</td>
                    <td className="px-4 py-2.5 text-text-secondary">{m.createdByName}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-text-secondary">
                      {format(new Date(m.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                    </td>
                    <td className="px-4 py-2.5">
                      {m.voidedAt && (
                        <span className="inline-flex items-center gap-1 text-xs text-text-muted">
                          <IconBan size={12} /> Estornado
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-text-muted">
                    Nenhuma movimentação encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-text-muted">{filtered.length} movimentações exibidas</p>
    </div>
  );
}
