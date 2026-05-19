import {
  IconAdjustments,
  IconArrowDownLeft,
  IconArrowUpRight,
  IconTransfer,
} from '@tabler/icons-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import type { ComponentType } from 'react';

const MOVEMENT_CONFIG = {
  consumption: {
    label: 'saída',
    icon: IconArrowUpRight,
    bg: 'bg-amber-50',
    color: 'text-amber-700',
  },
  restock: {
    label: 'entrada',
    icon: IconArrowDownLeft,
    bg: 'bg-green-50',
    color: 'text-green-700',
  },
  transfer_out: {
    label: 'transferência',
    icon: IconTransfer,
    bg: 'bg-violet-50',
    color: 'text-violet-700',
  },
  transfer_in: {
    label: 'transferência',
    icon: IconTransfer,
    bg: 'bg-violet-50',
    color: 'text-violet-700',
  },
  adjustment: { label: 'ajuste', icon: IconAdjustments, bg: 'bg-blue-50', color: 'text-blue-700' },
  initial: { label: 'inicial', icon: IconArrowDownLeft, bg: 'bg-gray-50', color: 'text-gray-600' },
  return: {
    label: 'devolução',
    icon: IconArrowDownLeft,
    bg: 'bg-green-50',
    color: 'text-green-700',
  },
} as const satisfies Record<
  string,
  {
    label: string;
    icon: ComponentType<{ size?: number; className?: string }>;
    bg: string;
    color: string;
  }
>;

type MovementType = keyof typeof MOVEMENT_CONFIG;

type Activity = {
  id: string;
  movementType: MovementType;
  quantityDelta: string;
  articleName: string;
  articleUnit: string;
  locationName: string;
  createdByName: string;
  createdAt: Date;
};

interface Props {
  activity: Activity[];
}

export function ActivityFeed({ activity }: Props) {
  return (
    <div className="rounded-card border border-surface-border bg-white">
      <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
        <h2 className="text-sm font-medium text-text-primary">Atividade recente</h2>
        <Link href="/movements" className="text-xs font-medium text-brand-500 hover:underline">
          Ver tudo →
        </Link>
      </div>

      <div className="divide-y divide-surface-border">
        {activity.map((a) => {
          const cfg = MOVEMENT_CONFIG[a.movementType];
          const Icon = cfg.icon;
          const qty = parseFloat(a.quantityDelta);

          return (
            <div key={a.id} className="flex items-start gap-2.5 px-4 py-2.5">
              <div
                className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md ${cfg.bg}`}
              >
                <Icon size={14} className={cfg.color} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-text-primary">
                  {a.articleName} —{' '}
                  <span className={qty < 0 ? 'text-status-low' : 'text-status-ok'}>
                    {Math.abs(qty)} {a.articleUnit}
                  </span>
                  <span
                    className={`ml-1.5 inline-flex rounded px-1.5 py-0.5 text-2xs font-medium ${cfg.bg} ${cfg.color}`}
                  >
                    {cfg.label}
                  </span>
                </p>
                <p className="text-xs text-text-secondary">
                  {a.createdByName} · {a.locationName} ·{' '}
                  {formatDistanceToNow(new Date(a.createdAt), { locale: ptBR, addSuffix: true })}
                </p>
              </div>
            </div>
          );
        })}

        {activity.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-text-muted">Nenhuma atividade hoje.</p>
        )}
      </div>
    </div>
  );
}
