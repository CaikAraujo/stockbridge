import { DriverDayHistory } from '@/components/driver/day-history';
import { auth } from '@/lib/auth/config';
import { createServerClient } from '@/lib/trpc/server';

export default async function DriverHistoryPage() {
  const [session, api] = await Promise.all([auth(), createServerClient()]);

  const driverId = session?.user?.id;
  if (!driverId) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const history = await api.drivers.history({ driverId, from: today });

  return <DriverDayHistory history={history} />;
}
