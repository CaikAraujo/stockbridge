Passo 1 — Variáveis de ambiente
Adiciona ao .env:
envJOBS_SECRET=gere-um-secret-aleatorio-aqui
Gera o secret:
bashnode -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
Adiciona ao .env.example (sem valor):
envJOBS_SECRET=
Por que não ALERT_EMAIL: vamos buscar os emails dos admins direto do banco — sem variável extra, sem manutenção manual.

Passo 2 — Template de email HTML
lib/email/stock-alert-template.ts
typescriptinterface LowStockItem {
  articleName: string;
  articleSku:  string;
  unit:        string;
  quantity:    string;
  reorderPoint:string;
  locationName:string;
}

export function stockAlertEmailHtml(items: LowStockItem[]): string {
  const rows = items
    .map(
      (item) => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 10px 12px; font-size: 13px; color: #111827; font-weight: 500;">
        ${item.articleName}
        <div style="font-size: 11px; color: #6b7280; font-family: monospace;">${item.articleSku}</div>
      </td>
      <td style="padding: 10px 12px; font-size: 13px; color: #6b7280;">${item.locationName}</td>
      <td style="padding: 10px 12px; font-size: 13px; color: #d97706; font-weight: 500;">
        ${parseFloat(item.quantity).toFixed(3)} ${item.unit}
      </td>
      <td style="padding: 10px 12px; font-size: 13px; color: #6b7280;">
        mín. ${parseFloat(item.reorderPoint).toFixed(3)} ${item.unit}
      </td>
    </tr>`,
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="pt">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background: #f0f3f7; font-family: -apple-system, sans-serif;">
  <div style="max-width: 600px; margin: 40px auto; background: #fff; border-radius: 10px; overflow: hidden; border: 1px solid #e5e7eb;">
    
    <!-- Header -->
    <div style="background: #064875; padding: 24px 32px;">
      <div style="font-size: 20px; font-weight: 600; color: #fff;">StockBridge</div>
      <div style="font-size: 13px; color: rgba(255,255,255,0.75); margin-top: 4px;">
        Alerta de estoque baixo
      </div>
    </div>

    <!-- Body -->
    <div style="padding: 24px 32px;">
      <p style="font-size: 14px; color: #374151; margin: 0 0 8px;">
        <strong>${items.length} ${items.length === 1 ? 'item está' : 'itens estão'} abaixo do ponto de reposição.</strong>
      </p>
      <p style="font-size: 13px; color: #6b7280; margin: 0 0 20px;">
        Verifique o estoque e faça a reposição necessária.
      </p>

      <!-- Tabela -->
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background: #f9fafb;">
            <th style="padding: 10px 12px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Artigo</th>
            <th style="padding: 10px 12px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Location</th>
            <th style="padding: 10px 12px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Atual</th>
            <th style="padding: 10px 12px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Mínimo</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <!-- Footer -->
    <div style="padding: 16px 32px; border-top: 1px solid #e5e7eb; background: #f9fafb;">
      <p style="font-size: 12px; color: #9ca3af; margin: 0;">
        StockBridge · Enviado automaticamente · ${new Date().toLocaleString('pt-BR')}
      </p>
    </div>
  </div>
</body>
</html>`;
}

Passo 3 — API route do job de alerta
app/api/jobs/stock-alert/route.ts
typescriptimport { NextResponse }             from 'next/server';
import { Resend }                   from 'resend';
import { and, eq, sql }             from 'drizzle-orm';
import { db }                       from '@/db/client';
import { stockLevels, articles, locations, users } from '@/db/schema';
import { stockAlertEmailHtml }      from '@/lib/email/stock-alert-template';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  // Autenticação por token secreto
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.JOBS_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Busca itens abaixo do ponto de reposição
  const lowItems = await db
    .select({
      articleName:  articles.name,
      articleSku:   articles.sku,
      unit:         articles.unit,
      quantity:     stockLevels.quantity,
      reorderPoint: articles.reorderPoint,
      locationName: locations.name,
    })
    .from(stockLevels)
    .innerJoin(articles,  eq(stockLevels.articleId,  articles.id))
    .innerJoin(locations, eq(stockLevels.locationId, locations.id))
    .where(
      and(
        sql`CAST(${stockLevels.quantity} AS numeric) <= CAST(${articles.reorderPoint} AS numeric)`,
        eq(articles.active, true),
        eq(locations.active, true),
      ),
    )
    .orderBy(locations.name, articles.name);

  if (lowItems.length === 0) {
    return NextResponse.json({ sent: false, reason: 'Nenhum item abaixo do mínimo' });
  }

  // Busca emails dos admins ativos
  const admins = await db.query.users.findMany({
    where: (u, { eq: eqFn, and: andFn }) =>
      andFn(eqFn(u.role, 'admin'), eqFn(u.active, true)),
    columns: { email: true },
  });

  const adminEmails = admins
    .map((a) => a.email)
    .filter((e): e is string => !!e);

  if (adminEmails.length === 0) {
    return NextResponse.json({ sent: false, reason: 'Nenhum admin com email cadastrado' });
  }

  // Envia email
  await resend.emails.send({
    from:    process.env.AUTH_EMAIL_FROM ?? 'noreply@stockbridge.local',
    to:      adminEmails,
    subject: `StockBridge — ${lowItems.length} item(ns) abaixo do estoque mínimo`,
    html:    stockAlertEmailHtml(lowItems),
  });

  return NextResponse.json({
    sent:      true,
    itemCount: lowItems.length,
    sentTo:    adminEmails.length,
  });
}
Como testar manualmente:
bashcurl -X POST http://localhost:3000/api/jobs/stock-alert \
  -H "Authorization: Bearer SEU_JOBS_SECRET"
