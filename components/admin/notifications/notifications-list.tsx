'use client';

import { IconBell, IconCheck, IconDroplet, IconTrash } from '@tabler/icons-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { api } from '@/lib/trpc/client';
import { EmptyState } from '@/components/admin/shared/empty-state';
import { StateBadge } from '@/components/admin/shared/state-badge';

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  status: string;
  createdAt: Date;
  data: unknown;
};

const TYPE_ICON: Record<string, typeof IconBell> = {
  gas_bottle_empty: IconDroplet,
};

export function NotificationsList({ initialData }: { initialData: Notification[] }) {
  const [notifs, setNotifs] = useState(initialData);

  const resolve = api.notifications.resolve.useMutation();
  const remove  = api.notifications.delete.useMutation();

  const handleResolve = async (id: string) => {
    try {
      await resolve.mutateAsync({ id, idempotencyKey: uuidv4() });
      setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, status: 'resolved' } : n)));
      toast.success('Marcado como resolvido');
    } catch {
      toast.error('Erro ao resolver notificação');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await remove.mutateAsync({ id, idempotencyKey: uuidv4() });
      setNotifs((prev) => prev.filter((n) => n.id !== id));
      toast.success('Notificação eliminada');
    } catch {
      toast.error('Erro ao eliminar notificação');
    }
  };

  if (notifs.length === 0) {
    return (
      <div className="card">
        <EmptyState
          icon={IconBell}
          title="Sem notificações pendentes"
          sub="Todos os alertas foram resolvidos. O sistema está saudável."
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {notifs.map((n) => {
        const Icon     = TYPE_ICON[n.type] ?? IconBell;
        const isUnread = n.status === 'unread';
        const dataObj  =
          n.data !== null && typeof n.data === 'object' ? (n.data as Record<string, unknown>) : {};
        const technician = typeof dataObj.technician === 'string' ? dataObj.technician : null;

        return (
          <div
            key={n.id}
            className="card"
            style={{
              padding: 'var(--card-pad)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
              borderColor: isUnread ? 'var(--warn-bg)' : 'var(--border-soft)',
              background: isUnread
                ? 'color-mix(in oklch, var(--warn-bg) 35%, white)'
                : 'var(--surface)',
            }}
          >
            {/* Icon tile */}
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 13,
                flexShrink: 0,
                display: 'grid',
                placeItems: 'center',
                background: isUnread ? 'var(--warn-bg)' : 'var(--surface-2)',
                color: isUnread ? 'var(--warn-ink)' : 'var(--muted)',
              }}
            >
              <Icon size={20} />
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                  marginBottom: 2,
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 13.5 }}>{n.title}</span>
                {isUnread && <StateBadge kind="warn" dot>Não lida</StateBadge>}
              </div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)' }}>{n.message}</p>
              {technician && (
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                  Técnico: <b>{technician}</b>
                </p>
              )}
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: 11.5,
                  fontFamily: 'var(--font-code)',
                  color: 'var(--faint)',
                }}
              >
                {format(new Date(n.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
              </p>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              {isUnread && (
                <button
                  type="button"
                  onClick={() => handleResolve(n.id)}
                  title="Marcar como resolvido"
                  className="btn btn-ghost btn-sm btn-icon"
                  style={{ color: 'var(--success-ink)' }}
                >
                  <IconCheck size={15} />
                </button>
              )}
              <button
                type="button"
                onClick={() => handleDelete(n.id)}
                title="Eliminar"
                className="btn btn-danger-ghost btn-sm btn-icon"
              >
                <IconTrash size={15} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
