'use client';

import { IconX } from '@tabler/icons-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { api } from '@/lib/trpc/client';

type Truck = { id: string; name: string; code: string; plate: string | null };

interface CreateDriverDialogProps {
  onSuccess: () => void;
}

type FormState = { name: string; email: string; truckId: string };

const EMPTY_FORM: FormState = { name: '', email: '', truckId: '' };

export function CreateDriverDialog({ onSuccess }: CreateDriverDialogProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const trucksQuery = api.users.availableTrucks.useQuery(undefined, { enabled: open });

  const utils = api.useUtils();

  const mutation = api.users.createDriver.useMutation({
    onSuccess(data) {
      toast.success(`Motorista "${data.name}" criado com sucesso. E-mail de boas-vindas enviado.`);
      utils.users.list.invalidate();
      setForm(EMPTY_FORM);
      setOpen(false);
      onSuccess();
    },
    onError(err) {
      toast.error(err.message);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate({
      name: form.name.trim(),
      email: form.email.trim(),
      truckId: form.truckId || undefined,
      idempotencyKey: uuidv4(),
    });
  }

  const trucks: Truck[] = trucksQuery.data ?? [];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-btn bg-brand-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        Novo motorista
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-card border border-surface-border bg-white shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-surface-border px-5 py-4">
              <h2 className="text-base font-semibold text-text-primary">Novo motorista</h2>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setForm(EMPTY_FORM);
                }}
                className="rounded p-1 text-text-muted hover:bg-surface hover:text-text-primary"
              >
                <IconX size={16} />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 px-5 py-4">
                <div>
                  <label
                    htmlFor="driver-name"
                    className="mb-1 block text-xs font-medium text-text-secondary"
                  >
                    Nome <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="driver-name"
                    required
                    autoFocus
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Ex: João Silva"
                    className="w-full rounded-btn border border-surface-border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="driver-email"
                    className="mb-1 block text-xs font-medium text-text-secondary"
                  >
                    E-mail <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="driver-email"
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="motorista@empresa.com"
                    className="w-full rounded-btn border border-surface-border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-text-muted">
                    Um e-mail de boas-vindas será enviado para este endereço.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="driver-truck"
                    className="mb-1 block text-xs font-medium text-text-secondary"
                  >
                    Caminhão (opcional)
                  </label>
                  <select
                    id="driver-truck"
                    value={form.truckId}
                    onChange={(e) => setForm((p) => ({ ...p, truckId: e.target.value }))}
                    className="w-full rounded-btn border border-surface-border bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                    disabled={trucksQuery.isLoading}
                  >
                    <option value="">— Sem caminhão atribuído —</option>
                    {trucks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                        {t.plate ? ` (${t.plate})` : ''}
                        {' — '}
                        {t.code}
                      </option>
                    ))}
                  </select>
                  {trucksQuery.isLoading && (
                    <p className="mt-1 text-xs text-text-muted">A carregar caminhões…</p>
                  )}
                  {!trucksQuery.isLoading && trucks.length === 0 && (
                    <p className="mt-1 text-xs text-text-muted">
                      Todos os caminhões já têm motorista atribuído.
                    </p>
                  )}
                </div>

                {mutation.error && (
                  <p className="rounded-card border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {mutation.error.message}
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 border-t border-surface-border px-5 py-3">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setForm(EMPTY_FORM);
                  }}
                  className="rounded-btn px-4 py-1.5 text-sm text-text-secondary hover:bg-surface"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={mutation.isPending}
                  className="rounded-btn bg-brand-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {mutation.isPending ? 'A criar…' : 'Criar motorista'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
