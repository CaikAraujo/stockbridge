'use client';

import { useState } from 'react';
import { IconX } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { api } from '@/lib/trpc/client';

type CriticalArticle = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  current_qty: string;
  min_stock: string;
  supplier_id: string | null;
  supplier_name: string | null;
};

type Template = {
  emailTemplateSubject: string;
  emailTemplateGreeting: string;
  emailTemplateBody: string;
  emailTemplateFooter: string;
  name: string;
} | null;

interface Props {
  articles: CriticalArticle[];
  selectedIds: Set<string>;
  quantities: Record<string, string>;
  template: Template;
  initialSupplierId: string | null;
  supplierGroups: Record<string, { name: string; articles: CriticalArticle[] }>;
  onClose: () => void;
  onSuccess: () => void;
}

function replacePlaceholders(str: string, vars: Record<string, string>) {
  return Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, v), str);
}

export function OrderModal({
  articles,
  selectedIds,
  quantities,
  template,
  initialSupplierId,
  supplierGroups,
  onClose,
  onSuccess,
}: Props) {
  const router = useRouter();

  const supplierIds = Object.keys(supplierGroups);
  const [activeSupplierId, setActiveSupplierId] = useState<string>(
    initialSupplierId ?? supplierIds[0] ?? '',
  );

  const activeGroup = activeSupplierId ? supplierGroups[activeSupplierId] : null;
  const activeArticles = activeGroup
    ? articles.filter((a) => a.supplier_id === activeSupplierId && selectedIds.has(a.id))
    : [];

  const today = new Date().toLocaleDateString('fr-FR');
  const vars = {
    reference: 'CMD-XXXXXXXX-XXX',
    contactName: activeGroup ? (articles.find((a) => a.supplier_id === activeSupplierId)?.supplier_name ?? 'Contact') : 'Contact',
    companyName: template?.name ?? 'Votre entreprise',
    date: today,
  };

  const defaultSubject = replacePlaceholders(template?.emailTemplateSubject ?? 'Demande de commande - {reference}', vars);
  const defaultGreeting = replacePlaceholders(template?.emailTemplateGreeting ?? 'Bonjour {contactName},', vars);
  const defaultBody = template?.emailTemplateBody ?? 'Nous souhaitons vous adresser la commande suivante :';
  const defaultFooter = replacePlaceholders(template?.emailTemplateFooter ?? '', vars);

  const [subject, setSubject] = useState(defaultSubject);
  const [greeting, setGreeting] = useState(defaultGreeting);
  const [body, setBody] = useState(defaultBody);
  const [footer, setFooter] = useState(defaultFooter);
  const [sendCopy, setSendCopy] = useState(false);

  const createMutation = api.purchaseOrders.create.useMutation({
    onSuccess: (data) => {
      toast.success(`Commande ${data.reference} créée`, {
        description: "L'envoi email sera activé prochainement.",
      });
      router.refresh();
      onSuccess();
    },
    onError: (err) => {
      toast.error('Erreur', { description: err.message });
    },
  });

  const handleConfirm = () => {
    if (!activeSupplierId) return;

    const emailBody = [greeting, '', body, '', buildArticleTable(), '', footer].join('\n');

    createMutation.mutate({
      idempotencyKey: crypto.randomUUID(),
      supplierId: activeSupplierId,
      emailSubject: subject,
      emailBody,
      items: activeArticles.map((a) => ({
        articleId: a.id,
        quantity: quantities[a.id] ?? '1',
      })),
    });
  };

  function buildArticleTable() {
    const header = 'Référence | Désignation | Quantité';
    const sep = '---------- | ----------- | --------';
    const rows = activeArticles.map(
      (a) => `${a.sku} | ${a.name} | ${quantities[a.id] ?? '1'} ${a.unit}`,
    );
    return [header, sep, ...rows].join('\n');
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
        style={{ width: '100%', maxWidth: 680, maxHeight: '90vh', overflow: 'auto', padding: 28 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--ink)' }}>
              Confirmer la commande
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>
              L'email sera composé ci-dessous — aucun envoi automatique.
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
            <IconX size={20} />
          </button>
        </div>

        {/* Multi-supplier notice + tabs */}
        {supplierIds.length > 1 && (
          <>
            <div
              style={{
                background: 'color-mix(in oklch, orange 10%, transparent)',
                border: '1px solid color-mix(in oklch, orange 30%, transparent)',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 12.5,
                color: '#b45309',
                fontWeight: 600,
                marginBottom: 12,
              }}
            >
              {supplierIds.length} fournisseurs sélectionnés. Une commande sera créée par fournisseur
              — confirmez chacune séparément via les onglets ci-dessous.
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              {supplierIds.map((sid) => (
                <button
                  key={sid}
                  type="button"
                  onClick={() => setActiveSupplierId(sid)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 7,
                    border: '1px solid var(--border)',
                    background: activeSupplierId === sid ? 'var(--primary)' : 'var(--bg)',
                    color: activeSupplierId === sid ? '#fff' : 'var(--ink)',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  {supplierGroups[sid]?.name}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Para: email non-editable */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
            POUR
          </label>
          <div style={{ fontSize: 13.5, padding: '8px 12px', background: 'var(--surface-2, var(--bg-2))', borderRadius: 8, color: 'var(--ink-2)', fontWeight: 500 }}>
            {activeGroup?.name ?? '—'}
          </div>
        </div>

        {/* Subject */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
            OBJET
          </label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            style={{
              width: '100%',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 13.5,
              background: 'var(--bg)',
              color: 'var(--ink)',
            }}
          />
        </div>

        {/* Greeting */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
            SALUTATION
          </label>
          <input
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
            style={{
              width: '100%',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 13.5,
              background: 'var(--bg)',
              color: 'var(--ink)',
            }}
          />
        </div>

        {/* Body */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
            CORPS
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            style={{
              width: '100%',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 13.5,
              background: 'var(--bg)',
              color: 'var(--ink)',
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Articles table (non-editable) */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
            ARTICLES ({activeArticles.length})
          </label>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface-2, var(--bg-2))', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--muted)' }}>Référence</th>
                  <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--muted)' }}>Désignation</th>
                  <th style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--muted)' }}>Quantité</th>
                </tr>
              </thead>
              <tbody>
                {activeArticles.map((a, i) => (
                  <tr key={a.id} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 12, color: 'var(--muted)' }}>{a.sku}</td>
                    <td style={{ padding: '7px 10px' }}>{a.name}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600 }}>
                      {quantities[a.id] ?? '1'} {a.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
            SIGNATURE
          </label>
          <textarea
            value={footer}
            onChange={(e) => setFooter(e.target.value)}
            rows={3}
            style={{
              width: '100%',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 13.5,
              background: 'var(--bg)',
              color: 'var(--ink)',
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Send copy */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, marginBottom: 20, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={sendCopy}
            onChange={(e) => setSendCopy(e.target.checked)}
          />
          M'envoyer une copie (à implémenter)
        </label>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 20px',
              border: '1px solid var(--border)',
              borderRadius: 8,
              background: 'var(--bg)',
              color: 'var(--ink)',
              fontWeight: 600,
              fontSize: 13.5,
              cursor: 'pointer',
            }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={createMutation.isPending || activeArticles.length === 0}
            style={{
              padding: '8px 20px',
              border: 'none',
              borderRadius: 8,
              background: createMutation.isPending ? 'var(--border)' : 'var(--primary)',
              color: '#fff',
              fontWeight: 700,
              fontSize: 13.5,
              cursor: createMutation.isPending ? 'not-allowed' : 'pointer',
            }}
          >
            {createMutation.isPending ? 'Création…' : 'Confirmer la commande'}
          </button>
        </div>
      </div>
    </div>
  );
}
