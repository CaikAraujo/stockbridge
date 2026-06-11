import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AreaChart } from '@/components/admin/dashboard/area-chart';
import { ActivityFeed } from '@/components/admin/dashboard/activity-feed';
import { StatsCards } from '@/components/admin/dashboard/stats-cards';
import { TruckList } from '@/components/admin/dashboard/truck-list';
import { AdminTopbar } from '@/components/admin/layout/topbar';
import { auth } from '@/lib/auth/config';
import { createServerClient } from '@/lib/trpc/server';

export default async function DashboardPage() {
  const [api, session] = await Promise.all([createServerClient(), auth()]);

  const [stats, trucks, activity, movementHistory] = await Promise.all([
    api.dashboard.getStats(),
    api.dashboard.getTrucksSummary(),
    api.movements.recentActivity({ limit: 10 }),
    api.dashboard.getMovementHistory(),
  ]);

  const today = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const firstName = session?.user?.name?.split(' ')[0] ?? 'Admin';

  const itensEmCaminhoes = trucks.reduce((sum, t) => sum + t.totalItems, 0);
  const activeTrucksCount = trucks.filter((t) => t.assignedUser !== null).length;

  return (
    <>
      <AdminTopbar
        title={`${greet}, ${firstName}`}
        subtitle={`Visão geral — ${today}`}
      />
      <main className="flex-1 overflow-auto p-5 screen-enter">
        <StatsCards
          stats={stats}
          itensEmCaminhoes={itensEmCaminhoes}
          activeTrucksCount={activeTrucksCount}
          sparkEntries={movementHistory.entries}
          sparkExits={movementHistory.exits}
        />

        {/* 14-day area chart */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))',
            gap: 16,
            marginTop: 16,
          }}
        >
          <div className="card" style={{ padding: 'var(--card-pad)', gridColumn: '1 / -1' }}>
            <div className="card-head" style={{ marginBottom: 12 }}>
              <div>
                <div className="card-title">Movimentações — últimos 14 dias</div>
                <div className="card-sub">Entradas vs. saídas em todas as locations</div>
              </div>
              {/* Legend */}
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 99, background: 'var(--primary)', display: 'inline-block' }} />
                  Entradas
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 99, background: 'var(--accent)', display: 'inline-block' }} />
                  Saídas
                </span>
              </div>
            </div>
            <AreaChart
              series={[
                { label: 'Entradas', data: movementHistory.entries, color: 'var(--primary)' },
                { label: 'Saídas',   data: movementHistory.exits,   color: 'var(--accent)'  },
              ]}
              labels={movementHistory.labels}
            />
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))',
            gap: 16,
            marginTop: 16,
          }}
        >
          <TruckList trucks={trucks} />
          <ActivityFeed activity={activity} />
        </div>
      </main>
    </>
  );
}
