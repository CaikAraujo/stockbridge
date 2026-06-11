import {
  IconAlertTriangle,
  IconArrowUpRight,
  IconPackages,
  IconTransfer,
  IconTruck,
} from '@tabler/icons-react';
import type { ComponentType } from 'react';
import { Sparkline } from './sparkline';

interface Stats {
  movementsToday: number;
  transfersInTransit: number;
  lowStockAlerts: number;
}

interface Props {
  stats: Stats;
  itensEmCaminhoes: number;
  activeTrucksCount: number;
  sparkEntries: number[];
  sparkExits: number[];
}

type Tone = 'up' | 'down' | 'flat';

interface KpiConfig {
  label: string;
  value: number;
  delta: string;
  tone: Tone;
  icon: ComponentType<{ size?: number; className?: string }>;
  hue: string;
  sparkData: number[];
  sparkColor: string;
}

function KpiCard({ label, value, delta, tone, icon: Icon, hue, sparkData, sparkColor }: KpiConfig) {
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
      {/* Header row: label + icon */}
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

      {/* Value + sparkline */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
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
        <Sparkline data={sparkData} color={sparkColor} width={80} height={36} />
      </div>
    </div>
  );
}

export function StatsCards({
  stats,
  itensEmCaminhoes,
  activeTrucksCount,
  sparkEntries,
  sparkExits,
}: Props) {
  // Use exits as proxy for alerts sparkline (both reflect demand pressure)
  const sparkAlerts = sparkExits;

  const cards: KpiConfig[] = [
    {
      label: 'Saídas hoje',
      value: stats.movementsToday,
      delta:
        stats.movementsToday > 0 ? `+${stats.movementsToday} registada(s)` : 'Nenhuma saída hoje',
      tone: stats.movementsToday > 0 ? 'up' : 'flat',
      icon: IconArrowUpRight,
      hue: 'var(--primary)',
      sparkData: sparkExits,
      sparkColor: 'var(--primary)',
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
      sparkData: sparkEntries,
      sparkColor: 'oklch(0.55 0.19 295)',
    },
    {
      label: 'Alertas de estoque',
      value: stats.lowStockAlerts,
      delta: stats.lowStockAlerts > 0 ? 'Itens abaixo do mínimo' : 'Todos os artigos saudáveis',
      tone: stats.lowStockAlerts > 0 ? 'down' : 'flat',
      icon: IconAlertTriangle,
      hue: stats.lowStockAlerts > 0 ? 'var(--danger)' : 'var(--success)',
      sparkData: sparkAlerts,
      sparkColor: 'var(--danger)',
    },
    {
      label: 'Itens em caminhões',
      value: itensEmCaminhoes,
      delta: `${activeTrucksCount} caminhão(ões) ativo(s)`,
      tone: 'flat',
      icon: IconTruck,
      hue: 'var(--cyan-ink)',
      sparkData: sparkEntries,
      sparkColor: 'var(--cyan-ink)',
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
