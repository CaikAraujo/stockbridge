import { DriverHome } from '@/components/driver/home';
import { auth } from '@/lib/auth/config';
import { createServerClient } from '@/lib/trpc/server';

export default async function DriverHomePage() {
  const [session, api] = await Promise.all([auth(), createServerClient()]);
  const data = await api.drivers.myTruckStock();

  return <DriverHome data={data} userName={session?.user?.name ?? ''} />;
}
