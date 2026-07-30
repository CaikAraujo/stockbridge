'use client';

import { useState } from 'react';
import { IconX } from '@tabler/icons-react';
import { toast } from 'sonner';
import { api } from '@/lib/trpc/client';

type Supplier = {
  id: string;
  name: string;
  email: string | null;
  contactName: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
};

interface Props {
  supplier: Supplier | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function SupplierFormModal({ supplier, onClose, onSuccess }: Props) {
  const isEdit = supplier !== null;

  const [name, setName] = useState(supplier?.name ?? '');
  const [email, setEmail] = useState(supplier?.email ?? '');
  const [contactName, setContactName] = useState(supplier?.contactName ?? '');
  const [phone, setPhone] = useState(supplier?.phone ?? '');
  const [address, setAddress] = useState(supplier?.address ?? '');
  const [notes, setNotes] = useState(supplier?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = api.suppliers.create.useMutation({
    onSuccess: () => { toast.success('Fournisseur créé'); onSuccess(); },
    onError: (err) => toast.error('Erreur', { description: err.message }),
  });

  const updateMutation = api.suppliers.update.useMutation({
    onSuccess: () => { toast.success('Fournisseur mis à jour'); onSuccess(); },
    onError: (err) => toast.error('Erreur', { description: err.message }),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim()) e['name'] = 'Le nom est obligatoire';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e['email'] = 'Email invalide';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      idempotencyKey: crypto.randomUUID(),
      name: name.trim(),
      email: email.trim() || undefined,
      contactName: contactName.trim() || undefined,
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    if (isEdit) {
      updateMutation.mutate({ ...payload, id: supplier.id });
    } else {
      createMutation.mutate(payload);
    }
  }

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
        style={{ width: '100%', maxWidth: 520, padding: 28, maxHeight: '90vh', overflow: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <div style={{ fontWeight: 700, fontSize: 17 }}>
            {isEdit ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
            <IconX size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <FormField label="Nom *" error={errors['name']}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Clim Supplies SA"
              style={inputStyle(!!errors['name'])}
              autoFocus
            />
          </FormField>

          <FormField label="Email" error={errors['email']}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="commandes@fournisseur.com"
              style={inputStyle(!!errors['email'])}
            />
          </FormField>

          <FormField label="Nom du contact">
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Jean Dupont"
              style={inputStyle(false)}
            />
          </FormField>

          <FormField label="Téléphone">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+41 22 000 00 00"
              style={inputStyle(false)}
            />
          </FormField>

          <FormField label="Adresse">
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Rue de la Paix 1, 1204 Genève"
              style={inputStyle(false)}
            />
          </FormField>

          <FormField label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Informations complémentaires…"
              rows={3}
              style={{ ...inputStyle(false), resize: 'vertical', fontFamily: 'inherit' }}
            />
          </FormField>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '8px 18px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', color: 'var(--ink)' }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isPending}
              style={{
                padding: '8px 18px',
                border: 'none',
                borderRadius: 8,
                background: isPending ? 'var(--border)' : 'var(--primary)',
                color: '#fff',
                fontWeight: 700,
                fontSize: 13.5,
                cursor: isPending ? 'not-allowed' : 'pointer',
              }}
            >
              {isPending ? 'Sauvegarde…' : isEdit ? 'Sauvegarder' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function inputStyle(hasError: boolean): React.CSSProperties {
  return {
    width: '100%',
    border: `1px solid ${hasError ? 'var(--danger)' : 'var(--border)'}`,
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 13.5,
    background: 'var(--bg)',
    color: 'var(--ink)',
  };
}

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>
        {label.toUpperCase()}
      </label>
      {children}
      {error && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 3 }}>{error}</div>}
    </div>
  );
}
