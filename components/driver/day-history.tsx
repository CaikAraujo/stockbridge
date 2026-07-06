'use client';

import { IconArrowLeft, IconBan, IconCircleCheck, IconTruck } from '@tabler/icons-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';

const LIFECYCLE = {
  in_truck: {
    label: 'No caminhão',
    icon: IconTruck,
    iconColor: '#1D5FE0',
    iconBg: '#EAF0FB',
    pillColor: '#1D5FE0',
    pillBg: '#EAF0FB',
  },
  returned: {
    label: 'Devolvido',
    icon: IconCircleCheck,
    iconColor: '#12905B',
    iconBg: '#EAF7F0',
    pillColor: '#12905B',
    pillBg: '#EAF7F0',
  },
  consumed: {
    label: 'Consumido',
    icon: IconCircleCheck,
    iconColor: '#7A879C',
    iconBg: '#F2F5F9',
    pillColor: '#7A879C',
    pillBg: '#F2F5F9',
  },
  voided: {
    label: 'Estornado',
    icon: IconBan,
    iconColor: '#A6B1C2',
    iconBg: '#F2F5F9',
    pillColor: '#A6B1C2',
    pillBg: '#F2F5F9',
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: '#FFF', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 2px 10px rgba(17,42,94,.05)', flexShrink: 0 }}>
        <Link href="/driver" aria-label="Voltar" style={{
          width: 38, height: 38, borderRadius: '50%', background: '#F2F5F9',
          display: 'grid', placeItems: 'center', textDecoration: 'none', flexShrink: 0,
        }}>
          <IconArrowLeft size={17} color="#12203A" />
        </Link>
        <div>
          <div style={{ font: '700 16px var(--font-driver)', color: '#12203A', letterSpacing: '-.01em' }}>
            Minhas operações
          </div>
          <div style={{ font: '500 12px var(--font-driver)', color: '#7A879C', textTransform: 'capitalize' }}>
            {today}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '18px 18px 88px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {history.operations.map((op) => {
          const cfg = LIFECYCLE[op.lifecycle];
          const Icon = cfg.icon;
          const key = `${op.articleName}-${String(op.createdAt)}`;

          return (
            <div key={key} style={{
              background: '#FFF', borderRadius: 18, padding: '14px 16px',
              boxShadow: '0 4px 14px rgba(17,42,94,.05)',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: 14,
                background: cfg.iconBg,
                display: 'grid', placeItems: 'center', flexShrink: 0,
              }}>
                <Icon size={19} color={cfg.iconColor} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '700 14px var(--font-driver)', color: '#12203A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {op.articleName}
                </div>
                <div style={{ font: '500 12px var(--font-driver)', color: '#7A879C', marginTop: 1 }}>
                  {op.qty.toFixed(3)} {op.articleUnit} · {format(new Date(op.createdAt), 'HH:mm')}
                </div>
              </div>
              <span style={{
                font: '700 12px var(--font-driver)',
                color: cfg.pillColor,
                background: cfg.pillBg,
                borderRadius: 100,
                padding: '6px 12px',
                whiteSpace: 'nowrap',
              }}>
                {cfg.label}
              </span>
            </div>
          );
        })}

        {history.operations.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', font: '500 13px var(--font-driver)', color: '#A6B1C2' }}>
            Nenhuma operação hoje.
          </div>
        )}
      </div>
    </div>
  );
}
