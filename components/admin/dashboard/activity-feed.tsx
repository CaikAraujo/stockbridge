import {
  IconAdjustments,
  IconArrowDownLeft,
  IconArrowUpRight,
  IconPackage,
  IconTransfer,
} from '@tabler/icons-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import type { ComponentType } from 'react';
import { StateBadge } from '@/components/admin/shared/state-badge';
import type { BadgeKind } from '@/components/admin/shared/state-badge';

const MOVEMENT_CONFIG = {
  consumption: {
    label: 'saída',
    icon: IconArrowUpRight,
    bg: 'var(--danger-bg)',
    color: 'var(--danger-ink)',
    badge: 'danger' as BadgeKind,
  },
  restock: {
    label: 'entrada',
    icon: IconArrowDownLeft,
    bg: 'var(--success-bg)',
    color: 'var(--success-ink)',
    badge: 'success' as BadgeKind,
  },
  transfer_out: {
    label: 'transferência',
    icon: IconTransfer,
    bg: 'var(--violet-bg)',
    color: 'var(--violet-ink)',
    badge: 'violet' as BadgeKind,
  },
  transfer_in: {
    label: 'transferência',
    icon: IconTransfer,
    bg: 'var(--violet-bg)',
    color: 'var(--violet-ink)',
    badge: 'violet' as BadgeKind,
  },
  adjustment: {
    label: 'ajuste',
    icon: IconAdjustments,
    bg: 'var(--info-bg)',
    color: 'var(--info-ink)',
    badge: 'info' as BadgeKind,
  },
  initial: {
    label: 'inicial',
    icon: IconArrowDownLeft,
    bg: 'var(--surface-2)',
    color: 'var(--muted)',
    badge: 'neutral' as BadgeKind,
  },
  return: {
    label: 'devolução',
    icon: IconArrowDownLeft,
    bg: 'var(--success-bg)',
    color: 'var(--success-ink)',
    badge: 'success' as BadgeKind,
  },
} as const satisfies Record<
  string,
  {
    label: string;
    icon: ComponentType<{ size?: number; className?: string }>;
    bg: string;
    color: string;
    badge: BadgeKind;
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
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">Atividade recente</div>
          <div className="card-sub">Últimas movimentações registradas</div>
        </div>
        <Link
          href="/movements"
          style={{
            background: 'transparent',
            color: 'var(--primary)',
            fontWeight: 800,
            fontSize: 13,
            textDecoration: 'none',
          }}
        >
          Ver tudo →
        </Link>
      </div>

      <div style={{ padding: 'calc(var(--card-pad) - 8px) var(--card-pad) var(--card-pad)' }}>
        {activity.map((a, i) => {
          const cfg = MOVEMENT_CONFIG[a.movementType] ?? MOVEMENT_CONFIG.adjustment;
          const Icon = cfg.icon;
          const qty = parseFloat(a.quantityDelta);
          const isLast = i === activity.length - 1;

          return (
            <div
              key={a.id}
              style={{
                display: 'flex',
                gap: 12,
                padding: '10px 0',
                borderBottom: isLast ? 'none' : '1px solid var(--border-soft)',
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 11,
                  flexShrink: 0,
                  display: 'grid',
                  placeItems: 'center',
                  background: cfg.bg,
                  color: cfg.color,
                }}
              >
                <Icon size={16} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <span>
                    <b>{a.articleName}</b>{' '}
                    <span
                      style={{
                        fontWeight: 800,
                        color: qty < 0 ? 'var(--danger-ink)' : 'var(--success-ink)',
                      }}
                    >
                      {qty > 0 ? '+' : ''}
                      {qty.toFixed(3)} {a.articleUnit}
                    </span>
                  </span>
                  <StateBadge kind={cfg.badge}>{cfg.label}</StateBadge>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                  {a.createdByName} · {a.locationName} ·{' '}
                  {formatDistanceToNow(new Date(a.createdAt), { locale: ptBR, addSuffix: true })}
                </div>
              </div>
            </div>
          );
        })}

        {activity.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              padding: '24px 0',
              color: 'var(--muted)',
            }}
          >
            <IconPackage size={28} style={{ opacity: 0.35 }} />
            <p style={{ margin: 0, fontSize: 13 }}>Nenhuma atividade recente.</p>
          </div>
        )}
      </div>
    </div>
  );
}
