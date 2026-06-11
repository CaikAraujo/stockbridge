'use client';

import { IconSearch, IconPackage, IconPlus } from '@tabler/icons-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EmptyState } from '@/components/admin/shared/empty-state';
import { SbTable } from '@/components/admin/shared/sb-table';
import { StateBadge } from '@/components/admin/shared/state-badge';
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

const MOVEMENT_META: Record<string, { label: string; kind: 'success' | 'danger' | 'info' | 'neutral' }> = {
  restock:     { label: 'Entrada',   kind: 'success' },
  transfer_out:{ label: 'Retirada',  kind: 'danger'  },
  transfer_in: { label: 'Devolução', kind: 'info'    },
  return:      { label: 'Devolução', kind: 'info'    },
  adjustment:  { label: 'Ajuste',    kind: 'neutral' },
  consumption: { label: 'Consumo',   kind: 'danger'  },
  initial:     { label: 'Inicial',   kind: 'neutral' },
};

type StockItemRecord = Record<string, unknown> & StockItem;
type MovementRecord = Record<string, unknown> & Movement;

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
      <div className="card">
        <EmptyState
          icon={IconPackage}
          title="Nenhum depósito configurado"
          sub="Configure um depósito para começar a gerir o estoque."
        />
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Stock actual */}
      <div className="card">
        <div
          className="card-head"
          style={{ paddingBottom: 14, flexWrap: 'wrap', gap: 12 }}
        >
          <div>
            <div className="card-title">
              Stock actual{' '}
              <span style={{ color: 'var(--faint)', fontWeight: 600, fontSize: 12.5 }}>
                ({items.length} artigos)
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {warehouse && (
              <CsvImportDialog warehouseId={warehouse.id} onSuccess={() => router.refresh()} />
            )}
            <div className="field" style={{ height: 36, width: 'min(260px, 100%)' }}>
              <IconSearch size={15} />
              <input
                type="text"
                placeholder="Buscar artigo ou SKU…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Link
              href="/movements/new"
              className="btn btn-primary btn-sm"
              style={{ gap: 6 }}
            >
              <IconPlus size={14} /> Nova entrada
            </Link>
          </div>
        </div>

        <SbTable<StockItemRecord>
          columns={[
            { key: 'artigo',   label: 'Artigo',    width: '1.4fr', wide: true },
            { key: 'sku',      label: 'SKU',        width: '1fr'              },
            { key: 'unidade',  label: 'Unidade',    width: '0.7fr'            },
            { key: 'qtd',      label: 'Quantidade', width: '0.9fr'            },
            { key: 'estado',   label: 'Estado',     width: '0.9fr'            },
          ]}
          rows={filtered as StockItemRecord[]}
          rowKey={(r) => r.articleId}
          empty={
            <EmptyState
              icon={IconPackage}
              title={search ? 'Nenhum artigo encontrado' : 'Sem artigos em stock'}
              sub={search ? 'Tente outro termo de busca.' : 'Importe um CSV ou crie uma entrada manual.'}
            />
          }
          renderCell={(r, k) => {
            if (k === 'artigo') return <span style={{ fontWeight: 700 }}>{r.articleName}</span>;
            if (k === 'sku') return <span className="mono" style={{ color: 'var(--primary)' }}>{r.articleSku}</span>;
            if (k === 'unidade') return <StateBadge kind="neutral">{r.articleUnit}</StateBadge>;
            if (k === 'qtd') return <span style={{ fontWeight: 700 }}>{parseFloat(r.quantity).toFixed(3)}</span>;
            if (k === 'estado') {
              const st = stockStatus(r);
              if (st === 'critical') return <StateBadge kind="danger" dot>Crítico</StateBadge>;
              if (st === 'low')      return <StateBadge kind="warn"   dot>Stock baixo</StateBadge>;
              return                        <StateBadge kind="success" dot>OK</StateBadge>;
            }
            return null;
          }}
        />
      </div>

      {/* Histórico recente */}
      <div className="card">
        <div className="card-head" style={{ paddingBottom: 14 }}>
          <div className="card-title">
            Histórico recente{' '}
            <span style={{ color: 'var(--faint)', fontWeight: 600, fontSize: 12.5 }}>
              (últimos 50)
            </span>
          </div>
        </div>

        <SbTable<MovementRecord>
          columns={[
            { key: 'dt',     label: 'Data/Hora',  width: '1.1fr'            },
            { key: 'artigo', label: 'Artigo',     width: '1.2fr', wide: true },
            { key: 'qtd',    label: 'Quantidade', width: '0.9fr'            },
            { key: 'tipo',   label: 'Tipo',       width: '0.8fr'            },
            { key: 'op',     label: 'Operador',   width: '0.8fr'            },
          ]}
          rows={movements as MovementRecord[]}
          rowKey={(r) => r.id}
          empty={
            <EmptyState
              icon={IconPackage}
              title="Sem movimentos recentes"
              sub="As movimentações do depósito aparecerão aqui."
            />
          }
          renderCell={(r, k) => {
            if (k === 'dt')
              return (
                <span className="mono" style={{ color: 'var(--muted)' }}>
                  {format(new Date(r.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                </span>
              );
            if (k === 'artigo')
              return (
                <span
                  style={{
                    fontWeight: 700,
                    opacity: r.voidedAt ? 0.45 : 1,
                    textDecoration: r.voidedAt ? 'line-through' : 'none',
                  }}
                >
                  {r.articleName}
                </span>
              );
            if (k === 'qtd') {
              const delta = parseFloat(r.quantityDelta);
              return (
                <span
                  style={{
                    fontWeight: 800,
                    color: delta > 0 ? 'var(--success-ink)' : 'var(--danger-ink)',
                  }}
                >
                  {delta > 0 ? '+' : ''}
                  {delta.toFixed(3)} {r.articleUnit}
                </span>
              );
            }
            if (k === 'tipo') {
              const meta = MOVEMENT_META[r.movementType] ?? { label: r.movementType, kind: 'neutral' as const };
              return <StateBadge kind={meta.kind}>{meta.label}</StateBadge>;
            }
            if (k === 'op') return <span style={{ color: 'var(--ink-2)' }}>{r.userName}</span>;
            return null;
          }}
        />
      </div>
    </div>
  );
}
