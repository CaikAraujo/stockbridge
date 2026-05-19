import { IconTruck } from '@tabler/icons-react';
import { notFound } from 'next/navigation';
import { AdminTopbar } from '@/components/admin/layout/topbar';
import { TruckInventoryTable } from '@/components/admin/trucks/inventory-table';
import { createServerClient } from '@/lib/trpc/server';

interface Props {
  params: Promise<{ id: string }>;
}

const STATS = [
  { key: 'totalItems', label: 'Itens totais' },
  { key: 'distinctSkus', label: 'SKUs distintos' },
  { key: 'lowCount', label: 'Abaixo do mínimo' },
] as const;

export default async function TruckDetailPage({ params }: Props) {
  const { id } = await params;
  const api = await createServerClient();

  const [trucks, inventory] = await Promise.all([
    api.dashboard.getTrucksSummary(),
    api.dashboard.getTruckInventory({ id }),
  ]);

  const truck = trucks.find((t) => t.id === id);
  if (!truck) notFound();

  return (
    <>
      <AdminTopbar
        title={truck.name}
        subtitle={`${truck.assignedUser?.name ?? '—'} · ${truck.code}${truck.plate ? ` · ${truck.plate}` : ''}`}
      />
      <main className="flex-1 overflow-auto p-5">
        {/* Cabeçalho com métricas */}
        <div className="mb-4 flex items-center justify-between rounded-card border border-surface-border bg-white px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50">
              <IconTruck size={22} className="text-brand-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">{truck.name}</p>
              <p className="text-xs text-text-secondary">
                {truck.assignedUser?.name ?? 'Sem motorista'} · {truck.code}
              </p>
            </div>
          </div>

          <div className="flex gap-8">
            {STATS.map((s) => {
              const value = truck[s.key];
              const warn = s.key === 'lowCount' && value > 0;
              return (
                <div key={s.label} className="text-right">
                  <p
                    className={`text-lg font-medium ${warn ? 'text-status-low' : 'text-text-primary'}`}
                  >
                    {value}
                  </p>
                  <p className="text-xs text-text-secondary">{s.label}</p>
                </div>
              );
            })}
          </div>
        </div>

        <TruckInventoryTable items={inventory} truckId={id} />
      </main>
    </>
  );
}
