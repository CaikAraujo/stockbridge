'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/trpc/client';

type FormData = {
  name: string;
  segment: string;
  country: string;
  city: string;
  phone: string;
  taxId: string;
  employeeCount: string;
  vehicleCount: string;
  contactEmail: string;
};

const EMPTY: FormData = {
  name: '',
  segment: '',
  country: 'CH',
  city: '',
  phone: '',
  taxId: '',
  employeeCount: '',
  vehicleCount: '',
  contactEmail: '',
};

export function CompanySettingsForm() {
  const { data: settings, isLoading } = api.company.getSettings.useQuery();
  const utils = api.useUtils();

  const [form, setForm] = useState<FormData>(EMPTY);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    setForm({
      name: settings.name ?? '',
      segment: settings.segment ?? '',
      country: settings.country ?? 'CH',
      city: settings.city ?? '',
      phone: settings.phone ?? '',
      taxId: settings.taxId ?? '',
      employeeCount: settings.employeeCount != null ? String(settings.employeeCount) : '',
      vehicleCount: settings.vehicleCount != null ? String(settings.vehicleCount) : '',
      contactEmail: settings.contactEmail ?? '',
    });
  }, [settings]);

  const updateSettings = api.company.updateSettings.useMutation({
    onSuccess: async () => {
      await utils.company.getSettings.invalidate();
      setSaved(true);
      setFormError(null);
      setTimeout(() => setSaved(false), 3000);
    },
    onError: (err) => {
      setFormError(err.message);
    },
  });

  function set<K extends keyof FormData>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
    setFormError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateSettings.mutate({
      name: form.name.trim() || undefined,
      segment: (form.segment as 'refrigeracao' | 'hvac' | 'eletrica' | 'climatizacao' | 'outro') || undefined,
      country: form.country || undefined,
      city: form.city.trim() || undefined,
      phone: form.phone.trim() || undefined,
      taxId: form.taxId.trim() || undefined,
      employeeCount: form.employeeCount ? parseInt(form.employeeCount, 10) : undefined,
      vehicleCount: form.vehicleCount ? parseInt(form.vehicleCount, 10) : undefined,
      contactEmail: form.contactEmail.trim() || undefined,
      idempotencyKey: crypto.randomUUID(),
    });
  }

  if (isLoading) {
    return (
      <div style={{ color: 'var(--muted)', fontSize: 14 }}>A carregar...</div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 560 }}
    >
      {/* Empresa */}
      <section>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>
          Empresa
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="label">Nome da empresa</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="VF Froid SA"
            />
          </div>
          <div>
            <label className="label">Segmento</label>
            <select
              className="input"
              value={form.segment}
              onChange={(e) => set('segment', e.target.value)}
            >
              <option value="">Selecione...</option>
              <option value="refrigeracao">Refrigeração</option>
              <option value="hvac">HVAC</option>
              <option value="eletrica">Elétrica</option>
              <option value="climatizacao">Climatização</option>
              <option value="outro">Outro</option>
            </select>
          </div>
        </div>
      </section>

      {/* Localização & Contacto */}
      <section>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>
          Localização & Contacto
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="label">País</label>
            <input
              className="input"
              value={form.country}
              onChange={(e) => set('country', e.target.value)}
              placeholder="CH"
            />
          </div>
          <div>
            <label className="label">Cidade</label>
            <input
              className="input"
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
              placeholder="Genebra"
            />
          </div>
          <div>
            <label className="label">Telefone</label>
            <input
              className="input"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="+41 22 000 00 00"
              type="tel"
            />
          </div>
          <div>
            <label className="label">E-mail de contacto</label>
            <input
              className="input"
              value={form.contactEmail}
              onChange={(e) => set('contactEmail', e.target.value)}
              placeholder="info@empresa.ch"
              type="email"
            />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="label">NIF / SIRET</label>
            <input
              className="input"
              value={form.taxId}
              onChange={(e) => set('taxId', e.target.value)}
              placeholder="CHE-123.456.789"
            />
          </div>
        </div>
      </section>

      {/* Equipa & Frota */}
      <section>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>
          Equipa & Frota
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="label">Número de funcionários</label>
            <input
              className="input"
              value={form.employeeCount}
              onChange={(e) => set('employeeCount', e.target.value)}
              placeholder="12"
              type="number"
              min={1}
              max={500}
            />
          </div>
          <div>
            <label className="label">Número de veículos</label>
            <input
              className="input"
              value={form.vehicleCount}
              onChange={(e) => set('vehicleCount', e.target.value)}
              placeholder="6"
              type="number"
              min={1}
              max={100}
            />
          </div>
        </div>
      </section>

      {/* Feedback */}
      {formError && (
        <p style={{ fontSize: 13, color: 'var(--error)' }}>{formError}</p>
      )}
      {saved && (
        <p style={{ fontSize: 13, color: 'var(--success, #16a34a)', fontWeight: 600 }}>
          Alterações guardadas com sucesso.
        </p>
      )}

      <div>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={updateSettings.isPending}
        >
          {updateSettings.isPending ? 'A guardar...' : 'Salvar alterações'}
        </button>
      </div>
    </form>
  );
}
