import { notFound } from 'next/navigation';
import { WithdrawReturnForm } from '@/components/driver/withdraw-return-form';
import { auth } from '@/lib/auth/config';
import { createServerClient } from '@/lib/trpc/server';

interface Props {
  params: Promise<{ sku: string }>;
}

export default async function ScanArticlePage({ params }: Props) {
  const { sku: rawSku } = await params;
  const sku = decodeURIComponent(rawSku);

  const [session, api] = await Promise.all([auth(), createServerClient()]);

  const [article, truckData, locations] = await Promise.all([
    api.drivers.getArticleBySku({ sku }),
    api.drivers.myTruckStock(),
    api.locations.list({ type: 'warehouse', active: true }),
  ]);

  if (!article) notFound();

  const warehouse = locations[0];
  if (!warehouse || !truckData.truck) notFound();

  return (
    <WithdrawReturnForm
      article={article}
      warehouse={warehouse}
      truck={truckData.truck}
      userName={session?.user?.name ?? ''}
    />
  );
}
