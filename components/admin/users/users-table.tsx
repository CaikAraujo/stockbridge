'use client';

import { IconKey } from '@tabler/icons-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { api } from '@/lib/trpc/client';
import { CreateDriverDialog } from './create-driver-dialog';
import { DeleteDriverDialog } from './delete-driver-dialog';

type User = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  active: boolean;
  hasPinSet: boolean;
};

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  driver: 'Motorista',
};

const ROLE_COLOR: Record<string, string> = {
  admin: 'bg-violet-50 text-violet-700',
  manager: 'bg-blue-50 text-blue-700',
  driver: 'bg-green-50 text-green-700',
};

function PinBadge({ hasPinSet }: { hasPinSet: boolean }) {
  if (hasPinSet) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
        PIN configurado ✓
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
      Sem PIN ⚠
    </span>
  );
}

export function UsersTable({ initialData }: { initialData: User[] }) {
  const [pinModal, setPinModal] = useState<string | null>(null);
  const [pin, setPin] = useState('');

  const utils = api.useUtils();

  const { data: users, refetch } = api.users.list.useQuery(undefined, {
    initialData,
  });

  const setPin_m = api.users.setPin.useMutation({
    onSuccess() {
      utils.users.list.invalidate();
    },
  });

  const handleSetPin = async () => {
    if (!pinModal || pin.length !== 4) return;
    try {
      await setPin_m.mutateAsync({ userId: pinModal, pin, idempotencyKey: uuidv4() });
      toast.success('PIN definido com sucesso');
      setPinModal(null);
      setPin('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao definir PIN');
    }
  };

  const openPinModal = (userId: string) => {
    setPinModal(userId);
    setPin('');
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CreateDriverDialog onSuccess={() => refetch()} />
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-card border border-surface-border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface">
              {['Nome', 'E-mail', 'Telefone', 'Role', 'PIN', ''].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-text-muted"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {users.map((u) => {
              const isPinModalOpen = pinModal === u.id;
              const currentUser = users.find((x) => x.id === u.id);
              const hasPinSet = currentUser?.hasPinSet ?? u.hasPinSet;

              return (
                <tr key={u.id} className="transition-colors hover:bg-surface">
                  <td className="px-4 py-2.5 font-medium text-text-primary">{u.name}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{u.email ?? '—'}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{u.phone ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLOR[u.role] ?? ''}`}
                    >
                      {ROLE_LABEL[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {u.role === 'driver' && <PinBadge hasPinSet={hasPinSet} />}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      {u.role === 'driver' && (
                        <>
                          <button
                            type="button"
                            onClick={() => openPinModal(u.id)}
                            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-surface"
                            aria-pressed={isPinModalOpen}
                          >
                            <IconKey size={13} />
                            {hasPinSet ? 'Alterar PIN' : 'Definir PIN'}
                          </button>
                          <DeleteDriverDialog
                            driver={{ id: u.id, name: u.name }}
                            onSuccess={() => refetch()}
                          />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-text-muted">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de PIN */}
      {pinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-80 rounded-card border border-surface-border bg-white p-6 shadow-xl">
            <h3 className="mb-1 text-sm font-medium text-text-primary">
              {users.find((u) => u.id === pinModal)?.hasPinSet ? 'Alterar PIN' : 'Definir PIN'} do
              motorista
            </h3>
            <p className="mb-4 text-xs text-text-secondary">
              PIN de 4 dígitos para confirmar operações no PWA. Após salvar, não será possível
              recuperá-lo.
            </p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="0000"
              autoFocus
              className="mb-4 w-full rounded-btn border border-surface-border px-3 py-2.5 text-center text-2xl tracking-widest focus:border-brand-500 focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPinModal(null)}
                className="flex-1 rounded-btn border border-surface-border py-2 text-sm text-text-secondary hover:bg-surface"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSetPin}
                disabled={pin.length !== 4 || setPin_m.isPending}
                className="flex-1 rounded-btn bg-brand-500 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-40"
              >
                {setPin_m.isPending ? 'A salvar…' : 'Salvar PIN'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