Como configurar no VPS (Dia 7): adiciona ao crontab:
bash# Roda todo dia às 8h da manhã
0 8 * * * curl -s -X POST https://seudominio.com/api/jobs/stock-alert -H "Authorization: Bearer SEU_SECRET"

Passo 4 — Novos schemas
Adiciona em lib/schemas/movements.ts:
typescriptexport const restockSchema = z.object({
  articleId:      z.string().uuid(),
  locationId:     z.string().uuid(),
  quantity:       z.number().positive(),
  notes:          z.string().max(300).optional(),
  unitCostCents:  z.number().int().nonnegative().optional(),
}).merge(idempotencySchema);

export const adjustSchema = z.object({
  articleId:   z.string().uuid(),
  locationId:  z.string().uuid(),
  newQuantity: z.number().min(0),
  reason:      z.string().min(5, 'Motivo obrigatório (mín. 5 caracteres)').max(300),
  photoUrl:    z.string().url().optional(),
}).merge(idempotencySchema);

Passo 5 — Estender movements router
Adiciona em server/routers/movements.ts:
typescript// Entrada de mercadoria (admin/manager)
restock: managerProcedure
  .input(restockSchema)
  .mutation(async ({ ctx, input }) => {
    const { idempotencyKey: _k, ...data } = input;
    const quantityStr = data.quantity.toFixed(3);

    const [movement] = await ctx.db
      .insert(stockMovements)
      .values({
        articleId:      data.articleId,
        locationId:     data.locationId,
        quantityDelta:  quantityStr,
        movementType:   'restock',
        unitCostCents:  data.unitCostCents,
        notes:          data.notes,
        createdBy:      ctx.user.id,
        idempotencyKey: input.idempotencyKey,
      })
      .returning();

    if (!movement) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
    return movement;
  }),

// Ajuste manual (admin)
adjust: adminProcedure
  .input(adjustSchema)
  .mutation(async ({ ctx, input }) => {
    const { idempotencyKey: _k, ...data } = input;

    // Busca saldo atual
    const [level] = await ctx.db
      .select({ quantity: stockLevels.quantity })
      .from(stockLevels)
      .where(
        and(
          eq(stockLevels.articleId,  data.articleId),
          eq(stockLevels.locationId, data.locationId),
        ),
      );

    const current   = parseFloat(level?.quantity ?? '0');
    const delta     = data.newQuantity - current;

    if (Math.abs(delta) < 0.001) {
      throw new TRPCError({
        code:    'BAD_REQUEST',
        message: 'Quantidade nova é igual à atual. Nenhum ajuste necessário.',
      });
    }

    const deltaStr = delta.toFixed(3);

    const [movement] = await ctx.db
      .insert(stockMovements)
      .values({
        articleId:      data.articleId,
        locationId:     data.locationId,
        quantityDelta:  deltaStr,
        movementType:   'adjustment',
        reason:         data.reason,
        photoUrl:       data.photoUrl,
        createdBy:      ctx.user.id,
        idempotencyKey: input.idempotencyKey,
      })
      .returning();

    if (!movement) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
    return movement;
  }),
Adiciona imports que faltam no topo do arquivo:
typescriptimport { restockSchema, adjustSchema } from '@/lib/schemas/movements';
import { stockLevels } from '@/db/schema';

Passo 6 — Tela de nova movimentação manual
app/(admin)/movements/new/page.tsx
typescriptimport { AdminTopbar }        from '@/components/admin/layout/topbar';
import { ManualMovementForm } from '@/components/admin/movements/manual-movement-form';
import { createServerClient } from '@/lib/trpc/server';

