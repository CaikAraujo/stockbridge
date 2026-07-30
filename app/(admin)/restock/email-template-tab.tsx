'use client';

import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/trpc/client';

type Template = {
  emailTemplateSubject: string;
  emailTemplateGreeting: string;
  emailTemplateBody: string;
  emailTemplateFooter: string;
  name: string;
} | null;

interface Props {
  template: Template;
}

const PLACEHOLDERS = [
  { key: 'reference', label: '{reference}', desc: 'Référence commande' },
  { key: 'contactName', label: '{contactName}', desc: 'Nom du contact' },
  { key: 'companyName', label: '{companyName}', desc: 'Votre entreprise' },
  { key: 'date', label: '{date}', desc: "Date d'aujourd'hui" },
] as const;

const DEMO_VARS: Record<string, string> = {
  reference: 'CMD-20260730-001',
  contactName: 'Jean Dupont',
  companyName: 'Votre entreprise',
  date: new Date().toLocaleDateString('fr-FR'),
};

function replacePlaceholders(str: string) {
  return Object.entries(DEMO_VARS).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, v), str);
}

type FieldRef = React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;

export function EmailTemplateTab({ template }: Props) {
  const [subject, setSubject] = useState(template?.emailTemplateSubject ?? 'Demande de commande - {reference}');
  const [greeting, setGreeting] = useState(template?.emailTemplateGreeting ?? 'Bonjour {contactName},');
  const [body, setBody] = useState(template?.emailTemplateBody ?? 'Nous souhaitons vous adresser la commande suivante :');
  const [footer, setFooter] = useState(template?.emailTemplateFooter ?? '');
  const [activeField, setActiveField] = useState<'subject' | 'greeting' | 'body' | 'footer'>('body');

  const subjectRef = useRef<HTMLInputElement>(null);
  const greetingRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const footerRef = useRef<HTMLTextAreaElement>(null);

  const fieldRefs: Record<string, FieldRef> = {
    subject: subjectRef as FieldRef,
    greeting: greetingRef as FieldRef,
    body: bodyRef as FieldRef,
    footer: footerRef as FieldRef,
  };

  const saveMutation = api.purchaseOrders.saveEmailTemplate.useMutation({
    onSuccess: () => toast.success('Modèle sauvegardé'),
    onError: (err) => toast.error('Erreur', { description: err.message }),
  });

  function insertPlaceholder(placeholder: string) {
    const ref = fieldRefs[activeField];
    const el = ref?.current;
    if (!el) return;

    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const before = el.value.slice(0, start);
    const after = el.value.slice(end);
    const newVal = before + placeholder + after;

    if (activeField === 'subject') setSubject(newVal);
    else if (activeField === 'greeting') setGreeting(newVal);
    else if (activeField === 'body') setBody(newVal);
    else if (activeField === 'footer') setFooter(newVal);

    // Restore focus and cursor
    setTimeout(() => {
      el.focus();
      const pos = start + placeholder.length;
      el.setSelectionRange(pos, pos);
    }, 0);
  }

  const handleSave = () => {
    saveMutation.mutate({
      idempotencyKey: crypto.randomUUID(),
      emailTemplateSubject: subject,
      emailTemplateGreeting: greeting,
      emailTemplateBody: body,
      emailTemplateFooter: footer,
    });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
      {/* Left: form */}
      <div className="card" style={{ padding: 'var(--card-pad)' }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: 'var(--ink)' }}>
          Modèle d'email commande
        </div>

        {/* Placeholders */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>
            VARIABLES DISPONIBLES — cliquez pour insérer dans le champ actif
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PLACEHOLDERS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => insertPlaceholder(p.label)}
                title={p.desc}
                style={{
                  padding: '3px 10px',
                  borderRadius: 99,
                  border: '1px solid var(--primary)',
                  background: 'color-mix(in oklch, var(--primary) 10%, transparent)',
                  color: 'var(--primary)',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <Field label="Objet">
          <input
            ref={subjectRef}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onFocus={() => setActiveField('subject')}
            style={inputStyle}
          />
        </Field>

        <Field label="Salutation">
          <input
            ref={greetingRef}
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
            onFocus={() => setActiveField('greeting')}
            style={inputStyle}
          />
        </Field>

        <Field label="Corps du message">
          <textarea
            ref={bodyRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onFocus={() => setActiveField('body')}
            rows={4}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </Field>

        <Field label="Signature / pied de page">
          <textarea
            ref={footerRef}
            value={footer}
            onChange={(e) => setFooter(e.target.value)}
            onFocus={() => setActiveField('footer')}
            rows={4}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </Field>

        <button
          type="button"
          onClick={handleSave}
          disabled={saveMutation.isPending}
          style={{
            marginTop: 8,
            padding: '9px 20px',
            border: 'none',
            borderRadius: 8,
            background: saveMutation.isPending ? 'var(--border)' : 'var(--primary)',
            color: '#fff',
            fontWeight: 700,
            fontSize: 13.5,
            cursor: saveMutation.isPending ? 'not-allowed' : 'pointer',
            width: '100%',
          }}
        >
          {saveMutation.isPending ? 'Sauvegarde…' : 'Sauvegarder le modèle'}
        </button>
      </div>

      {/* Right: live preview */}
      <div className="card" style={{ padding: 'var(--card-pad)' }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: 'var(--ink)' }}>
          Prévisualisation
        </div>
        <div
          style={{
            background: 'var(--surface-2, var(--bg-2))',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '16px 20px',
            fontSize: 13.5,
            lineHeight: 1.7,
            color: 'var(--ink)',
            minHeight: 300,
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
            <span style={{ fontWeight: 700 }}>Objet :</span> {replacePlaceholders(subject)}
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', marginBottom: 14 }} />
          <p style={{ margin: '0 0 12px' }}>{replacePlaceholders(greeting)}</p>
          <p style={{ margin: '0 0 12px' }}>{replacePlaceholders(body)}</p>
          {/* Static article table sample */}
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: 8,
              overflow: 'hidden',
              marginBottom: 12,
              fontSize: 13,
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--muted)', fontSize: 12 }}>Réf.</th>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: 'var(--muted)', fontSize: 12 }}>Désignation</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--muted)', fontSize: 12 }}>Qté</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { sku: 'GZ-R410-1K', name: 'Gaz R-410A — 1 kg', qty: '5 kg' },
                  { sku: 'FLT-GS-150', name: 'Filtre déshydrateur 3/8"', qty: '12 un' },
                  { sku: 'VLV-EX-3/4', name: 'Vanne Schrader 3/4"', qty: '6 pc' },
                ].map((r) => (
                  <tr key={r.sku} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '5px 10px', fontFamily: 'monospace', fontSize: 11.5, color: 'var(--muted)' }}>{r.sku}</td>
                    <td style={{ padding: '5px 10px' }}>{r.name}</td>
                    <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 600 }}>{r.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ margin: 0, whiteSpace: 'pre-line', color: 'var(--ink-2)' }}>
            {replacePlaceholders(footer)}
          </p>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 13.5,
  background: 'var(--bg)',
  color: 'var(--ink)',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label
        style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}
      >
        {label.toUpperCase()}
      </label>
      {children}
    </div>
  );
}
