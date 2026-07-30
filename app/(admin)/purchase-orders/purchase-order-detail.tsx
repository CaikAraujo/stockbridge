'use client';

import { IconX } from '@tabler/icons-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { UseMutationResult } from '@tanstack/react-query';
import { api } from '@/lib/trpc/client';

const STATUS_LABELS: Record<string, string> = {
  ready_to_send: "En attente d'envoi",
  sent: 'Envoyée',
  confirmed: 'Confirmée',
  received: 'Reçue',
  cancelled: 'Annulée',
};

interface Props {
  orderId: string;
  onStatusChange: () => void;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateStatusMutation: UseMutationResult<any, any, any, any>;
}

export function PurchaseOrderDetail({ orderId, onClose, updateStatusMutation }: Props) {
  const { data: order, isLoading } = api.purchaseOrders.getById.useQuery({ id: orderId });

  if (isLoading || !order) {
    return (
      <div className="card" style={{ padding: 'var(--card-pad)', color: 'var(--muted)', fontSize: 13.5 }}>
        Chargement…
      </div>
    );
  }

  const canMarkReceived = order.status === 'sent' || order.status === 'confirmed';

  return (
    <div className="card" style={{ padding: 'var(--card-pad)', position: 'sticky', top: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15 }}>{order.reference}</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
            {STATUS_LABELS[order.status] ?? order.status}
          </div>
        </div>
        <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
          <IconX size={18} />
        </button>
      </div>

      {/* Supplier */}
      <Section title="Fournisseur">
        <div style={{ fontWeight: 600 }}>{order.supplier?.name ?? '—'}</div>
        {order.supplier?.email && <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{order.supplier.email}</div>}
      </Section>

      {/* Dates */}
      <Section title="Dates">
        <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span>Créée : {format(new Date(order.createdAt), 'dd MMM yyyy à HH:mm', { locale: fr })}</span>
          {order.sentAt && <span>Envoyée : {format(new Date(order.sentAt), 'dd MMM yyyy à HH:mm', { locale: fr })}</span>}
        </div>
      </Section>

      {/* Articles */}
      <Section title={`Articles (${order.items.length})`}>
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2, var(--bg-2))' }}>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--muted)', fontSize: 11 }}>Article</th>
                <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--muted)', fontSize: 11 }}>Qté</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, i) => (
                <tr key={item.id} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '6px 10px' }}>
                    <div style={{ fontWeight: 500 }}>{item.articleName}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>{item.articleSku}</div>
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>
                    {item.quantity} {item.articleUnit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Email body */}
      <Section title="Email composé">
        <div
          style={{
            background: 'var(--surface-2, var(--bg-2))',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '10px 12px',
            fontSize: 12.5,
            whiteSpace: 'pre-wrap',
            lineHeight: 1.6,
            maxHeight: 200,
            overflow: 'auto',
            color: 'var(--ink-2)',
          }}
        >
          <strong>Objet : {order.emailSubject}</strong>
          {'\n\n'}
          {order.emailBody}
        </div>
      </Section>

      {/* Action */}
      {canMarkReceived && (
        <button
          type="button"
          disabled={updateStatusMutation.isPending}
          onClick={() =>
            updateStatusMutation.mutate({
              idempotencyKey: crypto.randomUUID(),
              id: order.id,
              status: 'received',
            })
          }
          style={{
            width: '100%',
            marginTop: 16,
            padding: '9px',
            background: updateStatusMutation.isPending ? 'var(--border)' : 'var(--success, #16a34a)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 13.5,
            cursor: updateStatusMutation.isPending ? 'not-allowed' : 'pointer',
          }}
        >
          {updateStatusMutation.isPending ? 'Mise à jour…' : 'Marquer comme reçue'}
        </button>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 7, letterSpacing: '0.06em' }}>
        {title.toUpperCase()}
      </div>
      {children}
    </div>
  );
}
