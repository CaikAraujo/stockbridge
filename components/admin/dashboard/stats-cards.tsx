import {
  IconAlertTriangle,
  IconArrowUpRight,
  IconPackages,
  IconTransfer,
  IconTruck,
} from '@tabler/icons-react';
import type { ComponentType } from 'react';

// TODO: sparkline history data not available — skip Sparkline in KPI cards
// When a trending history endpoint is added, re-enable Sparkline here.

interface Stats {
  movementsToday: number;
  transfersInTransit: number;
  lowStockAlerts: number;
}

interface Props {
  stats: Stats;
  itensEmCaminhoes: number;
  activeTrucksCount: number;
}

type Tone = 'up' | 'down' | 'flat';

interface KpiConfig {
  label: string;
  value: number;
  delta: string;
  tone: Tone;
  icon: ComponentType<{ size?: number; className?: string }>;
  hue: string;
}

function KpiCard({ label, value, delta, tone, icon: Icon, hue }: KpiConfig) {
  const deltaColor =
    tone === 'down'
      ? 'var(--danger-ink)'
      : tone === 'up'
        ? 'var(--success-ink)'
        : 'var(--muted)';

  const iconBg = `color-mix(in oklch, ${hue} 11%, white)`;

  return (
    <div
      className="card card-hover"
      style={{ padding: 'var(--card-pad)', display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)' }}>{label}</span>
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: 11,
            display: 'grid',
            placeItems: 'center',
            color: hue,
            background: iconBg,
            flexShrink: 0,
          }}
        >
          <Icon size={17} />
        </span>
      </div>
      <div>
        <div
          style={{
            fontFamily: 'var(--font-disp)',
            fontSize: 32,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}
        >
          {value}
        </div>
        <div
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            marginTop: 6,
            whiteSpace: 'nowrap',
            color: deltaColor,
          }}
        >
          {delta}
        </div>
      </div>
    </div>
  );
}

export function StatsCards({ stats, itensEmCaminhoes, activeTrucksCount }: Props) {
  const cards: KpiConfig[] = [
    {
      label: 'Saídas hoje',
      value: stats.movementsToday,
      delta:
        stats.movementsToday > 0 ? `+${stats.movementsToday} registada(s)` : 'Nenhuma saída hoje',
      tone: stats.movementsToday > 0 ? 'up' : 'flat',
      icon: IconArrowUpRight,
      hue: 'var(--primary)',
    },
    {
      label: 'Transferências em trânsito',
      value: stats.transfersInTransit,
      delta:
        stats.transfersInTransit > 0
          ? `${stats.transfersInTransit} a caminho`
          : 'Nenhuma em trânsito',
      tone: 'flat',
      icon: IconTransfer,
      hue: 'var(--violet)',
    },
    {
      label: 'Alertas de estoque',
      value: stats.lowStockAlerts,
      delta: stats.lowStockAlerts > 0 ? 'Itens abaixo do mínimo' : 'Todos os artigos saudáveis',
      tone: stats.lowStockAlerts > 0 ? 'down' : 'flat',
      icon: IconAlertTriangle,
      hue: stats.lowStockAlerts > 0 ? 'var(--danger)' : 'var(--success)',
    },
    {
      label: 'Itens em caminhões',
      value: itensEmCaminhoes,
      delta: `${activeTrucksCount} caminhão(ões) ativo(s)`,
      tone: 'flat',
      icon: IconTruck,
      hue: 'var(--cyan-ink)',
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
        gap: 16,
      }}
    >
      {cards.map((c) => (
        <KpiCard key={c.label} {...c} />
      ))}
    </div>
  );
}

// Re-export for dashboard page use
export { IconPackages };
