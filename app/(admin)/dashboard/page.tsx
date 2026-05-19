import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ActivityFeed } from '@/components/admin/dashboard/activity-feed';
import { StatsCards } from '@/components/admin/dashboard/stats-cards';
import { TruckList } from '@/components/admin/dashboard/truck-list';
import { AdminTopbar } from '@/components/admin/layout/topbar';
import { createServerClient } from '@/lib/trpc/server';

export default async function DashboardPage() {
  const api = await createServerClient();

  const [stats, trucks, activity] = await Promise.all([
    api.dashboard.getStats(),
    api.dashboard.getTrucksSummary(),
    api.movements.recentActivity({ limit: 10 }),
  ]);

  const today = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });

  return (
    <>
      <AdminTopbar title="Dashboard" subtitle={`Visão geral — ${today}`} />
      <main className="flex-1 overflow-auto p-5">
        <StatsCards stats={stats} />
        <div className="mt-4 grid grid-cols-2 gap-4">
          <TruckList trucks={trucks} />
          <ActivityFeed activity={activity} />
        </div>
      </main>
    </>
  );
}
