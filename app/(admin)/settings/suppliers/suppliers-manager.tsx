'use client';

import { useState } from 'react';
import { IconEdit, IconPlus, IconRefresh, IconUserOff, IconUserCheck } from '@tabler/icons-react';
import { toast } from 'sonner';
import { api } from '@/lib/trpc/client';
import { SupplierFormModal } from './supplier-form-modal';

type Supplier = {
  id: string;
  name: string;
  email: string | null;
  contactName: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  articleCount: number;
};

type InitialData = {
  items: Supplier[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

interface Props {
  initialData: InitialData;
}

export function SuppliersManager({ initialData }: Props) {
  const [showInactive, setShowInactive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Supplier | null>(null);

  const { data, refetch } = api.suppliers.list.useQuery(
    { page: 1, limit: 100, includeInactive: showInactive },
    { initialData },
  );

  const toggleMutation = api.suppliers.toggleActive.useMutation({
    onSuccess: (s) => {
      toast.success(s.active ? 'Fournisseur réactivé' : 'Fournisseur désactivé');
      void refetch();
    },
    onError: (err) => toast.error('Erreur', { description: err.message }),
  });

  const items = data?.items ?? [];

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => { setEditTarget(null); setModalOpen(true); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 16px',
            background: 'var(--primary)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 13.5,
            cursor: 'pointer',
          }}
        >
          <IconPlus size={16} />
          Nouveau fournisseur
        </button>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, cursor: 'pointer', marginLeft: 'auto' }}>
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Afficher les inactifs
        </label>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2, var(--bg-2))' }}>
                <th style={th}>Nom</th>
                <th style={th}>Email</th>
                <th style={th}>Contact</th>
                <th style={th}>Téléphone</th>
                <th style={{ ...th, textAlign: 'center' }}>Articles</th>
                <th style={{ ...th, textAlign: 'center' }}>Statut</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                    Aucun fournisseur trouvé.
                  </td>
                </tr>
              )}
              {items.map((s, idx) => (
                <tr
                  key={s.id}
                  style={{
                    borderBottom: idx < items.length - 1 ? '1px solid var(--border)' : 'none',
                    opacity: s.active ? 1 : 0.5,
                  }}
                >
                  <td style={td}>
                    <span style={{ fontWeight: 600 }}>{s.name}</span>
                    {s.notes && (
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.notes}
                      </div>
                    )}
                  </td>
                  <td style={td}>{s.email ?? <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                  <td style={td}>{s.contactName ?? <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                  <td style={td}>{s.phone ?? <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <span style={{
                      background: s.articleCount > 0 ? 'color-mix(in oklch, var(--primary) 12%, transparent)' : 'var(--surface-2, var(--bg-2))',
                      color: s.articleCount > 0 ? 'var(--primary)' : 'var(--muted)',
                      borderRadius: 99,
                      padding: '2px 10px',
                      fontWeight: 700,
                      fontSize: 12.5,
                    }}>
                      {s.articleCount}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <span style={{
                      background: s.active
                        ? 'color-mix(in oklch, var(--success) 12%, transparent)'
                        : 'color-mix(in oklch, var(--muted) 15%, transparent)',
                      color: s.active ? 'var(--success-ink, #16a34a)' : 'var(--muted)',
                      borderRadius: 99,
                      padding: '2px 10px',
                      fontWeight: 700,
                      fontSize: 12,
                    }}>
                      {s.active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        title="Modifier"
                        onClick={() => { setEditTarget(s); setModalOpen(true); }}
                        style={actionBtn}
                      >
                        <IconEdit size={15} />
                      </button>
                      <button
                        type="button"
                        title={s.active ? 'Désactiver' : 'Réactiver'}
                        onClick={() => {
                          if (s.active && s.articleCount > 0) {
                            if (!confirm(`${s.articleCount} article(s) sont liés à ce fournisseur. Désactiver quand même ?`)) return;
                          }
                          toggleMutation.mutate({
                            idempotencyKey: crypto.randomUUID(),
                            id: s.id,
                            active: !s.active,
                          });
                        }}
                        style={actionBtn}
                      >
                        {s.active ? <IconUserOff size={15} /> : <IconUserCheck size={15} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <SupplierFormModal
          supplier={editTarget}
          onClose={() => setModalOpen(false)}
          onSuccess={() => {
            setModalOpen(false);
            void refetch();
          }}
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

const actionBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 30,
  height: 30,
  border: '1px solid var(--border)',
  borderRadius: 7,
  background: 'var(--bg)',
  cursor: 'pointer',
  color: 'var(--ink-2)',
};
