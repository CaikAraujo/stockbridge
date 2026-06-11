'use client';

import { IconBell, IconCheck, IconDroplet, IconTrash, IconX } from '@tabler/icons-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
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

const TONES: Record<string, [string, string]> = {
  danger: ['var(--danger-bg)',  'var(--danger-ink)'],
  warn:   ['var(--warn-bg)',    'var(--warn-ink)'  ],
  info:   ['var(--info-bg)',    'var(--info-ink)'  ],
};

function getDefaultTone(type: string): [string, string] {
  if (type === 'gas_bottle_empty') return TONES.warn ?? ['var(--warn-bg)', 'var(--warn-ink)'];
  return TONES.info ?? ['var(--info-bg)', 'var(--info-ink)'];
}

export function NotifBell() {
  const [open, setOpen] = useState(false);
  const ref             = useRef<HTMLDivElement>(null);

  const { data: notifs = [], refetch } = api.notifications.list.useQuery(
    { status: 'unread' },
    { refetchInterval: 60_000 },
  );

  const resolve = api.notifications.resolve.useMutation({
    onSuccess: () => { void refetch(); },
  });
  const remove = api.notifications.delete.useMutation({
    onSuccess: () => { void refetch(); },
  });

  const handleResolve = async (id: string) => {
    try {
      await resolve.mutateAsync({ id, idempotencyKey: uuidv4() });
      toast.success('Marcado como resolvido');
    } catch {
      toast.error('Erro ao resolver notificação');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await remove.mutateAsync({ id, idempotencyKey: uuidv4() });
      toast.success('Notificação eliminada');
    } catch {
      toast.error('Erro ao eliminar notificação');
    }
  };

  // Fechar ao clicar fora
  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [open]);

  const hasUnread = notifs.length > 0;
  const preview   = notifs.slice(0, 5) as Notification[];

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button
        type="button"
        className="tb-btn"
        aria-label="Notificações"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg
          viewBox="0 0 24 24" width={19} height={19}
          fill="none" stroke="currentColor"
          strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 9a6 6 0 1 0-12 0c0 6-2.5 7-2.5 7h17S18 15 18 9z" />
          <path d="M10 19.5a2.2 2.2 0 0 0 4 0" />
        </svg>
        {hasUnread && <span className="tb-dot" />}
      </button>

      {open && (
        <div
          className="popover pop-in"
          style={{ right: 0, width: 360, position: 'absolute', zIndex: 50 }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', borderBottom: '1px solid var(--border-soft)',
            }}
          >
            <strong style={{ fontSize: 14 }}>Notificações</strong>
            <button
              type="button"
              className="tb-btn"
              aria-label="Fechar"
              onClick={() => setOpen(false)}
              style={{ width: 28, height: 28 }}
            >
              <IconX size={15} />
            </button>
          </div>

          {/* List */}
          {preview.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              Sem notificações não lidas
            </div>
          ) : (
            preview.map((n) => {
              const Icon  = TYPE_ICON[n.type] ?? IconBell;
              const [bg, ink] = getDefaultTone(n.type);
              return (
                <div
                  key={n.id}
                  className="notif-row"
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border-soft)' }}
                >
                  {/* Icon tile */}
                  <div
                    style={{
                      width: 36, height: 36, borderRadius: 11, flexShrink: 0,
                      display: 'grid', placeItems: 'center',
                      background: bg, color: ink,
                    }}
                  >
                    <Icon size={17} />
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{n.title}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 1 }}>{n.message}</div>
                    <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>
                      {format(new Date(n.createdAt), 'dd/MM HH:mm', { locale: ptBR })}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm btn-icon"
                      title="Marcar como resolvido"
                      style={{ color: 'var(--success-ink)' }}
                      onClick={() => handleResolve(n.id)}
                    >
                      <IconCheck size={13} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger-ghost btn-sm btn-icon"
                      title="Eliminar"
                      onClick={() => handleDelete(n.id)}
                    >
                      <IconTrash size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {/* Footer */}
          <div
            style={{
              padding: '10px 16px', background: 'var(--surface-2)',
              textAlign: 'center', borderTop: '1px solid var(--border-soft)',
            }}
          >
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--primary)' }}
            >
              Ver todas →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