export default async function NewMovementPage() {
  const api       = await createServerClient();
  const [articles, locations] = await Promise.all([
    api.articles.list({ page: 1, limit: 200, active: true }),
    api.locations.list({ active: true }),
  ]);

  return (
    <>
      <AdminTopbar title="Nova movimentação" subtitle="Entrada, ajuste ou transferência manual" />
      <main className="flex-1 overflow-auto p-5">
        <div className="mx-auto max-w-2xl">
          <ManualMovementForm
            articles={articles.items}
            locations={locations}
          />
        </div>
      </main>
    </>
  );
}
components/admin/movements/manual-movement-form.tsx
typescript'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/trpc/client';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

type Article  = { id: string; name: string; sku: string; unit: string; };
type Location = { id: string; name: string; code: string; type: string; };
type Tab      = 'restock' | 'adjust';

const TAB_CONFIG = {
  restock: { label: 'Entrada de mercadoria', description: 'Nova mercadoria recebida do fornecedor' },
  adjust:  { label: 'Ajuste de inventário',  description: 'Correção manual com motivo obrigatório' },
} as const;

export function ManualMovementForm({
  articles,
  locations,
}: {
  articles:  Article[];
  locations: Location[];
}) {
  const router    = useRouter();
  const [tab,     setTab]     = useState<Tab>('restock');
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    articleId:    '',
    locationId:   '',
    quantity:     '',
    newQuantity:  '',
    reason:       '',
    notes:        '',
    unitCostCents:'',
  });

  const restock = api.movements.restock.useMutation();
  const adjust  = api.movements.adjust.useMutation();

  const set = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));

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
          articleId:     form.articleId,
          locationId:    form.locationId,
          quantity:      parseFloat(form.quantity),
          notes:         form.notes || undefined,
          unitCostCents: form.unitCostCents
            ? Math.round(parseFloat(form.unitCostCents.replace(',', '.')) * 100)
            : undefined,
          idempotencyKey: uuidv4(),
        });
        toast.success('Entrada registrada com sucesso');
      } else {
        await adjust.mutateAsync({
          articleId:   form.articleId,
          locationId:  form.locationId,
          newQuantity: parseFloat(form.newQuantity),
          reason:      form.reason,
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

  // Location filtrada por tab
  const filteredLocations = tab === 'restock'
    ? locations.filter((l) => l.type === 'warehouse')
    : locations;

  return (
    <div className="rounded-card border border-surface-border bg-white">
      {/* Tabs */}
      <div className="flex border-b border-surface-border">
        {(Object.keys(TAB_CONFIG) as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
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

      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <p className="text-xs text-text-secondary">{TAB_CONFIG[tab].description}</p>

        {/* Artigo */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-text-primary">
            Artigo <span className="text-status-critical">*</span>
          </label>
          <select
            required
            value={form.articleId}
            onChange={set('articleId')}
            className="w-full rounded-btn border border-surface-border px-3 py-2.5 text-sm bg-white focus:border-brand-500 focus:outline-none"
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
          <label className="mb-1.5 block text-sm font-medium text-text-primary">
            Location <span className="text-status-critical">*</span>
          </label>
          <select
            required
            value={form.locationId}
            onChange={set('locationId')}
            className="w-full rounded-btn border border-surface-border px-3 py-2.5 text-sm bg-white focus:border-brand-500 focus:outline-none"
          >
            <option value="">Selecione uma location</option>
            {filteredLocations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.code})
              </option>
            ))}
          </select>
        </div>

        {/* Campos por tab */}
        {tab === 'restock' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-primary">
                  Quantidade <span className="text-status-critical">*</span>
                </label>
                <input
                  required
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={form.quantity}
                  onChange={set('quantity')}
                  placeholder="0.000"
                  className="w-full rounded-btn border border-surface-border px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text-primary">
                  Custo unitário (R$)
                </label>
                <input
                  type="text"
                  value={form.unitCostCents}
                  onChange={set('unitCostCents')}
                  placeholder="0,00"
                  className="w-full rounded-btn border border-surface-border px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">
                Observações
              </label>
              <input
                type="text"
                value={form.notes}
                onChange={set('notes')}
                placeholder="Número da NF, fornecedor, etc."
                className="w-full rounded-btn border border-surface-border px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
          </>
        )}

        {tab === 'adjust' && (
          <>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">
                Nova quantidade absoluta <span className="text-status-critical">*</span>
              </label>
              <input
                required
                type="number"
                step="0.001"
                min="0"
                value={form.newQuantity}
                onChange={set('newQuantity')}
                placeholder="0.000"
                className="w-full rounded-btn border border-surface-border px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
              />
              <p className="mt-1 text-xs text-text-muted">
                Informe o saldo real contado fisicamente. O sistema calcula a diferença.
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-text-primary">
                Motivo do ajuste <span className="text-status-critical">*</span>
              </label>
              <textarea
                required
                minLength={5}
                value={form.reason}
                onChange={set('reason')}
                placeholder="Ex: Contagem física revelou divergência, item danificado..."
                rows={3}
                className="w-full rounded-btn border border-surface-border px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none resize-none"
              />
            </div>
          </>
        )}

        {/* Botões */}
        <div className="flex items-center justify-end gap-3 border-t border-surface-border pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-btn border border-surface-border px-4 py-2 text-sm text-text-secondary hover:bg-surface transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-btn bg-brand-500 px-5 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors disabled:opacity-50"
          >
            {loading ? 'Registrando...' : 'Registrar'}
          </button>
        </div>
      </form>
    </div>
  );
}

