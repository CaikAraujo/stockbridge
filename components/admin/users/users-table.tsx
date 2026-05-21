'use client';

import { IconKey, IconPlus } from '@tabler/icons-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { api } from '@/lib/trpc/client';

type User = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  active: boolean;
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

type FormState = {
  name: string;
  email: string;
  phone: string;
  role: 'admin' | 'manager' | 'driver';
};

export function UsersTable({ initialData }: { initialData: User[] }) {
  const [showForm, setShowForm] = useState(false);
  const [pinModal, setPinModal] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    phone: '',
    role: 'driver',
  });

  const createUser = api.users.create.useMutation();
  const setPin_m = api.users.setPin.useMutation();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createUser.mutateAsync({ ...form, idempotencyKey: uuidv4() });
      toast.success('Usuário criado com sucesso');
      setShowForm(false);
      setForm({ name: '', email: '', phone: '', role: 'driver' });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar usuário');
    }
  };

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

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 rounded-btn bg-brand-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
        >
          <IconPlus size={15} />
          Novo usuário
        </button>
      </div>

      {/* Formulário de criação */}
      {showForm && (
        <div className="rounded-card border border-surface-border bg-white p-5">
          <h3 className="mb-4 text-sm font-medium text-text-primary">Novo usuário</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="user-name"
                className="mb-1 block text-xs font-medium text-text-secondary"
              >
                Nome *
              </label>
              <input
                id="user-name"
                required
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full rounded-btn border border-surface-border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="user-email"
                className="mb-1 block text-xs font-medium text-text-secondary"
              >
                E-mail
              </label>
              <input
                id="user-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="w-full rounded-btn border border-surface-border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="user-phone"
                className="mb-1 block text-xs font-medium text-text-secondary"
              >
                Telefone
              </label>
              <input
                id="user-phone"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                className="w-full rounded-btn border border-surface-border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="user-role"
                className="mb-1 block text-xs font-medium text-text-secondary"
              >
                Role *
              </label>
              <select
                id="user-role"
                value={form.role}
                onChange={(e) =>
                  setForm((p) => ({ ...p, role: e.target.value as FormState['role'] }))
                }
                className="w-full rounded-btn border border-surface-border bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              >
                <option value="driver">Motorista</option>
                <option value="manager">Gerente</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div className="col-span-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-btn border border-surface-border px-4 py-2 text-sm text-text-secondary hover:bg-surface"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-btn bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
              >
                Criar usuário
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabela */}
      <div className="overflow-hidden rounded-card border border-surface-border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface">
              {['Nome', 'E-mail', 'Telefone', 'Role', ''].map((h) => (
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
            {initialData.map((u) => (
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
                  {u.role === 'driver' && (
                    <button
                      type="button"
                      onClick={() => {
                        setPinModal(u.id);
                        setPin('');
                      }}
                      className="flex items-center gap-1 rounded px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-surface"
                    >
                      <IconKey size={13} />
                      Definir PIN
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de PIN */}
      {pinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-80 rounded-card border border-surface-border bg-white p-6 shadow-xl">
            <h3 className="mb-1 text-sm font-medium text-text-primary">Definir PIN do motorista</h3>
            <p className="mb-4 text-xs text-text-secondary">
              PIN de 4 dígitos para confirmar operações no PWA
            </p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="0000"
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
                disabled={pin.length !== 4}
                className="flex-1 rounded-btn bg-brand-500 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-40"
              >
                Salvar PIN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
