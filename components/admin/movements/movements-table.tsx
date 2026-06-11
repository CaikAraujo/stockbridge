'use client';

import {
  IconAdjustments,
  IconArrowDownLeft,
  IconArrowUpRight,
  IconBan,
  IconDownload,
  IconList,
  IconPlus,
} from '@tabler/icons-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import { useState } from 'react';
import { exportToCSV } from '@/lib/csv-export';
import { EmptyState } from '@/components/admin/shared/empty-state';
import { SbTable } from '@/components/admin/shared/sb-table';
import { StateBadge } from '@/components/admin/shared/state-badge';
import type { BadgeKind } from '@/components/admin/shared/state-badge';

const TYPE_CONFIG = {
  consumption: {
    label: 'Saída',
    icon: IconArrowUpRight,
    badge: 'danger'  as BadgeKind,
  },
  restock: {
    label: 'Entrada',
    icon: IconArrowDownLeft,
    badge: 'success' as BadgeKind,
  },
  transfer_out: {
    label: 'Saída (transf)',
    icon: IconArrowUpRight,
    badge: 'warn'    as BadgeKind,
  },
  transfer_in: {
    label: 'Entrada (transf)',
    icon: IconArrowDownLeft,
    badge: 'info'    as BadgeKind,
  },
  adjustment: {
    label: 'Ajuste',
    icon: IconAdjustments,
    badge: 'info'    as BadgeKind,
  },
  initial: {
    label: 'Inicial',
    icon: IconArrowDownLeft,
    badge: 'neutral' as BadgeKind,
  },
  return: {
    label: 'Devolução',
    icon: IconArrowDownLeft,
    badge: 'success' as BadgeKind,
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
type Driver   = { id: string; name: string };

type Props = {
  initialData: Movement[];
  locations: Location[];
  drivers: Driver[];
};

type MovRow = Record<string, unknown> & Movement;

export function MovementsTable({ initialData, locations }: Props) {
  const [typeFilter,     setTypeFilter]     = useState<MovementType | ''>('');
  const [locationFilter, setLocationFilter] = useState('');

  const filtered = initialData.filter((m) => {
    const matchType     = !typeFilter     || m.movementType === typeFilter;
    const matchLocation = !locationFilter || m.locationName === locationFilter;
    return matchType && matchLocation;
  });

  const handleExport = () => {
    exportToCSV(filtered, 'movimentacoes', [
      { key: (r) => format(new Date(r.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR }), label: 'Data/hora' },
      { key: (r) => TYPE_CONFIG[r.movementType].label, label: 'Tipo' },
      { key: (r) => r.articleName,    label: 'Artigo'    },
      { key: (r) => r.articleSku,     label: 'SKU'       },
      { key: (r) => r.quantityDelta,  label: 'Quantidade'},
      { key: (r) => r.articleUnit,    label: 'Unidade'   },
      { key: (r) => r.locationName,   label: 'Location'  },
      { key: (r) => r.createdByName,  label: 'Operador'  },
    ]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card">
        {/* Cabeçalho com filtros */}
        <div
          className="card-head"
          style={{ paddingBottom: 14, flexWrap: 'wrap', gap: 12 }}
        >
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="field" style={{ height: 36, width: 170 }}>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as MovementType | '')}
              >
                <option value="">Todos os tipos</option>
                {(Object.entries(TYPE_CONFIG) as [MovementType, (typeof TYPE_CONFIG)[MovementType]][]).map(
                  ([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ),
                )}
              </select>
            </div>
            <div className="field" style={{ height: 36, width: 200 }}>
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
              >
                <option value="">Todas as locations</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.name}>{l.name}</option>
                ))}
              </select>
            </div>
            {(typeFilter || locationFilter) && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => { setTypeFilter(''); setLocationFilter(''); }}
              >
                Limpar filtros
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>
              {filtered.length} movimentações
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleExport}>
              <IconDownload size={14} /> Exportar CSV
            </button>
            <Link href="/movements/new" className="btn btn-primary btn-sm" style={{ gap: 6 }}>
              <IconPlus size={14} /> Nova movimentação
            </Link>
          </div>
        </div>

        <SbTable<MovRow>
          columns={[
            { key: 'tipo',   label: 'Tipo',       width: '0.9fr'             },
            { key: 'artigo', label: 'Artigo',     width: '1.2fr', wide: true  },
            { key: 'qtd',    label: 'Quantidade', width: '0.9fr'             },
            { key: 'loc',    label: 'Location',   width: '1.1fr'             },
            { key: 'op',     label: 'Operador',   width: '0.8fr'             },
            { key: 'dt',     label: 'Data/Hora',  width: '1fr'               },
            { key: 'void',   label: '',           width: '80px', align: 'right' },
          ]}
          rows={filtered as MovRow[]}
          rowKey={(r) => r.id}
          empty={
            <EmptyState
              icon={IconList}
              title="Nenhuma movimentação encontrada"
              sub="Tente ajustar os filtros ou registre uma nova movimentação."
              action={
                <Link href="/movements/new" className="btn btn-primary btn-sm">
                  <IconPlus size={14} /> Nova movimentação
                </Link>
              }
            />
          }
          renderCell={(r, k) => {
            if (k === 'tipo') {
              const cfg = TYPE_CONFIG[r.movementType];
              const Icon = cfg.icon;
              return (
                <StateBadge kind={cfg.badge}>
                  <Icon size={12} /> {cfg.label}
                </StateBadge>
              );
            }
            if (k === 'artigo')
              return (
                <span style={{ opacity: r.voidedAt ? 0.5 : 1 }}>
                  <b>{r.articleName}</b>{' '}
                  <span className="mono" style={{ color: 'var(--faint)' }}>{r.articleSku}</span>
                </span>
              );
            if (k === 'qtd') {
              const qty = parseFloat(r.quantityDelta);
              return (
                <span
                  style={{
                    fontWeight: 800,
                    color: qty < 0 ? 'var(--danger-ink)' : 'var(--success-ink)',
                  }}
                >
                  {qty > 0 ? '+' : ''}{qty.toFixed(3)} {r.articleUnit}
                </span>
              );
            }
            if (k === 'loc')  return <span style={{ color: 'var(--ink-2)' }}>{r.locationName}</span>;
            if (k === 'op')   return <span style={{ color: 'var(--ink-2)' }}>{r.createdByName}</span>;
            if (k === 'dt')
              return (
                <span className="mono" style={{ color: 'var(--muted)' }}>
                  {format(new Date(r.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                </span>
              );
            if (k === 'void' && r.voidedAt)
              return (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--muted)' }}>
                  <IconBan size={12} /> Estornado
                </span>
              );
            return null;
          }}
        />
      </div>
    </div>
  );
}
