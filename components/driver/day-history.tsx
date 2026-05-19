'use client';

import {
  IconArrowBack,
  IconArrowLeft,
  IconBan,
  IconCircleCheck,
  IconTruck,
} from '@tabler/icons-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';

const LIFECYCLE = {
  in_truck: {
    label: 'No caminhão',
    icon: IconTruck,
    color: 'text-brand-500',
    bg: 'bg-blue-50',
  },
  returned: {
    label: 'Devolvido',
    icon: IconArrowBack,
    color: 'text-status-ok',
    bg: 'bg-green-50',
  },
  consumed: {
    label: 'Consumido',
    icon: IconCircleCheck,
    color: 'text-text-secondary',
    bg: 'bg-gray-50',
  },
  voided: {
    label: 'Estornado',
    icon: IconBan,
    color: 'text-text-muted',
    bg: 'bg-gray-50',
  },
} as const;

type LifecycleKey = keyof typeof LIFECYCLE;

type Op = {
  articleName: string;
  articleUnit: string;
  qty: number;
  lifecycle: LifecycleKey;
  createdAt: Date;
};

type Props = {
  history: { operations: Op[] };
};

export function DriverDayHistory({ history }: Props) {
  const today = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <div className="bg-brand-500 px-4 pb-5 pt-10">
        <div className="flex items-center gap-3">
          <Link
            href="/driver"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20"
            aria-label="Voltar"
          >
            <IconArrowLeft size={18} className="text-white" />
          </Link>
          <div>
            <h1 className="text-base font-medium text-white">Minhas operações</h1>
            <p className="text-xs text-white/75 capitalize">{today}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="divide-y divide-surface-border rounded-card border border-surface-border bg-white">
          {history.operations.map((op) => {
            const cfg = LIFECYCLE[op.lifecycle];
            const Icon = cfg.icon;
            const key = `${op.articleName}-${String(op.createdAt)}`;

            return (
              <div key={key} className="flex items-center gap-3 px-4 py-3">
                <div
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${cfg.bg}`}
                >
                  <Icon size={16} className={cfg.color} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">{op.articleName}</p>
                  <p className="text-xs text-text-secondary">
                    {op.qty.toFixed(3)} {op.articleUnit} · {format(new Date(op.createdAt), 'HH:mm')}
                  </p>
                </div>

                <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
              </div>
            );
          })}

          {history.operations.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-text-muted">Nenhuma operação hoje.</p>
          )}
        </div>
      </div>
    </div>
  );
}
