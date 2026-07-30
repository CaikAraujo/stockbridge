'use client';

import { useState } from 'react';
import { IconChevronRight, IconPackage } from '@tabler/icons-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { api } from '@/lib/trpc/client';
import { PurchaseOrderDetail } from './purchase-order-detail';

type PurchaseOrderStatus = 'ready_to_send' | 'sent' | 'confirmed' | 'received' | 'cancelled';

type PurchaseOrderRow = {
  id: string;
  reference: string;
  status: PurchaseOrderStatus;
  supplierId: string;
  supplierName: string | null;
  supplierEmail: string | null;
  createdAt: Date;
  sentAt: Date | null;
  itemCount: number;
};

type InitialData = {
  items: PurchaseOrderRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

interface Props {
  initialData: InitialData;
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  ready_to_send: { label: "En attente d'envoi", color: '#b45309', bg: 'color-mix(in oklch, orange 12%, transparent)' },
  sent: { label: 'Envoyée', color: 'var(--primary)', bg: 'color-mix(in oklch, var(--primary) 12%, transparent)' },
  confirmed: { label: 'Confirmée', color: 'var(--success-ink, #16a34a)', bg: 'color-mix(in oklch, var(--success) 12%, transparent)' },
  received: { label: 'Reçue', color: 'var(--ink-2)', bg: 'var(--surface-2, var(--bg-2))' },
  cancelled: { label: 'Annulée', color: 'var(--danger)', bg: 'color-mix(in oklch, var(--danger) 10%, transparent)' },
};

export function PurchaseOrdersList({ initialData }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, refetch } = api.purchaseOrders.list.useQuery(
    { page: 1, limit: 100, status: (statusFilter as 'ready_to_send' | 'sent' | 'confirmed' | 'received' | 'cancelled') || undefined },
    { initialData },
  );

  const updateStatusMutation = api.purchaseOrders.updateStatus.useMutation({
    onSuccess: () => {
      toast.success('Statut mis à jour');
      void refetch();
    },
    onError: (err) => toast.error('Erreur', { description: err.message }),
  });

  const orders = data?.items ?? [];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: selectedId ? '1fr 380px' : '1fr', gap: 20, alignItems: 'start' }}>
      {/* List */}
      <div>
        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {(['', 'ready_to_send', 'sent', 'confirmed', 'received', 'cancelled'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              style={{
                padding: '5px 12px',
                borderRadius: 7,
                border: '1px solid var(--border)',
                background: statusFilter === s ? 'var(--primary)' : 'var(--bg)',
                color: statusFilter === s ? '#fff' : 'var(--ink)',
                fontWeight: 600,
                fontSize: 12.5,
                cursor: 'pointer',
              }}
            >
              {s === '' ? 'Tous' : (STATUS_LABELS[s]?.label ?? s)}
            </button>
          ))}
        </div>

        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2, var(--bg-2))' }}>
                  <th style={th}>Référence</th>
                  <th style={th}>Fournisseur</th>
                  <th style={{ ...th, textAlign: 'center' }}>Articles</th>
                  <th style={th}>Statut</th>
                  <th style={th}>Créée le</th>
                  <th style={th}>Envoyée le</th>
                  <th style={{ ...th, width: 32 }} />
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                      <IconPackage size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                      <div>Aucune commande trouvée</div>
                    </td>
                  </tr>
                )}
                {orders.map((o, idx) => {
                  const st = STATUS_LABELS[o.status] ?? { label: o.status, color: 'var(--muted)', bg: 'var(--surface-2)' };
                  return (
                    <tr
                      key={o.id}
                      onClick={() => setSelectedId(selectedId === o.id ? null : o.id)}
                      style={{
                        borderBottom: idx < orders.length - 1 ? '1px solid var(--border)' : 'none',
                        cursor: 'pointer',
                        background: selectedId === o.id ? 'color-mix(in oklch, var(--primary) 6%, transparent)' : 'transparent',
                        transition: 'background 0.1s',
                      }}
                    >
                      <td style={td}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13 }}>{o.reference}</span>
                      </td>
                      <td style={td}>{o.supplierName ?? <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                      <td style={{ ...td, textAlign: 'center' }}>{o.itemCount}</td>
                      <td style={td}>
                        <span style={{ background: st.bg, color: st.color, borderRadius: 99, padding: '2px 10px', fontWeight: 700, fontSize: 12 }}>
                          {st.label}
                        </span>
                      </td>
                      <td style={{ ...td, color: 'var(--muted)', fontSize: 12.5 }}>
                        {format(new Date(o.createdAt), 'dd MMM yyyy', { locale: fr })}
                      </td>
                      <td style={{ ...td, color: 'var(--muted)', fontSize: 12.5 }}>
                        {o.sentAt ? format(new Date(o.sentAt), 'dd MMM yyyy', { locale: fr }) : '—'}
                      </td>
                      <td style={td}>
                        <IconChevronRight size={16} style={{ color: 'var(--muted)', transform: selectedId === o.id ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detail panel */}
      {selectedId && (
        <PurchaseOrderDetail
          orderId={selectedId}
          onStatusChange={() => void refetch()}
          onClose={() => setSelectedId(null)}
          updateStatusMutation={updateStatusMutation}
        />
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  padding: '10px 14px',
  textAlign: 'left',
  fontWeight: 700,
  color: 'var(--muted)',
  fontSize: 12,
};

const td: React.CSSProperties = {
  padding: '11px 14px',
  verticalAlign: 'middle',
};
