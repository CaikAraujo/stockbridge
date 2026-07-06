'use client';

import {
  IconBuilding,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconMapPin,
  IconUsers,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/trpc/client';

type FormData = {
  name: string;
  segment: 'refrigeracao' | 'hvac' | 'eletrica' | 'climatizacao' | 'outro' | '';
  country: string;
  city: string;
  phone: string;
  taxId: string;
  employeeCount: string;
  vehicleCount: string;
  contactEmail: string;
};

const SEGMENT_LABELS: Record<string, string> = {
  refrigeracao: 'Refrigeração',
  hvac: 'HVAC',
  eletrica: 'Elétrica',
  climatizacao: 'Climatização',
  outro: 'Outro',
};

const INITIAL: FormData = {
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

const STEPS = [
  { id: 1, label: 'Empresa',             icon: IconBuilding },
  { id: 2, label: 'Localização',         icon: IconMapPin   },
  { id: 3, label: 'Equipa & Frota',      icon: IconUsers    },
  { id: 4, label: 'Confirmação',         icon: IconCheck    },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<FormData>(INITIAL);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const saveOnboarding = api.company.saveOnboarding.useMutation({
    onSuccess: () => router.push('/dashboard'),
  });

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validateStep(s: number): boolean {
    const errs: Partial<Record<keyof FormData, string>> = {};
    if (s === 1) {
      if (!data.name.trim() || data.name.trim().length < 2)
        errs.name = 'Nome deve ter pelo menos 2 caracteres.';
      if (!data.segment) errs.segment = 'Selecione um segmento.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function next() {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(s + 1, 4));
  }

  function prev() {
    setStep((s) => Math.max(s - 1, 1));
  }

  function handleSubmit() {
    if (!data.segment) return;
    saveOnboarding.mutate({
      name: data.name.trim(),
      segment: data.segment,
      country: data.country || 'CH',
      city: data.city.trim() || undefined,
      phone: data.phone.trim() || undefined,
      taxId: data.taxId.trim() || undefined,
      employeeCount: data.employeeCount ? parseInt(data.employeeCount, 10) : undefined,
      vehicleCount: data.vehicleCount ? parseInt(data.vehicleCount, 10) : undefined,
      contactEmail: data.contactEmail.trim() || undefined,
      idempotencyKey: crypto.randomUUID(),
    });
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        padding: '24px 16px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 520 }}>
        {/* Logo / Título */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: 'var(--primary)',
              display: 'inline-grid',
              placeItems: 'center',
              marginBottom: 14,
            }}
          >
            <IconBuilding size={26} color="#fff" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
            Configurar empresa
          </h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 6 }}>
            Estas informações ajudam a personalizar o StockBridge para a sua equipa.
          </p>
        </div>

        {/* Progress */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginBottom: 28,
          }}
        >
          {STEPS.map(({ id, label, icon: Icon }) => {
            const done = id < step;
            const active = id === step;
            return (
              <div
                key={id}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    background: done
                      ? 'var(--primary)'
                      : active
                        ? 'var(--primary-soft)'
                        : 'var(--surface)',
                    border: active
                      ? '2px solid var(--primary)'
                      : done
                        ? 'none'
                        : '2px solid var(--border)',
                    color: done
                      ? '#fff'
                      : active
                        ? 'var(--primary)'
                        : 'var(--muted)',
                    transition: 'all 0.2s',
                  }}
                >
                  {done ? <IconCheck size={14} /> : <Icon size={14} />}
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: active ? 700 : 500,
                    color: active ? 'var(--primary)' : done ? 'var(--text)' : 'var(--muted)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Card */}
        <div className="card" style={{ padding: 28 }}>
          <p
            style={{
              fontSize: 12,
              color: 'var(--muted)',
              margin: '0 0 20px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Passo {step} de 4
          </p>

          {/* ── Passo 1 ── */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="label">Nome da empresa *</label>
                <input
                  className={`input${errors.name ? ' input-error' : ''}`}
                  value={data.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="Ex: VF Froid SA"
                  autoFocus
                />
                {errors.name && (
                  <span style={{ fontSize: 12, color: 'var(--error)', marginTop: 4, display: 'block' }}>
                    {errors.name}
                  </span>
                )}
              </div>

              <div>
                <label className="label">Segmento *</label>
                <select
                  className={`input${errors.segment ? ' input-error' : ''}`}
                  value={data.segment}
                  onChange={(e) =>
                    set('segment', e.target.value as FormData['segment'])
                  }
                >
                  <option value="">Selecione...</option>
                  <option value="refrigeracao">Refrigeração</option>
                  <option value="hvac">HVAC</option>
                  <option value="eletrica">Elétrica</option>
                  <option value="climatizacao">Climatização</option>
                  <option value="outro">Outro</option>
                </select>
                {errors.segment && (
                  <span style={{ fontSize: 12, color: 'var(--error)', marginTop: 4, display: 'block' }}>
                    {errors.segment}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ── Passo 2 ── */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="label">País</label>
                <input
                  className="input"
                  value={data.country}
                  onChange={(e) => set('country', e.target.value)}
                  placeholder="CH"
                />
              </div>
              <div>
                <label className="label">Cidade</label>
                <input
                  className="input"
                  value={data.city}
                  onChange={(e) => set('city', e.target.value)}
                  placeholder="Ex: Genebra"
                />
              </div>
              <div>
                <label className="label">Telefone</label>
                <input
                  className="input"
                  value={data.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  placeholder="+41 22 000 00 00"
                  type="tel"
                />
              </div>
              <div>
                <label className="label">E-mail de contacto</label>
                <input
                  className="input"
                  value={data.contactEmail}
                  onChange={(e) => set('contactEmail', e.target.value)}
                  placeholder="info@empresa.ch"
                  type="email"
                />
              </div>
              <div>
                <label className="label">NIF / SIRET <span style={{ color: 'var(--muted)' }}>(opcional)</span></label>
                <input
                  className="input"
                  value={data.taxId}
                  onChange={(e) => set('taxId', e.target.value)}
                  placeholder="CHE-123.456.789"
                />
              </div>
            </div>
          )}

          {/* ── Passo 3 ── */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="label">Número de funcionários</label>
                <input
                  className="input"
                  value={data.employeeCount}
                  onChange={(e) => set('employeeCount', e.target.value)}
                  placeholder="Ex: 12"
                  type="number"
                  min={1}
                  max={500}
                />
              </div>
              <div>
                <label className="label">Número de veículos / caminhões</label>
                <input
                  className="input"
                  value={data.vehicleCount}
                  onChange={(e) => set('vehicleCount', e.target.value)}
                  placeholder="Ex: 6"
                  type="number"
                  min={1}
                  max={100}
                />
              </div>
            </div>
          )}

          {/* ── Passo 4 — Confirmação ── */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 4 }}>
                Confirme os dados antes de entrar.
              </p>

              {(
                [
                  ['Empresa',          data.name],
                  ['Segmento',         data.segment ? SEGMENT_LABELS[data.segment] : '—'],
                  ['País',             data.country || 'CH'],
                  ['Cidade',           data.city || '—'],
                  ['Telefone',         data.phone || '—'],
                  ['E-mail',           data.contactEmail || '—'],
                  ['NIF / SIRET',      data.taxId || '—'],
                  ['Funcionários',     data.employeeCount || '—'],
                  ['Veículos',         data.vehicleCount || '—'],
                ] as [string, string][]
              ).map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: '1px solid var(--border)',
                    fontSize: 14,
                    gap: 12,
                  }}
                >
                  <span style={{ color: 'var(--muted)', flexShrink: 0 }}>{label}</span>
                  <span style={{ fontWeight: 600, textAlign: 'right' }}>{value}</span>
                </div>
              ))}

              {saveOnboarding.error && (
                <p style={{ fontSize: 13, color: 'var(--error)', marginTop: 8 }}>
                  {saveOnboarding.error.message}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Navegação */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 20,
            gap: 12,
          }}
        >
          <button
            type="button"
            className="btn btn-ghost"
            onClick={prev}
            disabled={step === 1}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <IconChevronLeft size={16} />
            Anterior
          </button>

          {step < 4 ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={next}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              Próximo
              <IconChevronRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={saveOnboarding.isPending}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {saveOnboarding.isPending ? 'A guardar...' : 'Confirmar e entrar'}
              <IconCheck size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
