'use client';

import { IconChevronLeft, IconClock, IconUser } from '@tabler/icons-react';
import { useState } from 'react';
import { api } from '@/lib/trpc/client';

type TimeEntryType = 'clock_in' | 'lunch_out' | 'lunch_in' | 'clock_out';

const ENTRY_LABELS: Record<TimeEntryType, string> = {
  clock_in: 'Entrada',
  lunch_out: 'Saída almoço',
  lunch_in: 'Volta almoço',
  clock_out: 'Saída',
};

const DOT_COLOR: Record<TimeEntryType, string> = {
  clock_in: 'bg-status-ok',
  lunch_out: 'bg-amber-400',
  lunch_in: 'bg-blue-400',
  clock_out: 'bg-status-critical',
};

function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  return d.toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long' });
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

function getYearMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
    options.push({ value, label });
  }
  return options;
}

// ============================================================
// Driver detail panel
// ============================================================

function DriverPointageDetail({
  driverId,
  driverName,
  onBack,
}: {
  driverId: string;
  driverName: string;
  onBack?: () => void;
}) {
  const monthOptions = getYearMonthOptions();
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0]?.value ?? '');

  const [year, month] = selectedMonth.split('-').map(Number) as [number, number];
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 0, 23, 59, 59));

  const { data, isLoading } = api.users.getDriverPointage.useQuery(
    { userId: driverId, from, to },
    { enabled: !!driverId && !!selectedMonth },
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-text-secondary hover:bg-surface-border"
            aria-label="Voltar"
          >
            <IconChevronLeft size={18} />
          </button>
        )}
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50">
          <IconUser size={16} className="text-brand-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-text-primary">{driverName}</p>
          <p className="text-xs text-text-muted">Histórico de pointage</p>
        </div>
      </div>

      {/* Month selector */}
      <div className="mb-4">
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="rounded-btn border border-surface-border bg-white px-3 py-2 text-sm text-text-primary focus:border-brand-500 focus:outline-none"
        >
          {monthOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-12 text-text-muted">
            <IconClock size={24} className="mr-2 animate-pulse" />
            A carregar…
          </div>
        )}

        {!isLoading && (!data || data.length === 0) && (
          <div className="flex flex-col items-center justify-center py-16 text-text-muted">
            <IconClock size={40} className="mb-3 opacity-20" />
            <p className="text-sm">Sem registos neste período</p>
          </div>
        )}

        {!isLoading && data && data.length > 0 && (
          <div className="space-y-3">
            {data.map((day) => {
              const hasClockOut = day.entries.some((e) => e.type === 'clock_out');
              const inProgress = !hasClockOut && day.entries.some((e) => e.type === 'clock_in');

              return (
                <div
                  key={day.date}
                  className="rounded-card border border-surface-border bg-white p-4"
                >
                  {/* Day header */}
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-medium capitalize text-text-primary">
                      {formatDate(day.date)}
                    </p>
                    {inProgress ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Em andamento
                      </span>
                    ) : hasClockOut ? (
                      <span className="text-sm font-semibold text-text-primary">
                        {formatDuration(day.totalWorkMinutes)}
                      </span>
                    ) : null}
                  </div>

                  {/* Entries timeline */}
                  <div className="space-y-2">
                    {day.entries.map((entry) => {
                      const type = entry.type as TimeEntryType;
                      return (
                        <div key={entry.id} className="flex items-center gap-2.5">
                          <div
                            className={`h-2 w-2 flex-shrink-0 rounded-full ${DOT_COLOR[type]}`}
                          />
                          <span className="flex-1 text-sm text-text-secondary">
                            {ENTRY_LABELS[type]}
                          </span>
                          <span className="text-sm font-medium text-text-primary">
                            {formatTime(entry.recordedAt)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Main PointageView
// ============================================================

export function PointageView() {
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);

  const { data: users = [] } = api.users.list.useQuery();
  const drivers = users.filter((u) => u.role === 'driver');

  const selectedDriver = drivers.find((d) => d.id === selectedDriverId);

  return (
    <div className="flex gap-5" style={{ minHeight: 480 }}>
      {/* Left: driver list — always visible on desktop, conditional on mobile */}
      <div
        className={`flex flex-col ${selectedDriverId ? 'hidden lg:flex' : 'flex'} w-full lg:w-64 lg:flex-shrink-0`}
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
          Motoristas
        </p>
        <div className="divide-y divide-surface-border overflow-auto rounded-card border border-surface-border bg-white">
          {drivers.length === 0 && (
            <div className="flex items-center justify-center py-10 text-sm text-text-muted">
              Nenhum motorista activo
            </div>
          )}
          {drivers.map((driver) => (
            <button
              key={driver.id}
              type="button"
              onClick={() => setSelectedDriverId(driver.id)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface ${
                selectedDriverId === driver.id ? 'bg-brand-50' : ''
              }`}
            >
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-surface-border text-xs font-medium text-text-secondary">
                {driver.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">{driver.name}</p>
                {driver.email && (
                  <p className="truncate text-xs text-text-muted">{driver.email}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right: detail panel */}
      <div className={`${selectedDriverId ? 'flex' : 'hidden lg:flex'} min-w-0 flex-1 flex-col`}>
        {selectedDriver ? (
          <DriverPointageDetail
            key={selectedDriver.id}
            driverId={selectedDriver.id}
            driverName={selectedDriver.name}
            onBack={() => setSelectedDriverId(null)}
          />
        ) : (
          <div className="hidden flex-1 items-center justify-center text-text-muted lg:flex">
            <div className="text-center">
              <IconClock size={40} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">Seleccione um motorista</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
