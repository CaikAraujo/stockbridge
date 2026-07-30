'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { api } from '@/lib/trpc/client';

const UNITS = [
  { value: 'un', label: 'Unidade (un)' },
  { value: 'pc', label: 'Peça (pc)' },
  { value: 'cx', label: 'Caixa (cx)' },
  { value: 'kg', label: 'Quilograma (kg)' },
  { value: 'g', label: 'Grama (g)' },
  { value: 'l', label: 'Litro (l)' },
  { value: 'ml', label: 'Mililitro (ml)' },
  { value: 'm', label: 'Metro (m)' },
  { value: 'cm', label: 'Centímetro (cm)' },
  { value: 'rl', label: 'Rolo (rl)' },
  { value: 'par', label: 'Par' },
] as const;

type UnitValue = (typeof UNITS)[number]['value'];

type ArticleFormProps = {
  mode: 'create' | 'edit';
  articleId?: string;
  initial?: {
    sku: string;
    name: string;
    description?: string | null;
    unit: string;
    barcode?: string | null;
    costPriceCents?: number | null;
    salePriceCents?: number | null;
    minStock: string;
    reorderPoint: string;
    refrigerantType?: string | null;
    supplierId?: string | null;
  };
};

function centsToReais(cents: number | null | undefined): string {
  if (!cents) return '';
  return (cents / 100).toFixed(2).replace('.', ',');
}

function reaisToCents(value: string): number | undefined {
  const n = parseFloat(value.replace(',', '.'));
  return Number.isNaN(n) ? undefined : Math.round(n * 100);
}

export function ArticleForm({ mode, articleId, initial }: ArticleFormProps) {
  const router = useRouter();
  const create = api.articles.create.useMutation();
  const update = api.articles.update.useMutation();

  const { data: suppliersData } = api.suppliers.listActive.useQuery();
  const activeSuppliers = suppliersData ?? [];

  const [form, setForm] = useState({
    sku: initial?.sku ?? '',
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    unit: initial?.unit ?? 'un',
    barcode: initial?.barcode ?? '',
    costPrice: centsToReais(initial?.costPriceCents),
    salePrice: centsToReais(initial?.salePriceCents),
    minStock: initial?.minStock ?? '0',
    reorderPoint: initial?.reorderPoint ?? '0',
    refrigerantType: initial?.refrigerantType ?? '',
    supplierId: initial?.supplierId ?? '',
  });

  const [loading, setLoading] = useState(false);

  const set =
    (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        sku: form.sku,
        name: form.name,
        description: form.description || undefined,
        unit: form.unit as UnitValue,
        barcode: form.barcode || undefined,
        costPriceCents: reaisToCents(form.costPrice),
        salePriceCents: reaisToCents(form.salePrice),
        minStock: form.minStock || '0',
        reorderPoint: form.reorderPoint || '0',
        refrigerantType: form.refrigerantType || undefined,
        supplierId: form.supplierId || undefined,
        idempotencyKey: uuidv4(),
      };

      if (mode === 'create') {
        await create.mutateAsync(payload);
        toast.success('Artigo criado com sucesso');
      } else {
        if (!articleId) {
          toast.error('ID do artigo não encontrado');
          return;
        }
        await update.mutateAsync({ id: articleId, ...payload });
        toast.success('Artigo atualizado com sucesso');
      }
      router.push('/estoque?tab=artigos');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar artigo';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const field = (id: string, label: string, children: React.ReactNode, required = false) => (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-text-primary">
        {label}
        {required && <span className="text-status-critical"> *</span>}
      </label>
      {children}
    </div>
  );

  const input = (name: keyof typeof form, placeholder = '', type = 'text') => (
    <input
      id={name}
      type={type}
      value={form[name]}
      onChange={set(name)}
      placeholder={placeholder}
      className="w-full rounded-btn border border-surface-border px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-500 focus:outline-none"
    />
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        {field('sku', 'SKU', input('sku', 'SKU-0001'), true)}
        {field('barcode', 'Código de barras', input('barcode', 'EAN, QR, etc.'))}
      </div>

      {field('name', 'Nome do artigo', input('name', 'Ex: Gás R-410A'), true)}

      {field(
        'description',
        'Descrição',
        <textarea
          id="description"
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          placeholder="Descrição opcional"
          rows={2}
          className="w-full resize-none rounded-btn border border-surface-border px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-500 focus:outline-none"
        />,
      )}

      <div className="grid grid-cols-2 gap-4">
        {field(
          'unit',
          'Unidade de medida',
          <select
            id="unit"
            value={form.unit}
            onChange={set('unit')}
            className="w-full rounded-btn border border-surface-border bg-white px-3 py-2.5 text-sm text-text-primary focus:border-brand-500 focus:outline-none"
          >
            {UNITS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>,
          true,
        )}
        {field('refrigerantType', 'Tipo de gás', input('refrigerantType', 'R-410A, R-32...'))}
      </div>

      {field(
        'supplierId',
        'Fournisseur',
        <select
          id="supplierId"
          value={form.supplierId}
          onChange={set('supplierId')}
          className="w-full rounded-btn border border-surface-border bg-white px-3 py-2.5 text-sm text-text-primary focus:border-brand-500 focus:outline-none"
        >
          <option value="">Aucun fournisseur</option>
          {activeSuppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>,
      )}

      <div className="grid grid-cols-2 gap-4">
        {field('costPrice', 'Preço de custo (R$)', input('costPrice', '0,00'))}
        {field('salePrice', 'Preço de venda (R$)', input('salePrice', '0,00'))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {field('minStock', 'Estoque mínimo', input('minStock', '0'), true)}
        {field('reorderPoint', 'Ponto de reposição', input('reorderPoint', '0'), true)}
      </div>

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
          {loading ? 'Salvando...' : mode === 'create' ? 'Criar artigo' : 'Salvar alterações'}
        </button>
      </div>
    </form>
  );
}
