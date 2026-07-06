'use client';

import {
  IconBuilding,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconLoader2,
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
  { id: 1, label: 'Empresa',        icon: IconBuilding },
  { id: 2, label: 'Localização',    icon: IconMapPin   },
  { id: 3, label: 'Equipa & Frota', icon: IconUsers    },
  { id: 4, label: 'Confirmação',    icon: IconCheck    },
] as const;

// ─── shared inline style tokens ───────────────────────────────────────────────
const C = {
  blue:    '#1D5FE0',
  dark:    '#12203A',
  muted:   '#7A879C',
  border:  '#E3E9F2',
  divider: '#EDF1F7',
  step:    '#E7ECF4',
  bg:      '#F2F5F9',
  label:   '#A6B1C2',
  error:   '#E53E3E',
} as const;

const fieldWrapper: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 6,
};
const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: C.muted,
};
const baseInput: React.CSSProperties = {
  height: 48,
  border: `1.5px solid ${C.border}`,
  borderRadius: 12,
  padding: '0 14px',
  fontSize: 15,
  fontWeight: 500,
  color: C.dark,
  background: '#fff',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  transition: 'border-color .15s, box-shadow .15s',
};
const errorInput: React.CSSProperties = {
  ...baseInput,
  borderColor: C.error,
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep]   = useState(1);
  const [data, setData]   = useState<FormData>(INITIAL);
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
    <>
      {/* Scoped focus + spinner styles — no className collisions */}
      <style>{`
        .ob-input:focus {
          border-color: ${C.blue} !important;
          box-shadow: 0 0 0 3px rgba(29,95,224,.12) !important;
        }
        @keyframes ob-spin { to { transform: rotate(360deg); } }
        .ob-spin { animation: ob-spin .8s linear infinite; }
      `}</style>

      <div
        style={{
          minHeight: '100vh',
          background: C.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 16px',
        }}
      >
        <div style={{ width: '100%', maxWidth: 480 }}>

          {/* ── Header ─────────────────────────────────────────────────── */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              textAlign: 'center',
              marginBottom: 32,
            }}
          >
            <div
              style={{
                width: 48, height: 48, borderRadius: '50%',
                background: C.blue,
                display: 'grid', placeItems: 'center', flexShrink: 0,
              }}
            >
              <IconBuilding size={24} color="#fff" />
            </div>
            <h1
              style={{
                fontSize: 24, fontWeight: 700, color: C.dark,
                letterSpacing: '-0.01em', margin: 0,
              }}
            >
              Configurar empresa
            </h1>
            <p style={{ fontSize: 14, fontWeight: 500, color: C.muted, margin: 0 }}>
              Estas informações ajudam a personalizar o StockBridge para a sua equipa.
            </p>
          </div>

          {/* ── Progress stepper ───────────────────────────────────────── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              marginBottom: 28,
            }}
          >
            {STEPS.flatMap(({ id, label }, idx) => {
              const done   = id < step;
              const active = id === step;
              const isLast = idx === STEPS.length - 1;

              const circle = (
                <div
                  key={`step-${id}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    minWidth: 64,
                  }}
                >
                  <div
                    style={{
                      width: 28, height: 28, borderRadius: '50%',
                      display: 'grid', placeItems: 'center',
                      background: done || active ? C.blue : C.step,
                      color: done || active ? '#fff' : C.muted,
                      fontSize: 12, fontWeight: 700, flexShrink: 0,
                      outline: active ? `2px solid ${C.blue}` : 'none',
                      outlineOffset: active ? 2 : 0,
                      transition: 'all .2s',
                    }}
                  >
                    {done ? <IconCheck size={12} /> : id}
                  </div>
                  <span
                    style={{
                      fontSize: 11, fontWeight: 600,
                      color: done || active ? C.blue : C.muted,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                  </span>
                </div>
              );

              if (isLast) return [circle];

              return [
                circle,
                <div
                  key={`line-${id}`}
                  style={{
                    flex: 1,
                    height: 1,
                    background: done ? C.blue : C.step,
                    alignSelf: 'flex-start',
                    marginTop: 14,
                  }}
                />,
              ];
            })}
          </div>

          {/* ── Form card ──────────────────────────────────────────────── */}
          <div
            style={{
              background: '#fff',
              borderRadius: 20,
              padding: '28px 24px',
              boxShadow: '0 6px 24px rgba(17,42,94,.08)',
            }}
          >
            <p
              style={{
                fontSize: 10, fontWeight: 700,
                letterSpacing: '.1em', color: C.label,
                textTransform: 'uppercase', margin: '0 0 20px',
              }}
            >
              Passo {step} de 4
            </p>

            {/* ── Passo 1 ── */}
            {step === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={fieldWrapper}>
                  <label style={labelStyle}>Nome da empresa *</label>
                  <input
                    className="ob-input"
                    style={errors.name ? errorInput : baseInput}
                    value={data.name}
                    onChange={(e) => set('name', e.target.value)}
                    placeholder="Ex: VF Froid SA"
                    autoFocus
                  />
                  {errors.name && (
                    <span style={{ fontSize: 12, color: C.error }}>{errors.name}</span>
                  )}
                </div>

                <div style={fieldWrapper}>
                  <label style={labelStyle}>Segmento *</label>
                  <select
                    className="ob-input"
                    style={errors.segment ? errorInput : baseInput}
                    value={data.segment}
                    onChange={(e) => set('segment', e.target.value as FormData['segment'])}
                  >
                    <option value="">Selecione...</option>
                    <option value="refrigeracao">Refrigeração</option>
                    <option value="hvac">HVAC</option>
                    <option value="eletrica">Elétrica</option>
                    <option value="climatizacao">Climatização</option>
                    <option value="outro">Outro</option>
                  </select>
                  {errors.segment && (
                    <span style={{ fontSize: 12, color: C.error }}>{errors.segment}</span>
                  )}
                </div>
              </div>
            )}

            {/* ── Passo 2 ── */}
            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={fieldWrapper}>
                  <label style={labelStyle}>País</label>
                  <input
                    className="ob-input"
                    style={baseInput}
                    value={data.country}
                    onChange={(e) => set('country', e.target.value)}
                    placeholder="CH"
                  />
                </div>

                <div style={fieldWrapper}>
                  <label style={labelStyle}>Cidade</label>
                  <input
                    className="ob-input"
                    style={baseInput}
                    value={data.city}
                    onChange={(e) => set('city', e.target.value)}
                    placeholder="Ex: Genebra"
                  />
                </div>

                <div style={fieldWrapper}>
                  <label style={labelStyle}>Telefone</label>
                  <input
                    className="ob-input"
                    style={baseInput}
                    value={data.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    placeholder="+41 22 000 00 00"
                    type="tel"
                  />
                </div>

                <div style={fieldWrapper}>
                  <label style={labelStyle}>E-mail de contacto</label>
                  <input
                    className="ob-input"
                    style={baseInput}
                    value={data.contactEmail}
                    onChange={(e) => set('contactEmail', e.target.value)}
                    placeholder="info@empresa.ch"
                    type="email"
                  />
                </div>

                <div style={fieldWrapper}>
                  <label style={labelStyle}>
                    NIF / SIRET{' '}
                    <span style={{ color: C.step, fontWeight: 500 }}>(opcional)</span>
                  </label>
                  <input
                    className="ob-input"
                    style={baseInput}
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
                <div style={fieldWrapper}>
                  <label style={labelStyle}>Número de funcionários</label>
                  <input
                    className="ob-input"
                    style={baseInput}
                    value={data.employeeCount}
                    onChange={(e) => set('employeeCount', e.target.value)}
                    placeholder="Ex: 12"
                    type="number"
                    min={1}
                    max={500}
                  />
                </div>

                <div style={fieldWrapper}>
                  <label style={labelStyle}>Número de veículos / caminhões</label>
                  <input
                    className="ob-input"
                    style={baseInput}
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
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <p style={{ fontSize: 13, color: C.muted, margin: '0 0 4px', fontWeight: 500 }}>
                  Confirme os dados antes de entrar.
                </p>

                {(
                  [
                    ['Empresa',      data.name],
                    ['Segmento',     data.segment ? SEGMENT_LABELS[data.segment] : '—'],
                    ['País',         data.country || 'CH'],
                    ['Cidade',       data.city || '—'],
                    ['Telefone',     data.phone || '—'],
                    ['E-mail',       data.contactEmail || '—'],
                    ['NIF / SIRET',  data.taxId || '—'],
                    ['Funcionários', data.employeeCount || '—'],
                    ['Veículos',     data.vehicleCount || '—'],
                  ] as [string, string][]
                ).map(([rowLabel, value]) => (
                  <div
                    key={rowLabel}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 0',
                      borderBottom: `1px solid ${C.divider}`,
                      gap: 12,
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 500, color: C.muted, flexShrink: 0 }}>
                      {rowLabel}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.dark, textAlign: 'right' }}>
                      {value}
                    </span>
                  </div>
                ))}

                {saveOnboarding.error && (
                  <p style={{ fontSize: 13, color: C.error, marginTop: 12, fontWeight: 500 }}>
                    {saveOnboarding.error.message}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── Navigation ─────────────────────────────────────────────── */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 24,
              gap: 12,
            }}
          >
            <button
              type="button"
              onClick={prev}
              disabled={step === 1}
              style={{
                height: 46,
                paddingInline: 24,
                border: `1.5px solid ${C.border}`,
                borderRadius: 100,
                background: '#fff',
                color: C.dark,
                fontSize: 14,
                fontWeight: 600,
                cursor: step === 1 ? 'not-allowed' : 'pointer',
                opacity: step === 1 ? 0.4 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'opacity .15s',
              }}
            >
              <IconChevronLeft size={16} />
              Anterior
            </button>

            {step < 4 ? (
              <button
                type="button"
                onClick={next}
                style={{
                  height: 46,
                  paddingInline: 24,
                  borderRadius: 100,
                  border: 'none',
                  background: C.blue,
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 6px 16px rgba(29,95,224,.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                Próximo
                <IconChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saveOnboarding.isPending}
                style={{
                  height: 46,
                  paddingInline: 24,
                  borderRadius: 100,
                  border: 'none',
                  background: C.blue,
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: saveOnboarding.isPending ? 'not-allowed' : 'pointer',
                  boxShadow: '0 6px 16px rgba(29,95,224,.3)',
                  opacity: saveOnboarding.isPending ? 0.8 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'opacity .15s',
                }}
              >
                {saveOnboarding.isPending ? (
                  <>
                    <IconLoader2 size={16} className="ob-spin" />
                    A guardar...
                  </>
                ) : (
                  <>
                    Confirmar e entrar
                    <IconCheck size={16} />
                  </>
                )}
              </button>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
