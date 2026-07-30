'use client';

import { useState } from 'react';
import { IconX } from '@tabler/icons-react';
import { toast } from 'sonner';
import { api } from '@/lib/trpc/client';

interface Props {
  selectedIds: string[];
  onClose: () => void;
  onSuccess: () => void;
}

export function BulkAssignSupplierModal({ selectedIds, onClose, onSuccess }: Props) {
  const [supplierId, setSupplierId] = useState<string>('');
  const { data: suppliersData } = api.suppliers.listActive.useQuery();
  const suppliers = suppliersData ?? [];

  const mutation = api.suppliers.bulkAssignToArticles.useMutation({
    onSuccess: (data) => {
      toast.success(`Fournisseur associé à ${data.updated} article(s)`);
      onSuccess();
    },
    onError: (err) => toast.error('Erreur', { description: err.message }),
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: '100%', maxWidth: 420, padding: 24 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>
            Associer un fournisseur
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
            <IconX size={18} />
          </button>
        </div>

        <div style={{ fontSize: 13.5, color: 'var(--ink-2)', marginBottom: 16 }}>
          {selectedIds.length} article(s) sélectionné(s). Choisissez le fournisseur à associer.
        </div>

        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
          FOURNISSEUR
        </label>
        <select
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          style={{
            width: '100%',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 13.5,
            background: 'var(--bg)',
            color: 'var(--ink)',
            marginBottom: 20,
          }}
        >
          <option value="">Aucun (retirer le fournisseur)</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '8px 18px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', color: 'var(--ink)' }}
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate({
                idempotencyKey: crypto.randomUUID(),
                articleIds: selectedIds,
                supplierId: supplierId || null,
              })
            }
            style={{
              padding: '8px 18px',
              border: 'none',
              borderRadius: 8,
              background: mutation.isPending ? 'var(--border)' : 'var(--primary)',
              color: '#fff',
              fontWeight: 700,
              fontSize: 13.5,
              cursor: mutation.isPending ? 'not-allowed' : 'pointer',
            }}
          >
            {mutation.isPending ? 'Association…' : 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  );
}
