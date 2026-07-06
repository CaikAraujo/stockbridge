'use client';

import {
  IconClock,
  IconDoorEnter,
  IconDoorExit,
  IconLoader2,
  IconSunrise,
  IconSunset,
  IconX,
} from '@tabler/icons-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { api } from '@/lib/trpc/client';

type TimeEntryType = 'clock_in' | 'lunch_out' | 'lunch_in' | 'clock_out';

const ENTRY_LABELS: Record<TimeEntryType, string> = {
  clock_in: 'Entrada',
  lunch_out: 'Saída almoço',
  lunch_in: 'Volta almoço',
  clock_out: 'Saída',
};

const NEXT_LABEL: Record<TimeEntryType, string> = {
  clock_in: 'Registar entrada',
  lunch_out: 'Saída para almoço',
  lunch_in: 'Volta do almoço',
  clock_out: 'Encerrar jornada',
};

const DOT_COLOR: Record<TimeEntryType, string> = {
  clock_in: '#12905B',
  lunch_out: '#D9970F',
  lunch_in: '#1D5FE0',
  clock_out: '#D93636',
};

const ENTRY_ICON: Record<TimeEntryType, React.ComponentType<{ size?: number; color?: string }>> = {
  clock_in: IconDoorEnter,
  lunch_out: IconSunset,
  lunch_in: IconSunrise,
  clock_out: IconDoorExit,
};

const ORDER: TimeEntryType[] = ['clock_in', 'lunch_out', 'lunch_in', 'clock_out'];

function getNextAction(lastType: TimeEntryType | undefined): TimeEntryType | null {
  if (lastType === 'clock_out') return null;
  const idx = lastType ? ORDER.indexOf(lastType) + 1 : 0;
  return ORDER[idx] ?? null;
}

function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

function getGpsPosition(): Promise<{ latitude: number; longitude: number; accuracy: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => resolve(null),
      { timeout: 10_000, enableHighAccuracy: true },
    );
  });
}

export function PointageButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const utils = api.useUtils();
  const { data: entries = [] } = api.drivers.getTodayPointage.useQuery(undefined, { enabled: open });
  const recordMutation = api.drivers.recordPointage.useMutation({
    onSuccess: async () => { await utils.drivers.getTodayPointage.invalidate(); },
  });

  const lastType = entries[entries.length - 1]?.type as TimeEntryType | undefined;
  const nextAction = getNextAction(lastType);
  const today = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });

  const handleRecord = async () => {
    if (!nextAction || loading) return;
    setLoading(true);
    try {
      const gps = await getGpsPosition();
      await recordMutation.mutateAsync({ type: nextAction, latitude: gps?.latitude, longitude: gps?.longitude, accuracy: gps?.accuracy, idempotencyKey: uuidv4() });
      toast.success(`${ENTRY_LABELS[nextAction]} registada com sucesso`);
      setOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao registar ponto');
    } finally { setLoading(false); }
  };

  const isClockOut = nextAction === 'clock_out';
  const nextBg = isClockOut ? '#D93636' : '#1D5FE0';
  const nextShadow = isClockOut ? '0 8px 22px rgba(217,54,54,.35)' : '0 8px 22px rgba(29,95,224,.35)';

  return (
    <>
      {/* FAB */}
      <button type="button" onClick={() => setOpen(true)} aria-label="Registar ponto"
        style={{ position: 'fixed', bottom: 24, right: 20, zIndex: 50, width: 58, height: 58, borderRadius: '50%', border: 'none', background: '#1D5FE0', display: 'grid', placeItems: 'center', cursor: 'pointer', boxShadow: '0 10px 26px rgba(29,95,224,.45)' }}>
        <IconClock size={24} color="#fff" />
      </button>

      {/* Bottom sheet */}
      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-end', background: 'rgba(10,25,48,.45)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div style={{ width: '100%', borderRadius: '26px 26px 0 0', background: '#FFF', padding: '14px 20px 32px', boxShadow: '0 -12px 40px rgba(10,25,48,.25)' }}>
            {/* Drag handle */}
            <div style={{ width: 40, height: 4, borderRadius: 100, background: '#E3E9F2', margin: '0 auto 16px' }} />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#EAF0FB', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <IconClock size={19} color="#1D5FE0" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ font: '700 17px var(--font-driver)', color: '#12203A', letterSpacing: '-.01em' }}>Ponto</div>
                <div style={{ font: '500 12px var(--font-driver)', color: '#7A879C', textTransform: 'capitalize' }}>{today}</div>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar"
                style={{ width: 36, height: 36, borderRadius: '50%', background: '#F2F5F9', border: 'none', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                <IconX size={15} color="#12203A" />
              </button>
            </div>

            {/* Timeline */}
            {entries.length > 0 ? (
              <div style={{ marginBottom: 20 }}>
                <span style={{ font: '700 11px var(--font-driver)', color: '#A6B1C2', letterSpacing: '.1em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Hoje</span>
                {entries.map((entry) => {
                  const type = entry.type as TimeEntryType;
                  const Icon = ENTRY_ICON[type];
                  return (
                    <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0' }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: DOT_COLOR[type], flexShrink: 0, display: 'inline-block' }} />
                      <Icon size={14} color="#7A879C" />
                      <span style={{ flex: 1, font: '600 14px var(--font-driver)', color: '#12203A' }}>{ENTRY_LABELS[type]}</span>
                      <span style={{ font: '600 14px var(--font-driver)', color: '#7A879C', fontVariantNumeric: 'tabular-nums' }}>{formatTime(entry.recordedAt)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ font: '500 13px var(--font-driver)', color: '#A6B1C2', marginBottom: 20 }}>Sem registos hoje.</p>
            )}

            {/* Próxima ação */}
            {nextAction ? (
              <button type="button" onClick={() => void handleRecord()} disabled={loading}
                style={{ height: 56, border: 'none', borderRadius: 100, background: nextBg, color: '#FFF', font: '700 15px var(--font-driver)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, boxShadow: nextShadow, width: '100%', opacity: loading ? 0.7 : 1 }}>
                {loading
                  ? <IconLoader2 size={20} color="#fff" className="animate-spin" />
                  : (() => { const Icon = ENTRY_ICON[nextAction]; return <Icon size={18} color="#fff" />; })()}
                {loading ? 'A registar…' : NEXT_LABEL[nextAction]}
              </button>
            ) : (
              <div style={{ height: 56, borderRadius: 100, background: '#EAF7F0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#12905B" strokeWidth="2.4"><path d="M5 13l4 4L19 7"/></svg>
                <span style={{ font: '700 15px var(--font-driver)', color: '#12905B' }}>Jornada encerrada</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
