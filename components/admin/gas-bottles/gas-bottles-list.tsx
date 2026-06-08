'use client';

import { IconDroplet, IconPlus, IconQrcode, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { generateQRLabelsPDF } from '@/lib/qr-pdf';
import { api } from '@/lib/trpc/client';

type Bottle = {
  id: string;
  name: string;
  reference: string;
  gasTypeCode: string;
  initialWeightKg: string;
  currentWeightKg: string;
  status: string;
  articleId: string | null;
  location: { id: string; name: string; code: string; type: string } | null;
};

type Location = { id: string; name: string; code: string; type: string };

const STATUS_COLOR: Record<string, string> = {
  available: 'bg-green-50 text-green-700',
  in_use: 'bg-blue-50 text-blue-700',
  empty: 'bg-red-50 text-red-700',
};

const STATUS_LABEL: Record<string, string> = {
  available: 'Disponível',
  in_use: 'Em uso',
  empty: 'Vazia',
};

export function GasBottlesList({
  initialData,
  locations,
}: {
  initialData: Bottle[];
  locations: Location[];
}) {
  const [bottles, setBottles] = useState(initialData);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    reference: '',
    gasTypeCode: '',
    initialWeightKg: '',
    locationId: '',
  });

  const create = api.gasBottles.create.useMutation();
  const deleteFn = api.gasBottles.delete.useMutation();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const bottle = await create.mutateAsync({
        ...form,
        initialWeightKg: parseFloat(form.initialWeightKg),
        locationId: form.locationId || undefined,
        idempotencyKey: uuidv4(),
      });
      toast.success('Garrafa cadastrada com sucesso');
      setShowForm(false);
      setBottles((prev) => [...prev, bottle as unknown as Bottle]);
      setForm({ name: '', reference: '', gasTypeCode: '', initialWeightKg: '', locationId: '' });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cadastrar');
    }
  };

  const handlePrintQR = async (bottle: Bottle) => {
    if (!bottle.articleId) return;
    const sku = `GAZ-${bottle.reference.toUpperCase().replace(/[^A-Z0-9]/g, '-')}`;
    try {
      await generateQRLabelsPDF(
        [{ sku, name: `${bottle.name} (${bottle.reference})` }],
        window.location.origin,
      );
      toast.success('Etiqueta gerada');
    } catch {
      toast.error('Erro ao gerar etiqueta');
    }
  };

  const handleDelete = async (bottleId: string) => {
    if (!confirm('Eliminar garrafa?')) return;
    try {
      await deleteFn.mutateAsync({ bottleId, idempotencyKey: uuidv4() });
      setBottles((prev) => prev.filter((b) => b.id !== bottleId));
      toast.success('Garrafa eliminada');
    } catch {
      toast.error('Erro ao eliminar');
    }
  };

  const pctRemaining = (b: Bottle) => {
    const init = parseFloat(b.initialWeightKg);
    const curr = parseFloat(b.currentWeightKg);
    return init > 0 ? Math.round((curr / init) * 100) : 0;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 rounded-btn bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
        >
          <IconPlus size={15} />
          Nova garrafa
        </button>
      </div>

      {showForm && (
        <div className="rounded-card border border-surface-border bg-white p-5">
          <h3 className="mb-4 text-sm font-medium text-text-primary">Nova garrafa</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="gas-name"
                className="mb-1 block text-xs font-medium text-text-secondary"
              >
                Nome do gás *
              </label>
              <input
                id="gas-name"
                required
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="R-404A"
                className="w-full rounded-btn border border-surface-border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="gas-reference"
                className="mb-1 block text-xs font-medium text-text-secondary"
              >
                Referência (nº da garrafa) *
              </label>
              <input
                id="gas-reference"
                required
                value={form.reference}
                onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))}
                placeholder="001"
                className="w-full rounded-btn border border-surface-border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="gas-type-code"
                className="mb-1 block text-xs font-medium text-text-secondary"
              >
                Código do gás (para matching) *
              </label>
              <input
                id="gas-type-code"
                required
                value={form.gasTypeCode}
                onChange={(e) => setForm((p) => ({ ...p, gasTypeCode: e.target.value }))}
                placeholder="R404A"
                className="w-full rounded-btn border border-surface-border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
              <p className="mt-0.5 text-xs text-text-muted">
                Usado para reconhecer no rapport (ex: R32, R410A)
              </p>
            </div>
            <div>
              <label
                htmlFor="gas-weight"
                className="mb-1 block text-xs font-medium text-text-secondary"
              >
                Peso de gás (kg, sem tara) *
              </label>
              <input
                id="gas-weight"
                required
                type="number"
                step="0.1"
                min="0.1"
                value={form.initialWeightKg}
                onChange={(e) => setForm((p) => ({ ...p, initialWeightKg: e.target.value }))}
                placeholder="13.5"
                className="w-full rounded-btn border border-surface-border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="gas-location"
                className="mb-1 block text-xs font-medium text-text-secondary"
              >
                Location inicial
              </label>
              <select
                id="gas-location"
                value={form.locationId}
                onChange={(e) => setForm((p) => ({ ...p, locationId: e.target.value }))}
                className="w-full rounded-btn border border-surface-border bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              >
                <option value="">Sem location</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.code})
                  </option>
                ))}
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
                disabled={create.isPending}
                className="rounded-btn bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
              >
                {create.isPending ? 'Cadastrando...' : 'Cadastrar'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-card border border-surface-border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface">
              {['Garrafa', 'Referência', 'Gás restante', 'Location', 'Estado', ''].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-left text-xs font-medium text-text-muted uppercase tracking-wide"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {bottles.map((b) => {
              const pct = pctRemaining(b);
              return (
                <tr key={b.id} className="hover:bg-surface transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <IconDroplet
                        size={16}
                        className={b.status === 'empty' ? 'text-status-critical' : 'text-brand-500'}
                      />
                      <span className="font-medium text-text-primary">{b.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-secondary">{b.reference}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 rounded-full bg-surface-border overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pct > 50
                              ? 'bg-status-ok'
                              : pct > 20
                                ? 'bg-amber-400'
                                : 'bg-status-critical'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-text-secondary">
                        {parseFloat(b.currentWeightKg).toFixed(1)} /{' '}
                        {parseFloat(b.initialWeightKg).toFixed(1)} kg
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary text-xs">
                    {b.location?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_COLOR[b.status] ?? 'bg-surface text-text-muted'
                      }`}
                    >
                      {STATUS_LABEL[b.status] ?? b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handlePrintQR(b)}
                        title="Imprimir QR"
                        className="rounded p-1 text-text-muted hover:bg-surface hover:text-text-primary transition-colors"
                      >
                        <IconQrcode size={14} />
                      </button>
                      {b.status === 'empty' && (
                        <button
                          type="button"
                          onClick={() => handleDelete(b.id)}
                          title="Eliminar garrafa"
                          className="rounded p-1 text-text-muted hover:bg-red-50 hover:text-status-critical transition-colors"
                        >
                          <IconTrash size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {bottles.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-text-muted">
                  Nenhuma garrafa cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
