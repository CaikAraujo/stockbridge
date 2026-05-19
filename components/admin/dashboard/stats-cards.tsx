import { IconAlertTriangle, IconPackages, IconTransfer } from '@tabler/icons-react';

interface Props {
  stats: {
    movementsToday: number;
    transfersInTransit: number;
    lowStockAlerts: number;
  };
}

export function StatsCards({ stats }: Props) {
  const cards = [
    {
      label: 'Saídas hoje',
      value: stats.movementsToday,
      icon: IconPackages,
      accent: 'border-l-brand-500',
      iconColor: 'text-brand-500',
      valueColor: undefined as string | undefined,
    },
    {
      label: 'Transferências em trânsito',
      value: stats.transfersInTransit,
      icon: IconTransfer,
      accent: 'border-l-[#7c3aed]',
      iconColor: 'text-[#7c3aed]',
      valueColor: undefined as string | undefined,
    },
    {
      label: 'Alertas de estoque',
      value: stats.lowStockAlerts,
      icon: IconAlertTriangle,
      accent: stats.lowStockAlerts > 0 ? 'border-l-status-low' : 'border-l-status-ok',
      iconColor: stats.lowStockAlerts > 0 ? 'text-status-low' : 'text-status-ok',
      valueColor: stats.lowStockAlerts > 0 ? 'text-status-low' : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`rounded-card border border-surface-border bg-white p-4 border-l-4 ${c.accent}`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-text-secondary">{c.label}</p>
              <p className={`mt-1.5 text-2xl font-medium ${c.valueColor ?? 'text-text-primary'}`}>
                {c.value}
              </p>
            </div>
            <c.icon size={20} className={c.iconColor} />
          </div>
        </div>
      ))}
    </div>
  );
}
