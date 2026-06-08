import { AdminTopbar } from '@/components/admin/layout/topbar';
import { NotificationsList } from '@/components/admin/notifications/notifications-list';
import { createServerClient } from '@/lib/trpc/server';

export default async function NotificationsPage() {
  const api = await createServerClient();
  const notifs = await api.notifications.list({ status: 'unread' });

  return (
    <>
      <AdminTopbar title="Notificações" subtitle="Alertas do sistema" />
      <main className="flex-1 overflow-auto p-5">
        <NotificationsList initialData={notifs} />
      </main>
    </>
  );
}
