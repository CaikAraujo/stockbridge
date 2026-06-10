'use client';

import { IconAlertTriangle } from '@tabler/icons-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { api } from '@/lib/trpc/client';

interface DeleteDriverDialogProps {
  driver: { id: string; name: string };
  onSuccess: () => void;
}

export function DeleteDriverDialog({ driver, onSuccess }: DeleteDriverDialogProps) {
  const [open, setOpen] = useState(false);

  const utils = api.useUtils();

  const mutation = api.users.deleteDriver.useMutation({
    onSuccess() {
      toast.success(`Motorista "${driver.name}" excluído com sucesso.`);
      utils.users.list.invalidate();
      setOpen(false);
      onSuccess();
    },
    onError(err) {
      toast.error(err.message);
    },
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded px-2 py-1 text-xs text-red-600 transition-colors hover:bg-red-50"
      >
        Excluir
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-card border border-surface-border bg-white shadow-lg">
            <div className="p-6">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100">
                  <IconAlertTriangle size={18} className="text-red-600" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-text-primary">Excluir motorista</h2>
                  <p className="mt-1 text-sm text-text-secondary">
                    Tem a certeza que quer excluir{' '}
                    <strong className="text-text-primary">{driver.name}</strong>?
                  </p>
                  <p className="mt-2 text-xs text-text-muted">
                    O acesso será revogado imediatamente. O histórico de movimentos é preservado.
                  </p>
                </div>
              </div>

              {mutation.error && (
                <p className="mb-3 rounded-card border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {mutation.error.message}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-btn border border-surface-border py-2 text-sm text-text-secondary hover:bg-surface"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={mutation.isPending}
                  onClick={() =>
                    mutation.mutate({ userId: driver.id, idempotencyKey: uuidv4() })
                  }
                  className="flex-1 rounded-btn bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {mutation.isPending ? 'A excluir…' : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
