'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { api } from '@/lib/trpc/client';

type Article = { id: string; name: string; sku: string; unit: string };
type Location = { id: string; name: string; code: string; type: string };
type Tab = 'restock' | 'adjust';

const TAB_CONFIG = {
  restock: {
    label: 'Entrada de mercadoria',
    description: 'Nova mercadoria recebida do fornecedor',
  },
  adjust: {
    label: 'Ajuste de inventário',
    description: 'Correção manual com motivo obrigatório (somente admin)',
  },
} as const;

const INPUT_CLS =
  'w-full rounded-btn border border-surface-border px-3 py-2.5 text-sm bg-white focus:border-brand-500 focus:outline-none';

export function ManualMovementForm({
  articles,
  locations,
}: {
  articles: Article[];
  locations: Location[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('restock');
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    articleId: '',
    locationId: '',
    quantity: '',
    newQuantity: '',
    reason: '',
    notes: '',
    unitCostCents: '',
  });

  const restock = api.movements.restock.useMutation();
  const adjust = api.movements.adjust.useMutation();

  const set =
    (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

  const handleTabChange = (t: Tab) => {
    setTab(t);
    setForm((p) => ({ ...p, locationId: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.articleId || !form.locationId) {
      toast.error('Selecione o artigo e a location');
      return;
    }
    setLoading(true);
    try {
      if (tab === 'restock') {
        await restock.mutateAsync({
          articleId: form.articleId,
          locationId: form.locationId,
          quantity: parseFloat(form.quantity),
          notes: form.notes || undefined,
          unitCostCents: form.unitCostCents
            ? Math.round(parseFloat(form.unitCostCents.replace(',', '.')) * 100)
            : undefined,
          idempotencyKey: uuidv4(),
        });
        toast.success('Entrada registrada com sucesso');
      } else {
        await adjust.mutateAsync({
          articleId: form.articleId,
          locationId: form.locationId,
          newQuantity: parseFloat(form.newQuantity),
          reason: form.reason,
          idempotencyKey: uuidv4(),
        });
        toast.success('Ajuste registrado com sucesso');
      }
      router.push('/movements');
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao registrar');
    } finally {
      setLoading(false);
    }
  };

  const filteredLocations =
    tab === 'restock' ? locations.filter((l) => l.type === 'warehouse') : locations;

  return (
    <div className="rounded-card border border-surface-border bg-white">
      {/* Tabs */}
      <div className="flex border-b border-surface-border">
        {(Object.keys(TAB_CONFIG) as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => handleTabChange(t)}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              tab === t
                ? 'border-b-2 border-brand-500 text-brand-500'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {TAB_CONFIG[t].label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 p-6">
        <p className="text-xs text-text-secondary">{TAB_CONFIG[tab].description}</p>

        {/* Artigo */}
        <div>
          <label htmlFor="articleId" className="mb-1.5 block text-sm font-medium text-text-primary">
            Artigo <span className="text-status-critical">*</span>
          </label>
          <select
            id="articleId"
            required
            value={form.articleId}
            onChange={set('articleId')}
            className={INPUT_CLS}
          >
            <option value="">Selecione um artigo</option>
            {articles.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.sku}) — {a.unit}
              </option>
            ))}
          </select>
        </div>

        {/* Location */}
        <div>
          <label
            htmlFor="locationId"
            className="mb-1.5 block text-sm font-medium text-text-primary"
          >
            Location <span className="text-status-critical">*</span>
          </label>
          <select
            id="locationId"
            required
            value={form.locationId}
            onChange={set('locationId')}
            className={INPUT_CLS}
          >
            <option value="">Selecione uma location</option>
            {filteredLocations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.code})
              </option>
            ))}
          </select>
          {tab === 'restock' && (
            <p className="mt-1 text-xs text-text-muted">Entrada permitida apenas no depósito.</p>
          )}
        </div>

        {/* Campos específicos por tab */}
        {tab === 'restock' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="quantity"
                  className="mb-1.5 block text-sm font-medium text-text-primary"
                >
                  Quantidade <span className="text-status-critical">*</span>
                </label>
                <input
                  id="quantity"
                  required
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={form.quantity}
                  onChange={set('quantity')}
                  placeholder="0.000"
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label
                  htmlFor="unitCostCents"
                  className="mb-1.5 block text-sm font-medium text-text-primary"
                >
                  Custo unitário (R$)
                </label>
                <input
                  id="unitCostCents"
                  type="text"
                  value={form.unitCostCents}
                  onChange={set('unitCostCents')}
                  placeholder="0,00"
                  className={INPUT_CLS}
                />
              </div>
            </div>
            <div>
              <label htmlFor="notes" className="mb-1.5 block text-sm font-medium text-text-primary">
                Observações
              </label>
              <input
                id="notes"
                type="text"
                value={form.notes}
                onChange={set('notes')}
                placeholder="Número da NF, fornecedor, etc."
                className={INPUT_CLS}
              />
            </div>
          </>
        )}

        {tab === 'adjust' && (
          <>
            <div>
              <label
                htmlFor="newQuantity"
                className="mb-1.5 block text-sm font-medium text-text-primary"
              >
                Nova quantidade absoluta <span className="text-status-critical">*</span>
              </label>
              <input
                id="newQuantity"
                required
                type="number"
                step="0.001"
                min="0"
                value={form.newQuantity}
                onChange={set('newQuantity')}
                placeholder="0.000"
                className={INPUT_CLS}
              />
              <p className="mt-1 text-xs text-text-muted">
                Informe o saldo real contado fisicamente. O sistema calcula a diferença.
              </p>
            </div>
            <div>
              <label
                htmlFor="reason"
                className="mb-1.5 block text-sm font-medium text-text-primary"
              >
                Motivo do ajuste <span className="text-status-critical">*</span>
              </label>
              <textarea
                id="reason"
                required
                minLength={5}
                value={form.reason}
                onChange={set('reason')}
                placeholder="Ex: Contagem física revelou divergência, item danificado..."
                rows={3}
                className="w-full resize-none rounded-btn border border-surface-border px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
          </>
        )}

        {/* Ações */}
        <div className="flex items-center justify-end gap-3 border-t border-surface-border pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-btn border border-surface-border px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-surface"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-btn bg-brand-500 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
          >
            {loading ? 'Registrando...' : 'Registrar'}
          </button>
        </div>
      </form>
    </div>
  );
}
