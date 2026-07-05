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

const NEXT_COLOR: Record<TimeEntryType, string> = {
  clock_in: 'bg-status-ok',
  lunch_out: 'bg-amber-500',
  lunch_in: 'bg-blue-500',
  clock_out: 'bg-status-critical',
};

const DOT_COLOR: Record<TimeEntryType, string> = {
  clock_in: 'bg-status-ok',
  lunch_out: 'bg-amber-400',
  lunch_in: 'bg-blue-400',
  clock_out: 'bg-status-critical',
};

const ENTRY_ICON: Record<TimeEntryType, React.ComponentType<{ size?: number; className?: string }>> =
  {
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
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      () => resolve(null),
      { timeout: 10_000, enableHighAccuracy: true },
    );
  });
}

export function PointageButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const utils = api.useUtils();
  const { data: entries = [] } = api.drivers.getTodayPointage.useQuery(undefined, {
    enabled: open,
  });

  const recordMutation = api.drivers.recordPointage.useMutation({
    onSuccess: async () => {
      await utils.drivers.getTodayPointage.invalidate();
    },
  });

  const lastType = entries[entries.length - 1]?.type as TimeEntryType | undefined;
  const nextAction = getNextAction(lastType);

  const handleRecord = async () => {
    if (!nextAction || loading) return;
    setLoading(true);

    try {
      const gps = await getGpsPosition();
      await recordMutation.mutateAsync({
        type: nextAction,
        latitude: gps?.latitude,
        longitude: gps?.longitude,
        accuracy: gps?.accuracy,
        idempotencyKey: uuidv4(),
      });
      toast.success(`${ENTRY_LABELS[nextAction]} registada com sucesso`);
      setOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao registar ponto';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* FAB */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Registar ponto"
        style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 50 }}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 shadow-lg transition-transform hover:scale-105 active:scale-95"
      >
        <IconClock size={26} className="text-white" />
      </button>

      {/* Bottom sheet */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/40"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full rounded-t-2xl bg-white p-6 pb-8">
            {/* Header */}
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50">
                  <IconClock size={18} className="text-brand-500" />
                </div>
                <span className="text-base font-semibold text-text-primary">Ponto</span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-text-secondary hover:bg-surface-border"
                aria-label="Fechar"
              >
                <IconX size={16} />
              </button>
            </div>

            {/* Timeline de hoje */}
            {entries.length > 0 ? (
              <div className="mb-5 space-y-2">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
                  Hoje
                </p>
                {entries.map((entry) => {
                  const type = entry.type as TimeEntryType;
                  const Icon = ENTRY_ICON[type];
                  return (
                    <div key={entry.id} className="flex items-center gap-3">
                      <div
                        className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${DOT_COLOR[type]}`}
                      />
                      <Icon size={14} className="flex-shrink-0 text-text-secondary" />
                      <span className="flex-1 text-sm text-text-primary">{ENTRY_LABELS[type]}</span>
                      <span className="text-sm font-medium text-text-secondary">
                        {formatTime(entry.recordedAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mb-5 text-sm text-text-muted">Sem registos hoje.</p>
            )}

            {/* Próxima ação */}
            {nextAction ? (
              <button
                type="button"
                onClick={handleRecord}
                disabled={loading}
                className={`flex w-full items-center justify-center gap-2 rounded-btn py-4 text-base font-medium text-white transition-opacity disabled:opacity-60 ${NEXT_COLOR[nextAction]}`}
              >
                {loading ? (
                  <IconLoader2 size={20} className="animate-spin" />
                ) : (
                  (() => {
                    const Icon = ENTRY_ICON[nextAction];
                    return <Icon size={20} />;
                  })()
                )}
                {loading ? 'A registar…' : NEXT_LABEL[nextAction]}
              </button>
            ) : (
              <div className="rounded-btn bg-surface py-4 text-center text-sm text-text-muted">
                Jornada encerrada
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
