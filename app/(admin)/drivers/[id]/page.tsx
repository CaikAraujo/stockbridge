import { notFound } from 'next/navigation';
import { DriverHistory } from '@/components/admin/drivers/driver-history';
import { AdminTopbar } from '@/components/admin/layout/topbar';
import { createServerClient } from '@/lib/trpc/server';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DriverHistoryPage({ params }: Props) {
  const { id } = await params;
  const api = await createServerClient();
  const history = await api.drivers.history({ driverId: id });

  if (!history.driver) notFound();

  return (
    <>
      <AdminTopbar
        title={`Histórico — ${history.driver.name}`}
        subtitle={`Caminhão: ${history.truck?.name ?? '—'} · ${history.truck?.code ?? '—'}`}
      />
      <main className="flex-1 overflow-auto p-5">
        <DriverHistory history={history} />
      </main>
    </>
  );
}
