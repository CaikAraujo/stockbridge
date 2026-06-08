Passo 1 — Migration
db/migrations/0006_gas_bottles.sql
sqlCREATE TABLE IF NOT EXISTS "gas_bottles" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"                text NOT NULL,
  "reference"           text NOT NULL UNIQUE,
  "gas_type_code"       text NOT NULL,
  "initial_weight_kg"   numeric(8,3) NOT NULL,
  "current_weight_kg"   numeric(8,3) NOT NULL,
  "status"              text NOT NULL DEFAULT 'available',
  "location_id"         uuid REFERENCES "locations"("id"),
  "article_id"          uuid REFERENCES "articles"("id"),
  "created_by"          uuid REFERENCES "users"("id"),
  "created_at"          timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"          timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "type"        text NOT NULL,
  "title"       text NOT NULL,
  "message"     text NOT NULL,
  "data"        jsonb NOT NULL DEFAULT '{}',
  "status"      text NOT NULL DEFAULT 'unread',
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "resolved_at" timestamp with time zone,
  "resolved_by" uuid REFERENCES "users"("id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gas_bottles_status_idx"
  ON "gas_bottles"("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gas_bottles_location_idx"
  ON "gas_bottles"("location_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_status_idx"
  ON "notifications"("status");
Regista no journal e roda:
bashpnpm db:migrate

Passo 2 — Schema + Relations
Adiciona em db/schema.ts:
typescriptexport const gasBotles = pgTable('gas_bottles', {
  id:               uuid('id').primaryKey().defaultRandom(),
  name:             text('name').notNull(),
  reference:        text('reference').notNull().unique(),
  gasTypeCode:      text('gas_type_code').notNull(),
  initialWeightKg:  numeric('initial_weight_kg', { precision: 8, scale: 3 }).notNull(),
  currentWeightKg:  numeric('current_weight_kg', { precision: 8, scale: 3 }).notNull(),
  status:           text('status').notNull().default('available'),
  locationId:       uuid('location_id').references(() => locations.id),
  articleId:        uuid('article_id').references(() => articles.id),
  createdBy:        uuid('created_by').references(() => users.id),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = pgTable('notifications', {
  id:          uuid('id').primaryKey().defaultRandom(),
  type:        text('type').notNull(),
  title:       text('title').notNull(),
  message:     text('message').notNull(),
  data:        jsonb('data').notNull().default({}),
  status:      text('status').notNull().default('unread'),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt:  timestamp('resolved_at', { withTimezone: true }),
  resolvedBy:  uuid('resolved_by').references(() => users.id),
});
Adiciona em db/relations.ts:
typescriptexport const gasBottlesRelations = relations(gasBotles, ({ one }) => ({
  location: one(locations, {
    fields:     [gasBotles.locationId],
    references: [locations.id],
  }),
  article: one(articles, {
    fields:     [gasBotles.articleId],
    references: [articles.id],
  }),
  createdByUser: one(users, {
    fields:     [gasBotles.createdBy],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  resolvedByUser: one(users, {
    fields:     [notifications.resolvedBy],
    references: [users.id],
  }),
}));

Passo 3 — Router gas_bottles
server/routers/gas-bottles.ts
typescriptimport { z }            from 'zod';
import { eq, and }      from 'drizzle-orm';
import { TRPCError }    from '@trpc/server';
import { router }       from '@/server/trpc';
import { adminProcedure, managerProcedure } from '@/server/procedures';
import { gasBotles, articles, stockLevels, notifications } from '@/db/schema';
import { v4 as uuidv4 } from 'uuid';

// Normaliza código de gás para matching
// "Gaz R32" → "R32", "R-404A" → "R404A"
export function normalizeGasCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/GAZ\s*/i, '')
    .replace(/[^A-Z0-9]/g, '');
}

export const gasBottlesRouter = router({

  list: managerProcedure.query(async ({ ctx }) => {
    return ctx.db.query.gasBotles.findMany({
      with: {
        location: { columns: { id: true, name: true, code: true, type: true } },
      },
      orderBy: (b, { asc }) => asc(b.name),
    });
  }),

  create: adminProcedure
    .input(z.object({
      name:             z.string().min(1).max(100),
      reference:        z.string().min(1).max(50),
      gasTypeCode:      z.string().min(1).max(20),
      initialWeightKg:  z.number().positive(),
      locationId:       z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verifica referência única
      const existing = await ctx.db.query.gasBotles.findFirst({
        where: (b, { eq: eqFn }) => eqFn(b.reference, input.reference),
        columns: { id: true },
      });
      if (existing) {
        throw new TRPCError({
          code:    'CONFLICT',
          message: `Referência "${input.reference}" já existe`,
        });
      }

      // Cria artigo automaticamente para o QR
      const sku = `GAZ-${input.reference.toUpperCase().replace(/[^A-Z0-9]/g, '-')}`;
      const [article] = await ctx.db
        .insert(articles)
        .values({
          sku,
          name:         `${input.name} (REF: ${input.reference})`,
          unit:         'un',
          active:       true,
          minStock:     '0',
          reorderPoint: '0',
          createdBy:    ctx.user.id,
        })
        .returning({ id: articles.id });

      if (!article) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      // Cria a garrafa
      const [bottle] = await ctx.db
        .insert(gasBotles)
        .values({
          name:            input.name,
          reference:       input.reference,
          gasTypeCode:     normalizeGasCode(input.gasTypeCode),
          initialWeightKg: String(input.initialWeightKg),
          currentWeightKg: String(input.initialWeightKg),
          status:          'available',
          locationId:      input.locationId ?? null,
          articleId:       article.id,
          createdBy:       ctx.user.id,
        })
        .returning();

      if (!bottle) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      // Adiciona stock inicial (1 unidade) na location se fornecida
      if (input.locationId) {
        await ctx.db
          .insert(stockLevels)
          .values({
            articleId:  article.id,
            locationId: input.locationId,
            quantity:   '1',
          })
          .onConflictDoNothing();
      }

      return bottle;
    }),

  // Recarga a garrafa (peso volta ao inicial)
  recharge: adminProcedure
    .input(z.object({
      bottleId:       z.string().uuid(),
      newWeightKg:    z.number().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [bottle] = await ctx.db
        .update(gasBotles)
        .set({
          currentWeightKg: String(input.newWeightKg),
          status:          'available',
          updatedAt:       new Date(),
        })
        .where(eq(gasBotles.id, input.bottleId))
        .returning({ id: gasBotles.id });

      if (!bottle) throw new TRPCError({ code: 'NOT_FOUND' });

      // Resolve notificação de garrafa vazia se existir
      await ctx.db
        .update(notifications)
        .set({
          status:     'resolved',
          resolvedAt: new Date(),
          resolvedBy: ctx.user.id,
        })
        .where(
          and(
            eq(notifications.type,   'gas_bottle_empty'),
            eq(notifications.status, 'unread'),
          ),
        );

      return bottle;
    }),

  delete: adminProcedure
    .input(z.object({ bottleId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const bottle = await ctx.db.query.gasBotles.findFirst({
        where: (b, { eq: eqFn }) => eqFn(b.id, input.bottleId),
        columns: { id: true, articleId: true },
      });
      if (!bottle) throw new TRPCError({ code: 'NOT_FOUND' });

      await ctx.db.delete(gasBotles).where(eq(gasBotles.id, input.bottleId));

      // Remove artigo associado
      if (bottle.articleId) {
        await ctx.db
          .update(articles)
          .set({ active: false })
          .where(eq(articles.id, bottle.articleId));
      }

      return { success: true };
    }),
});

Passo 4 — Router notifications
server/routers/notifications.ts
typescriptimport { z }            from 'zod';
import { eq, desc }     from 'drizzle-orm';
import { router }       from '@/server/trpc';
import { adminProcedure, managerProcedure } from '@/server/procedures';
import { notifications } from '@/db/schema';

export const notificationsRouter = router({

  list: managerProcedure
    .input(z.object({
      status: z.enum(['unread', 'resolved']).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.db.query.notifications.findMany({
        where: input?.status
          ? (n, { eq: eqFn }) => eqFn(n.status, input.status!)
          : undefined,
        orderBy: (n, { desc: descFn }) => descFn(n.createdAt),
        limit: 50,
      });
    }),

  unreadCount: managerProcedure.query(async ({ ctx }) => {
    const result = await ctx.db.query.notifications.findMany({
      where: (n, { eq: eqFn }) => eqFn(n.status, 'unread'),
      columns: { id: true },
    });
    return { count: result.length };
  }),

  resolve: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(notifications)
        .set({
          status:     'resolved',
          resolvedAt: new Date(),
          resolvedBy: ctx.user.id,
        })
        .where(eq(notifications.id, input.id));
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(notifications)
        .where(eq(notifications.id, input.id));
      return { success: true };
    }),
});
Atualiza _app.ts:
typescriptimport { gasBottlesRouter }    from './gas-bottles';
import { notificationsRouter } from './notifications';

export const appRouter = router({
  // ... existentes
  gasBottles:    gasBottlesRouter,
  notifications: notificationsRouter,
});

Passo 5 — Integrar rapport_processor com garrafas
Adiciona em lib/rapport-processor.ts:
typescriptimport { gasBotles, notifications } from '@/db/schema';
import { normalizeGasCode }         from '@/server/routers/gas-bottles';

// Adiciona esta função no final do ficheiro:
async function deductGasFromBottle(
  description: string,
  quantityKg:  number,
  locationId:  string | null,
): Promise<boolean> {
  if (!locationId) return false;

  const gasCode = normalizeGasCode(description);
  if (gasCode.length < 2) return false;

  // Encontra garrafa do tipo certo no caminhão do técnico
  const bottle = await db.query.gasBotles.findFirst({
    where: (b, { eq: eqFn, and: andFn }) =>
      andFn(
        eqFn(b.locationId, locationId),
        eqFn(b.gasTypeCode, gasCode),
        eqFn(b.status, 'in_use'),
      ),
    columns: {
      id: true, reference: true, name: true,
      currentWeightKg: true,
    },
  });

  // Tenta também com status 'available' (garrafa no caminhão mas não marcada in_use)
  const bottleFinal = bottle ?? await db.query.gasBotles.findFirst({
    where: (b, { eq: eqFn, and: andFn }) =>
      andFn(
        eqFn(b.locationId, locationId),
        eqFn(b.gasTypeCode, gasCode),
      ),
    columns: {
      id: true, reference: true, name: true,
      currentWeightKg: true,
    },
  });

  if (!bottleFinal) return false;

  const current    = parseFloat(bottleFinal.currentWeightKg);
  const newWeight  = Math.max(0, current - quantityKg);
  const isEmpty    = newWeight <= 0;

  await db
    .update(gasBotles)
    .set({
      currentWeightKg: String(newWeight),
      status:          isEmpty ? 'empty' : 'in_use',
      updatedAt:       new Date(),
    })
    .where(eq(gasBotles.id, bottleFinal.id));

  // Notificação ao admin se ficou vazia
  if (isEmpty) {
    await db.insert(notifications).values({
      type:    'gas_bottle_empty',
      title:   'Garrafa de gás vazia',
      message: `A garrafa ${bottleFinal.name} (REF: ${bottleFinal.reference}) ficou vazia.`,
      data:    {
        bottleId:  bottleFinal.id,
        reference: bottleFinal.reference,
        gasType:   bottleFinal.name,
        locationId,
      },
      status: 'unread',
    });
  }

  return true;
}
No loop de items do processRecentInterventions, após criar o item, adiciona:
typescript// Tenta deduzir de garrafa de gás se o artigo for gás
if (isGasDescription(article.name) && article.unit === 'kg') {
  await deductGasFromBottle(
    article.name,
    article.quantity,
    locationId,
  );
}
Adiciona a função isGasDescription:
typescriptfunction isGasDescription(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes('gaz') || n.includes('gas') || n.includes('r-') ||
    /r\d{2,3}[a-z]?/i.test(n);
}

Passo 6 — Tela admin /gas-bottles
app/(admin)/gas-bottles/page.tsx
typescriptimport { AdminTopbar }        from '@/components/admin/layout/topbar';
import { GasBottlesList }     from '@/components/admin/gas-bottles/gas-bottles-list';
import { createServerClient } from '@/lib/trpc/server';

export default async function GasBottlesPage() {
  const api     = await createServerClient();
  const [bottles, locations] = await Promise.all([
    api.gasBottles.list(),
    api.locations.list({ active: true }),
  ]);

  return (
    <>
      <AdminTopbar
        title="Garrafas de gás"
        subtitle="Gestão e rastreio de garrafas"
      />
      <main className="flex-1 overflow-auto p-5">
        <GasBottlesList initialData={bottles} locations={locations} />
      </main>
    </>
  );
}
components/admin/gas-bottles/gas-bottles-list.tsx
typescript'use client';

import { useState }   from 'react';
import { api }        from '@/lib/trpc/client';
import { toast }      from 'sonner';
import { generateQRLabelsPDF } from '@/lib/qr-pdf';
import {
  IconPlus, IconQrcode, IconRefresh,
  IconDroplet, IconAlertTriangle,
} from '@tabler/icons-react';

type Bottle = {
  id: string; name: string; reference: string;
  gasTypeCode: string; initialWeightKg: string;
  currentWeightKg: string; status: string;
  articleId: string | null;
  location: { id: string; name: string; code: string; type: string } | null;
};

type Location = { id: string; name: string; code: string; type: string };

const STATUS_COLOR = {
  available: 'bg-green-50 text-green-700',
  in_use:    'bg-blue-50 text-blue-700',
  empty:     'bg-red-50 text-red-700',
} as const;

const STATUS_LABEL = {
  available: 'Disponível',
  in_use:    'Em uso',
  empty:     'Vazia',
} as const;

export function GasBottlesList({
  initialData,
  locations,
}: {
  initialData: Bottle[];
  locations:   Location[];
}) {
  const [bottles,    setBottles]    = useState(initialData);
  const [showForm,   setShowForm]   = useState(false);
  const [rechargeId, setRechargeId] = useState<string | null>(null);
  const [newWeight,  setNewWeight]  = useState('');
  const [form, setForm] = useState({
    name: '', reference: '', gasTypeCode: '',
    initialWeightKg: '', locationId: '',
  });

  const create    = api.gasBottles.create.useMutation();
  const recharge  = api.gasBottles.recharge.useMutation();
  const deleteFn  = api.gasBottles.delete.useMutation();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const bottle = await create.mutateAsync({
        ...form,
        initialWeightKg: parseFloat(form.initialWeightKg),
        locationId: form.locationId || undefined,
      });
      toast.success('Garrafa cadastrada com sucesso');
      setShowForm(false);
      setBottles((prev) => [...prev, bottle as unknown as Bottle]);
      setForm({ name: '', reference: '', gasTypeCode: '', initialWeightKg: '', locationId: '' });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cadastrar');
    }
  };

  const handleRecharge = async (bottleId: string) => {
    const kg = parseFloat(newWeight);
    if (Number.isNaN(kg) || kg <= 0) {
      toast.error('Peso inválido');
      return;
    }
    try {
      await recharge.mutateAsync({ bottleId, newWeightKg: kg });
      toast.success('Garrafa recarregada');
      setBottles((prev) =>
        prev.map((b) =>
          b.id === bottleId
            ? { ...b, currentWeightKg: String(kg), status: 'available' }
            : b,
        ),
      );
      setRechargeId(null);
      setNewWeight('');
    } catch {
      toast.error('Erro ao recarregar');
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
      await deleteFn.mutateAsync({ bottleId });
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
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 rounded-btn bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
        >
          <IconPlus size={15} />
          Nova garrafa
        </button>
      </div>

      {/* Formulário de criação */}
      {showForm && (
        <div className="rounded-card border border-surface-border bg-white p-5">
          <h3 className="mb-4 text-sm font-medium text-text-primary">Nova garrafa</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Nome do gás *
              </label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="R-404A"
                className="w-full rounded-btn border border-surface-border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Referência (nº da garrafa) *
              </label>
              <input
                required
                value={form.reference}
                onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))}
                placeholder="001"
                className="w-full rounded-btn border border-surface-border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Código do gás (para matching) *
              </label>
              <input
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
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Peso de gás (kg, sem tara) *
              </label>
              <input
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
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                Location inicial
              </label>
              <select
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

      {/* Lista de garrafas */}
      <div className="rounded-card border border-surface-border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface">
              {['Garrafa', 'Referência', 'Gás restante', 'Location', 'Estado', ''].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-text-muted uppercase tracking-wide">
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
                  <td className="px-4 py-3 font-mono text-xs text-text-secondary">
                    {b.reference}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 rounded-full bg-surface-border overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pct > 50 ? 'bg-status-ok' :
                            pct > 20 ? 'bg-amber-400' : 'bg-status-critical'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-text-secondary">
                        {parseFloat(b.currentWeightKg).toFixed(1)} / {parseFloat(b.initialWeightKg).toFixed(1)} kg
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary text-xs">
                    {b.location?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_COLOR[b.status as keyof typeof STATUS_COLOR] ?? 'bg-surface text-text-muted'
                    }`}>
                      {STATUS_LABEL[b.status as keyof typeof STATUS_LABEL] ?? b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handlePrintQR(b)}
                        title="Imprimir QR"
                        className="rounded p-1 text-text-muted hover:bg-surface hover:text-text-primary transition-colors"
                      >
                        <IconQrcode size={14} />
                      </button>
                      <button
                        onClick={() => { setRechargeId(b.id); setNewWeight(b.initialWeightKg); }}
                        title="Recarregar"
                        className="rounded p-1 text-text-muted hover:bg-surface hover:text-brand-500 transition-colors"
                      >
                        <IconRefresh size={14} />
                      </button>
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

      {/* Modal de recarga */}
      {rechargeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-80 rounded-card border border-surface-border bg-white p-6 shadow-xl">
            <h3 className="mb-1 text-sm font-medium text-text-primary">Recarregar garrafa</h3>
            <p className="mb-4 text-xs text-text-secondary">
              Peso de gás após recarga (sem tara)
            </p>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
              placeholder="13.5"
              className="mb-4 w-full rounded-btn border border-surface-border px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setRechargeId(null)}
                className="flex-1 rounded-btn border border-surface-border py-2 text-sm text-text-secondary hover:bg-surface"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleRecharge(rechargeId)}
                disabled={recharge.isPending}
                className="flex-1 rounded-btn bg-brand-500 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

Passo 7 — Tela admin /notifications
app/(admin)/notifications/page.tsx
typescriptimport { AdminTopbar }           from '@/components/admin/layout/topbar';
import { NotificationsList }     from '@/components/admin/notifications/notifications-list';
import { createServerClient }    from '@/lib/trpc/server';

export default async function NotificationsPage() {
  const api   = await createServerClient();
  const notifs = await api.notifications.list({ status: 'unread' });

  return (
    <>
      <AdminTopbar
        title="Notificações"
        subtitle="Alertas do sistema"
      />
      <main className="flex-1 overflow-auto p-5">
        <NotificationsList initialData={notifs} />
      </main>
    </>
  );
}
components/admin/notifications/notifications-list.tsx
typescript'use client';

import { useState }  from 'react';
import { api }       from '@/lib/trpc/client';
import { toast }     from 'sonner';
import { format }    from 'date-fns';
import {
  IconBell, IconCheck, IconTrash,
  IconDroplet,
} from '@tabler/icons-react';

type Notification = {
  id: string; type: string; title: string;
  message: string; status: string; createdAt: Date;
  data: Record<string, unknown>;
};

const TYPE_ICON = {
  gas_bottle_empty: IconDroplet,
} as const;

export function NotificationsList({
  initialData,
}: {
  initialData: Notification[];
}) {
  const [notifs, setNotifs] = useState(initialData);

  const resolve = api.notifications.resolve.useMutation();
  const remove  = api.notifications.delete.useMutation();

  const handleResolve = async (id: string) => {
    try {
      await resolve.mutateAsync({ id });
      setNotifs((prev) =>
        prev.map((n) => n.id === id ? { ...n, status: 'resolved' } : n),
      );
      toast.success('Marcado como resolvido');
    } catch {
      toast.error('Erro');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await remove.mutateAsync({ id });
      setNotifs((prev) => prev.filter((n) => n.id !== id));
      toast.success('Notificação eliminada');
    } catch {
      toast.error('Erro');
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
        const Icon = TYPE_ICON[n.type as keyof typeof TYPE_ICON] ?? IconBell;
        const isUnread = n.status === 'unread';

        return (
          <div
            key={n.id}
            className={`rounded-card border bg-white p-4 flex items-start gap-4 ${
              isUnread ? 'border-amber-200 bg-amber-50/30' : 'border-surface-border'
            }`}
          >
            <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${
              isUnread ? 'bg-amber-100' : 'bg-surface'
            }`}>
              <Icon size={18} className={isUnread ? 'text-amber-600' : 'text-text-muted'} />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary">{n.title}</p>
              <p className="text-xs text-text-secondary mt-0.5">{n.message}</p>
              <p className="text-xs text-text-muted mt-1">
                {format(new Date(n.createdAt), 'dd/MM/yyyy HH:mm')}
              </p>
            </div>

            <div className="flex gap-1 flex-shrink-0">
              {isUnread && (
                <button
                  onClick={() => handleResolve(n.id)}
                  title="Marcar como resolvido"
                  className="flex h-8 w-8 items-center justify-center rounded-btn border border-surface-border text-text-muted hover:bg-surface hover:text-status-ok transition-colors"
                >
                  <IconCheck size={14} />
                </button>
              )}
              <button
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

Passo 8 — Sidebar
Adiciona em components/admin/layout/sidebar.tsx:
typescriptimport { IconBell, IconDroplet } from '@tabler/icons-react';

// No NAV_GROUPS, adiciona:
{ href: '/gas-bottles',   label: 'Garrafas de gás', icon: IconDroplet },
{ href: '/notifications', label: 'Notificações',     icon: IconBell },

Passo 9 — Sanity check
bashpnpm typecheck
pnpm check
pnpm test
pnpm dev
Checklist:

 Migration 0006 aplicada
 gas_bottles e notifications no schema
 server/routers/gas-bottles.ts existe
 server/routers/notifications.ts existe
 gasBottles e notifications no _app.ts
 app/(admin)/gas-bottles/page.tsx existe
 app/(admin)/notifications/page.tsx existe
 Sidebar tem "Garrafas de gás" e "Notificações"
 rapport_processor deduz gás automaticamente
 pnpm typecheck limpo
 pnpm check limpo
 pnpm test passando