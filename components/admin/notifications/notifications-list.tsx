'use client';

import { IconBell, IconCheck, IconDroplet, IconTrash } from '@tabler/icons-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { api } from '@/lib/trpc/client';

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
  const remove = api.notifications.delete.useMutation();

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
      <div className="flex flex-col items-center justify-center py-16 text-text-muted">
        <IconBell size={32} className="mb-3" />
        <p className="text-sm font-medium">Sem notificações pendentes</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {notifs.map((n) => {
        const Icon = TYPE_ICON[n.type] ?? IconBell;
        const isUnread = n.status === 'unread';
        const dataObj =
          n.data !== null && typeof n.data === 'object' ? (n.data as Record<string, unknown>) : {};
        const technician = typeof dataObj.technician === 'string' ? dataObj.technician : null;

        return (
          <div
            key={n.id}
            className={`rounded-card border bg-white p-4 flex items-start gap-4 ${
              isUnread ? 'border-amber-200 bg-amber-50/30' : 'border-surface-border'
            }`}
          >
            <div
              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${
                isUnread ? 'bg-amber-100' : 'bg-surface'
              }`}
            >
              <Icon size={18} className={isUnread ? 'text-amber-600' : 'text-text-muted'} />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary">{n.title}</p>
              <p className="text-xs text-text-secondary mt-0.5">{n.message}</p>
              {technician && (
                <p className="text-xs text-text-muted mt-0.5">
                  Técnico: <span className="font-medium">{technician}</span>
                </p>
              )}
              <p className="text-xs text-text-muted mt-1">
                {format(new Date(n.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
              </p>
            </div>

            <div className="flex gap-1 flex-shrink-0">
              {isUnread && (
                <button
                  type="button"
                  onClick={() => handleResolve(n.id)}
                  title="Marcar como resolvido"
                  className="flex h-8 w-8 items-center justify-center rounded-btn border border-surface-border text-text-muted hover:bg-surface hover:text-status-ok transition-colors"
                >
                  <IconCheck size={14} />
                </button>
              )}
              <button
                type="button"
                onClick={() => handleDelete(n.id)}
                title="Eliminar"
                className="flex h-8 w-8 items-center justify-center rounded-btn border border-surface-border text-text-muted hover:bg-red-50 hover:text-status-critical transition-colors"
              >
                <IconTrash size={14} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