Passo 7 — lib/csv-export.ts
typescript'use client';

export interface CsvColumn<T> {
  key:       keyof T | ((row: T) => string | number | null | undefined);
  label:     string;
}

export function exportToCSV<T extends Record<string, unknown>>(
  data:     T[],
  filename: string,
  columns:  CsvColumn<T>[],
): void {
  const escape = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };

  const headers = columns.map((c) => c.label).join(',');
  const rows    = data.map((row) =>
    columns
      .map((c) => {
        const val = typeof c.key === 'function' ? c.key(row) : row[c.key];
        return escape(val);
      })
      .join(','),
  );

  const csv  = '\ufeff' + [headers, ...rows].join('\n'); // BOM para Excel
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

Passo 8 — Exportar nas telas existentes
Adiciona botão de exportar em components/admin/movements/movements-table.tsx:
typescript// Adiciona import no topo
import { exportToCSV } from '@/lib/csv-export';
import { IconDownload, IconPlus } from '@tabler/icons-react';
import Link from 'next/link';

// Adiciona função de export dentro do componente
const handleExport = () => {
  exportToCSV(filtered, 'movimentacoes', [
    { key: 'createdAt',    label: 'Data/hora',
      key: (r) => new Date(r.createdAt).toLocaleString('pt-BR') },
    { key: 'movementType', label: 'Tipo' },
    { key: 'articleName',  label: 'Artigo' },
    { key: 'articleSku',   label: 'SKU' },
    { key: 'quantityDelta',label: 'Quantidade' },
    { key: 'articleUnit',  label: 'Unidade' },
    { key: 'locationName', label: 'Location' },
    { key: 'createdByName',label: 'Operador' },
  ]);
};

// Adiciona botões no header da tabela:
<div className="flex items-center gap-3">
  {/* filtros existentes */}
  <button
    onClick={handleExport}
    className="flex items-center gap-1.5 rounded-btn border border-surface-border bg-white px-3 py-2 text-sm text-text-secondary hover:bg-surface transition-colors"
  >
    <IconDownload size={14} />
    Exportar CSV
  </button>
  <Link
    href="/movements/new"
    className="flex items-center gap-1.5 rounded-btn bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
  >
    <IconPlus size={14} />
    Nova movimentação
  </Link>
</div>
Nota: O exportToCSV tem um erro de tipagem no exemplo acima — a coluna createdAt usa tanto key como função. Corrige assim:
typescriptexportToCSV(filtered, 'movimentacoes', [
  { key: (r) => new Date(r.createdAt as Date).toLocaleString('pt-BR'), label: 'Data/hora' },
  { key: (r) => r.movementType as string, label: 'Tipo' },
  { key: (r) => r.articleName as string,  label: 'Artigo' },
  { key: (r) => r.articleSku as string,   label: 'SKU' },
  { key: (r) => r.quantityDelta as string,label: 'Quantidade' },
  { key: (r) => r.articleUnit as string,  label: 'Unidade' },
  { key: (r) => r.locationName as string, label: 'Location' },
  { key: (r) => r.createdByName as string,label: 'Operador' },
]);

Passo 9 — Sanity check
bashpnpm typecheck
pnpm check
pnpm test
pnpm dev
Verifica no browser:

/movements/new → formulário com tabs ✅
Tab "Entrada" → só mostra depósito nas locations ✅
Tab "Ajuste" → pede motivo obrigatório ✅
Botão "Exportar CSV" nas movimentações → baixa arquivo ✅