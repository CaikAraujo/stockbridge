import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ActivityFeed } from '@/components/admin/dashboard/activity-feed';
import { StatsCards } from '@/components/admin/dashboard/stats-cards';
import { TruckList } from '@/components/admin/dashboard/truck-list';
import { AdminTopbar } from '@/components/admin/layout/topbar';
import { auth } from '@/lib/auth/config';
import { createServerClient } from '@/lib/trpc/server';

export default async function DashboardPage() {
  const [api, session] = await Promise.all([createServerClient(), auth()]);

  const [stats, trucks, activity] = await Promise.all([
    api.dashboard.getStats(),
    api.dashboard.getTrucksSummary(),
    api.movements.recentActivity({ limit: 10 }),
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
        />

        {/* TODO: Add 14-day area chart (entradas vs saídas) when aggregation endpoint is available */}

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
