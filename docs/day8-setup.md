Passo 1 — Variáveis de ambiente
Adiciona ao .env:
envINTERFAST_API_KEY=2bddf557-9bfa-470e-9529-abfa7b31af9c
INTERFAST_API_URL=https://app.inter-fast.fr
INTERFAST_WEBHOOK_SECRET=gera-um-secret-aleatorio
Gera o webhook secret:
bashnode -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
Adiciona ao .env.example sem valores:
envINTERFAST_API_KEY=
INTERFAST_API_URL=
INTERFAST_WEBHOOK_SECRET=

Passo 2 — lib/interfast-client.ts
typescriptconst BASE_URL = process.env.INTERFAST_API_URL ?? 'https://app.inter-fast.fr';
const API_KEY  = process.env.INTERFAST_API_KEY ?? '';

const headers = {
  'X-API-KEY':    API_KEY,
  'Content-Type': 'application/json',
};

export interface InterfastEvent {
  id:             string;
  category:       string;
  reference:      string;
  title:          string;
  finished:       boolean;
  lifecycleState: string;
  end:            string;
  primaryTechnicianId: number | null;
  users: {
    id:          number;
    firstName:   string;
    lastName:    string;
  }[];
  client: {
    id:   number;
    name: string;
  } | null;
}

export interface InterfastArticle {
  name:         string;
  unit:         string;
  quantity:     number;
  price:        string;
  tva:          number;
  supplierCode: string;
  articleId:    string;
}

export interface InterfastIntervention {
  id:        number;
  reference: number;
  title:     string;
  endDate:   string | null;
  finishDate:string | null;
  primaryTechnicianId: number | null;
  users: {
    id:        number;
    firstName: string;
    lastName:  string;
  }[];
  client: {
    name: string;
  } | null;
  reports: {
    id:            number;
    primaryReport: boolean;
    reportData:    string; // JSON string
  }[];
}

export async function fetchRecentEvents(hoursBack = 2): Promise<InterfastEvent[]> {
  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
  const allEvents: InterfastEvent[] = [];

  let page = 1;
  const count = 50;

  while (true) {
    const res = await fetch(
      `${BASE_URL}/v1/events?page=${page}&count=${count}`,
      { headers },
    );

    if (!res.ok) throw new Error(`InterFast events error: ${res.status}`);

    const data = await res.json() as { items: InterfastEvent[]; count: number };

    const relevant = data.items.filter((e) => {
      if (e.category !== 'intervention') return false;
      if (!e.finished || e.lifecycleState !== 'completed') return false;
      const endDate = new Date(e.end);
      return endDate >= cutoff;
    });

    allEvents.push(...relevant);

    // Se o evento mais antigo desta página é mais velho que o cutoff, para
    const oldest = data.items[data.items.length - 1];
    if (!oldest || new Date(oldest.end) < cutoff) break;

    // Se chegámos ao fim
    if (page * count >= data.count) break;

    page++;
  }

  return allEvents;
}

export async function fetchIntervention(id: string): Promise<InterfastIntervention> {
  const res = await fetch(`${BASE_URL}/v1/intervention/${id}`, { headers });
  if (!res.ok) throw new Error(`InterFast intervention error: ${res.status}`);
  return res.json() as Promise<InterfastIntervention>;
}

export function extractArticles(intervention: InterfastIntervention): InterfastArticle[] {
  const primaryReport = intervention.reports.find((r) => r.primaryReport)
    ?? intervention.reports[0];

  if (!primaryReport?.reportData) return [];

  try {
    const data = JSON.parse(primaryReport.reportData) as {
      articles?: InterfastArticle[];
    };
    return data.articles ?? [];
  } catch {
    return [];
  }
}

export function extractTechnicianName(intervention: InterfastIntervention): string {
  const tech = intervention.users.find(
    (u) => u.id === intervention.primaryTechnicianId,
  ) ?? intervention.users[0];

  if (!tech) return '';
  return `${tech.firstName.trim()} ${tech.lastName.trim()}`.trim();
}

Passo 3 — Migration
db/migrations/0005_rapport_imports.sql
sqlCREATE TABLE IF NOT EXISTS "rapport_imports" (
  "id"                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "interfast_intervention_id" text NOT NULL UNIQUE,
  "interfast_reference"       text,
  "technicien_name"           text,
  "client_name"               text,
  "location_id"               uuid REFERENCES "locations"("id"),
  "intervention_date"         date,
  "status"                    text NOT NULL DEFAULT 'pending',
  "raw_articles"              jsonb NOT NULL DEFAULT '[]',
  "confirmed_by"              uuid REFERENCES "users"("id"),
  "confirmed_at"              timestamp with time zone,
  "created_at"                timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"                timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rapport_import_items" (
  "id"                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "rapport_id"           uuid NOT NULL REFERENCES "rapport_imports"("id") ON DELETE CASCADE,
  "description"          text NOT NULL,
  "interfast_article_id" text,
  "supplier_code"        text,
  "quantity"             numeric(14,3) NOT NULL,
  "unit"                 text NOT NULL,
  "price_cents"          integer,
  "article_id"           uuid REFERENCES "articles"("id"),
  "movement_id"          uuid REFERENCES "stock_movements"("id"),
  "status"               text NOT NULL DEFAULT 'unmatched',
  "created_at"           timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rapport_imports_status_idx"
  ON "rapport_imports"("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rapport_import_items_rapport_idx"
  ON "rapport_import_items"("rapport_id");
Registra no journal e roda:
bashpnpm db:migrate

Passo 4 — db/schema.ts
Adiciona ao db/schema.ts:
typescriptexport const rapportImports = pgTable('rapport_imports', {
  id:                      uuid('id').primaryKey().defaultRandom(),
  interfastInterventionId: text('interfast_intervention_id').notNull().unique(),
  interfastReference:      text('interfast_reference'),
  technicienName:          text('technicien_name'),
  clientName:              text('client_name'),
  locationId:              uuid('location_id').references(() => locations.id),
  interventionDate:        date('intervention_date'),
  status:                  text('status').notNull().default('pending'),
  rawArticles:             jsonb('raw_articles').notNull().default([]),
  confirmedBy:             uuid('confirmed_by').references(() => users.id),
  confirmedAt:             timestamp('confirmed_at', { withTimezone: true }),
  createdAt:               timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:               timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const rapportImportItems = pgTable('rapport_import_items', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  rapportId:           uuid('rapport_id').notNull()
                         .references(() => rapportImports.id, { onDelete: 'cascade' }),
  description:         text('description').notNull(),
  interfastArticleId:  text('interfast_article_id'),
  supplierCode:        text('supplier_code'),
  quantity:            numeric('quantity', { precision: 14, scale: 3 }).notNull(),
  unit:                text('unit').notNull(),
  priceCents:          integer('price_cents'),
  articleId:           uuid('article_id').references(() => articles.id),
  movementId:          uuid('movement_id').references(() => stockMovements.id),
  status:              text('status').notNull().default('unmatched'),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
Adiciona relações em db/relations.ts:
typescriptexport const rapportImportsRelations = relations(rapportImports, ({ one, many }) => ({
  confirmedByUser: one(users, {
    fields:     [rapportImports.confirmedBy],
    references: [users.id],
  }),
  location: one(locations, {
    fields:     [rapportImports.locationId],
    references: [locations.id],
  }),
  items: many(rapportImportItems),
}));

export const rapportImportItemsRelations = relations(rapportImportItems, ({ one }) => ({
  rapport:  one(rapportImports, {
    fields:     [rapportImportItems.rapportId],
    references: [rapportImports.id],
  }),
  article:  one(articles, {
    fields:     [rapportImportItems.articleId],
    references: [articles.id],
  }),
}));

Passo 5 — lib/rapport-processor.ts
typescriptimport { db }                    from '@/db/client';
import { rapportImports, rapportImportItems, articles, locations, users } from '@/db/schema';
import {
  fetchRecentEvents,
  fetchIntervention,
  extractArticles,
  extractTechnicianName,
  type InterfastArticle,
} from './interfast-client';
import { eq, and, ilike }        from 'drizzle-orm';

interface ProcessResult {
  processed: number;
  skipped:   number;
  errors:    string[];
}

export async function processRecentInterventions(
  hoursBack = 2,
): Promise<ProcessResult> {
  const result: ProcessResult = { processed: 0, skipped: 0, errors: [] };

  const events = await fetchRecentEvents(hoursBack);

  for (const event of events) {
    try {
      // Verifica se já foi processado
      const existing = await db.query.rapportImports.findFirst({
        where: (r, { eq: eqFn }) =>
          eqFn(r.interfastInterventionId, String(event.id)),
      });

      if (existing) {
        result.skipped++;
        continue;
      }

      // Busca detalhes completos da intervenção
      const intervention = await fetchIntervention(String(event.id));
      const rawArticles  = extractArticles(intervention);

      // Ignora intervenções sem artigos
      if (rawArticles.length === 0) {
        result.skipped++;
        continue;
      }

      const techName = extractTechnicianName(intervention);

      // Tenta encontrar o caminhão do técnico pelo nome
      let locationId: string | null = null;
      if (techName) {
        const techUser = await db.query.users.findFirst({
          where: (u, { ilike: ilikeFn }) =>
            ilikeFn(u.name, `%${techName.split(' ')[0]}%`),
          columns: { id: true },
        });

        if (techUser) {
          const truck = await db.query.locations.findFirst({
            where: (l, { eq: eqFn, and: andFn }) =>
              andFn(
                eqFn(l.assignedUserId, techUser.id),
                eqFn(l.type, 'truck'),
              ),
            columns: { id: true },
          });
          locationId = truck?.id ?? null;
        }
      }

      // Cria o rapport import
      const [rapportImport] = await db
        .insert(rapportImports)
        .values({
          interfastInterventionId: String(event.id),
          interfastReference:      event.reference,
          technicienName:          techName || null,
          clientName:              event.client?.name ?? null,
          locationId:              locationId ?? undefined,
          interventionDate:        intervention.finishDate
            ? new Date(intervention.finishDate).toISOString().split('T')[0]
            : null,
          status:     'pending',
          rawArticles: rawArticles as unknown as Record<string, unknown>[],
        })
        .returning();

      if (!rapportImport) continue;

      // Processa cada artigo
      for (const article of rawArticles) {
        const matchedArticle = await matchArticle(article);

        const priceCents = article.price
          ? Math.round(parseFloat(article.price.replace(',', '.')) * 100)
          : null;

        await db.insert(rapportImportItems).values({
          rapportId:          rapportImport.id,
          description:        article.name,
          interfastArticleId: article.articleId || null,
          supplierCode:       article.supplierCode || null,
          quantity:           String(article.quantity),
          unit:               article.unit,
          priceCents:         priceCents ?? undefined,
          articleId:          matchedArticle?.id ?? undefined,
          status:             matchedArticle ? 'matched' : 'unmatched',
        });
      }

      result.processed++;
    } catch (err) {
      result.errors.push(
        `Intervention ${event.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return result;
}

async function matchArticle(
  article: InterfastArticle,
): Promise<{ id: string } | null> {
  // 1. Tenta match por supplierCode → SKU ou barcode
  if (article.supplierCode) {
    const match = await db.query.articles.findFirst({
      where: (a, { or: orFn, eq: eqFn }) =>
        orFn(
          eqFn(a.sku,     article.supplierCode),
          eqFn(a.barcode, article.supplierCode),
        ),
      columns: { id: true },
    });
    if (match) return match;
  }

  // 2. Tenta match por nome normalizado
  const normalized = article.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

  if (normalized.length < 3) return null;

  const allArticles = await db.query.articles.findMany({
    where: (a, { eq: eqFn }) => eqFn(a.active, true),
    columns: { id: true, name: true },
  });

  for (const a of allArticles) {
    const aName = a.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');

    if (aName.includes(normalized) || normalized.includes(aName)) {
      return { id: a.id };
    }
  }

  return null;
}

Passo 6 — API route /api/webhooks/interfast
app/api/webhooks/interfast/route.ts
typescriptimport { NextResponse }               from 'next/server';
import { timingSafeEqual }            from 'node:crypto';
import { processRecentInterventions } from '@/lib/rapport-processor';

function verifyToken(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const auth = req.headers.get('x-webhook-secret');
  if (
    !verifyToken(
      auth ?? '',
      process.env.INTERFAST_WEBHOOK_SECRET ?? '',
    )
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await processRecentInterventions(2);

    return NextResponse.json({
      ok:        true,
      processed: result.processed,
      skipped:   result.skipped,
      errors:    result.errors,
    });
  } catch (err) {
    console.error('[interfast-webhook]', err);
    return NextResponse.json(
      { error: 'Processing failed' },
      { status: 500 },
    );
  }
}

Passo 7 — Router tRPC rapports
server/routers/rapports.ts
typescriptimport { z }             from 'zod';
import { eq, desc }      from 'drizzle-orm';
import { TRPCError }     from '@trpc/server';
import { router }        from '@/server/trpc';
import { adminProcedure, managerProcedure } from '@/server/procedures';
import { rapportImports, rapportImportItems } from '@/db/schema';
import { StockMovementService }              from '@/server/services/stock-movement.service';
import { v4 as uuidv4 }  from 'uuid';

export const rapportsRouter = router({

  list: managerProcedure
    .input(z.object({
      status: z.enum(['pending', 'confirmed', 'rejected', 'partial'])
               .optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.db.query.rapportImports.findMany({
        where: input?.status
          ? (r, { eq: eqFn }) => eqFn(r.status, input.status!)
          : undefined,
        with: {
          items: {
            with: {
              article: {
                columns: { id: true, name: true, sku: true, unit: true },
              },
            },
          },
          location: { columns: { id: true, name: true, code: true } },
        },
        orderBy: (r, { desc: descFn }) => descFn(r.createdAt),
        limit: 50,
      });
    }),

  // Admin mapeia item sem match para um artigo do catálogo
  mapItem: adminProcedure
    .input(z.object({
      itemId:    z.string().uuid(),
      articleId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(rapportImportItems)
        .set({ articleId: input.articleId, status: 'matched' })
        .where(eq(rapportImportItems.id, input.itemId));
      return { success: true };
    }),

  // Admin ignora um item (ex: "Petit matériel")
  ignoreItem: adminProcedure
    .input(z.object({ itemId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(rapportImportItems)
        .set({ status: 'ignored' })
        .where(eq(rapportImportItems.id, input.itemId));
      return { success: true };
    }),

  // Admin define o caminhão manualmente (se auto-detect falhou)
  setLocation: adminProcedure
    .input(z.object({
      rapportId:  z.string().uuid(),
      locationId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(rapportImports)
        .set({ locationId: input.locationId, updatedAt: new Date() })
        .where(eq(rapportImports.id, input.rapportId));
      return { success: true };
    }),

  // Admin confirma o rapport — regista consumos no estoque
  confirm: adminProcedure
    .input(z.object({ rapportId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const rapport = await ctx.db.query.rapportImports.findFirst({
        where:  (r, { eq: eqFn }) => eqFn(r.id, input.rapportId),
        with:   { items: true },
      });

      if (!rapport) throw new TRPCError({ code: 'NOT_FOUND' });
      if (rapport.status !== 'pending') {
        throw new TRPCError({
          code:    'BAD_REQUEST',
          message: 'Rapport já processado',
        });
      }
      if (!rapport.locationId) {
        throw new TRPCError({
          code:    'BAD_REQUEST',
          message: 'Seleciona o caminhão antes de confirmar',
        });
      }

      const service = new StockMovementService(ctx.db);
      let confirmed = 0;

      for (const item of rapport.items) {
        if (item.status === 'ignored' || !item.articleId) continue;

        // Busca saldo atual para calcular nova quantidade
        const [level] = await ctx.db
          .select({ quantity: ctx.db.$with('sl').select().from })
          .from(ctx.db.query.stockLevels.findFirst as never);

        // Cria adjustment negativo (consumo)
        try {
          const movement = await service.createAdjustment({
            articleId:      item.articleId,
            locationId:     rapport.locationId,
            newQuantity:    Math.max(
              0,
              parseFloat('0') - parseFloat(item.quantity),
            ),
            reason:         `Consumo rapport ${rapport.interfastReference ?? rapport.interfastInterventionId}`,
            createdBy:      ctx.user.id,
            idempotencyKey: uuidv4(),
          });

          await ctx.db
            .update(rapportImportItems)
            .set({ movementId: movement.id, status: 'confirmed' })
            .where(eq(rapportImportItems.id, item.id));

          confirmed++;
        } catch {
          // Continua mesmo se um item falhar
        }
      }

      await ctx.db
        .update(rapportImports)
        .set({
          status:      confirmed > 0 ? 'confirmed' : 'partial',
          confirmedBy: ctx.user.id,
          confirmedAt: new Date(),
          updatedAt:   new Date(),
        })
        .where(eq(rapportImports.id, input.rapportId));

      return { confirmed };
    }),

  // Rejeita o rapport
  reject: adminProcedure
    .input(z.object({ rapportId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(rapportImports)
        .set({
          status:      'rejected',
          confirmedBy: ctx.user.id,
          confirmedAt: new Date(),
          updatedAt:   new Date(),
        })
        .where(eq(rapportImports.id, input.rapportId));
      return { success: true };
    }),

  // Trigger manual (para testar)
  processNow: adminProcedure
    .mutation(async () => {
      const { processRecentInterventions } = await import(
        '@/lib/rapport-processor'
      );
      return processRecentInterventions(48); // últimas 48h para testes
    }),
});
Atualiza server/routers/_app.ts:
typescriptimport { rapportsRouter } from './rapports';

export const appRouter = router({
  // ... existentes
  rapports: rapportsRouter,
});

Passo 8 — Tela admin /rapports
app/(admin)/rapports/page.tsx
typescriptimport { AdminTopbar }        from '@/components/admin/layout/topbar';
import { RapportsList }       from '@/components/admin/rapports/rapports-list';
import { createServerClient } from '@/lib/trpc/server';

export default async function RapportsPage() {
  const api      = await createServerClient();
  const [rapports, trucks] = await Promise.all([
    api.rapports.list({ status: 'pending' }),
    api.locations.list({ type: 'truck', active: true }),
  ]);

  return (
    <>
      <AdminTopbar
        title="Rapports InterFast"
        subtitle="Consumos pendentes de confirmação"
      />
      <main className="flex-1 overflow-auto p-5">
        <RapportsList initialData={rapports} trucks={trucks} />
      </main>
    </>
  );
}
components/admin/rapports/rapports-list.tsx
typescript'use client';

import { useState }      from 'react';
import { api }           from '@/lib/trpc/client';
import { toast }         from 'sonner';
import {
  IconCheck, IconX, IconAlertTriangle,
  IconRefresh, IconTruck,
} from '@tabler/icons-react';

type Item = {
  id:          string;
  description: string;
  supplierCode:string | null;
  quantity:    string;
  unit:        string;
  status:      string;
  article:     { id: string; name: string; sku: string; unit: string } | null;
};

type Rapport = {
  id:                     string;
  interfastReference:     string | null;
  interfastInterventionId:string;
  technicienName:         string | null;
  clientName:             string | null;
  interventionDate:       string | null;
  status:                 string;
  locationId:             string | null;
  location:               { id: string; name: string; code: string } | null;
  items:                  Item[];
};

type Truck = { id: string; name: string; code: string };

const STATUS_COLOR = {
  matched:   'text-status-ok',
  unmatched: 'text-status-critical',
  ignored:   'text-text-muted',
  confirmed: 'text-status-ok',
} as const;

const STATUS_LABEL = {
  matched:   'Reconhecido',
  unmatched: 'Sem match',
  ignored:   'Ignorado',
  confirmed: 'Confirmado',
} as const;

export function RapportsList({
  initialData,
  trucks,
}: {
  initialData: Rapport[];
  trucks:      Truck[];
}) {
  const [rapports,    setRapports]    = useState(initialData);
  const [processing,  setProcessing]  = useState(false);

  const confirm      = api.rapports.confirm.useMutation();
  const reject       = api.rapports.reject.useMutation();
  const ignoreItem   = api.rapports.ignoreItem.useMutation();
  const setLocation  = api.rapports.setLocation.useMutation();
  const processNow   = api.rapports.processNow.useMutation();

  const handleProcessNow = async () => {
    setProcessing(true);
    try {
      const result = await processNow.mutateAsync();
      toast.success(
        `${result.processed} rapport(s) importado(s)`,
      );
      // Recarrega a página para mostrar novos rapports
      window.location.reload();
    } catch {
      toast.error('Erro ao processar');
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirm = async (rapportId: string, locationId: string | null) => {
    if (!locationId) {
      toast.error('Seleciona o caminhão antes de confirmar');
      return;
    }
    try {
      const result = await confirm.mutateAsync({ rapportId });
      toast.success(`${result.confirmed} consumo(s) registado(s)`);
      setRapports((prev) => prev.filter((r) => r.id !== rapportId));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao confirmar');
    }
  };

  const handleReject = async (rapportId: string) => {
    try {
      await reject.mutateAsync({ rapportId });
      toast.success('Rapport rejeitado');
      setRapports((prev) => prev.filter((r) => r.id !== rapportId));
    } catch {
      toast.error('Erro ao rejeitar');
    }
  };

  const handleIgnoreItem = async (itemId: string, rapportId: string) => {
    try {
      await ignoreItem.mutateAsync({ itemId });
      setRapports((prev) =>
        prev.map((r) =>
          r.id === rapportId
            ? {
                ...r,
                items: r.items.map((i) =>
                  i.id === itemId ? { ...i, status: 'ignored' } : i,
                ),
              }
            : r,
        ),
      );
    } catch {
      toast.error('Erro ao ignorar item');
    }
  };

  const handleSetLocation = async (rapportId: string, locationId: string) => {
    try {
      await setLocation.mutateAsync({ rapportId, locationId });
      setRapports((prev) =>
        prev.map((r) =>
          r.id === rapportId
            ? {
                ...r,
                locationId,
                location: trucks.find((t) => t.id === locationId) ?? null,
              }
            : r,
        ),
      );
    } catch {
      toast.error('Erro ao definir caminhão');
    }
  };

  return (
    <div className="space-y-4">
      {/* Botão processar agora */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          {rapports.length} rapport(s) pendente(s)
        </p>
        <button
          onClick={handleProcessNow}
          disabled={processing}
          className="flex items-center gap-1.5 rounded-btn border border-surface-border bg-white px-3 py-2 text-sm text-text-secondary hover:bg-surface transition-colors disabled:opacity-50"
        >
          <IconRefresh size={14} className={processing ? 'animate-spin' : ''} />
          {processing ? 'Processando...' : 'Verificar InterFast agora'}
        </button>
      </div>

      {rapports.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-text-muted">
          <IconCheck size={32} className="mb-3 text-status-ok" />
          <p className="text-sm font-medium">Nenhum rapport pendente</p>
          <p className="text-xs">Todos os consumos foram processados</p>
        </div>
      )}

      {rapports.map((rapport) => {
        const unmatchedCount = rapport.items.filter(
          (i) => i.status === 'unmatched',
        ).length;

        return (
          <div
            key={rapport.id}
            className="rounded-card border border-surface-border bg-white overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-surface-border bg-surface px-4 py-3 gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-text-primary">
                    {rapport.interfastReference ?? rapport.interfastInterventionId}
                  </span>
                  {unmatchedCount > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                      <IconAlertTriangle size={11} />
                      {unmatchedCount} sem match
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-text-secondary truncate">
                  {rapport.clientName && `${rapport.clientName} · `}
                  {rapport.technicienName && `${rapport.technicienName} · `}
                  {rapport.interventionDate}
                </p>

                {/* Seletor de caminhão */}
                <div className="mt-2 flex items-center gap-2">
                  <IconTruck size={13} className="text-text-muted flex-shrink-0" />
                  <select
                    value={rapport.locationId ?? ''}
                    onChange={(e) => handleSetLocation(rapport.id, e.target.value)}
                    className="rounded-btn border border-surface-border bg-white px-2 py-1 text-xs focus:border-brand-500 focus:outline-none"
                  >
                    <option value="">Seleciona o caminhão</option>
                    {trucks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => handleReject(rapport.id)}
                  className="flex items-center gap-1 rounded-btn border border-surface-border px-3 py-1.5 text-xs text-status-critical hover:bg-red-50 transition-colors"
                >
                  <IconX size={12} />
                  Rejeitar
                </button>
                <button
                  onClick={() => handleConfirm(rapport.id, rapport.locationId)}
                  disabled={!rapport.locationId}
                  className="flex items-center gap-1 rounded-btn bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 transition-colors disabled:opacity-40"
                >
                  <IconCheck size={12} />
                  Confirmar
                </button>
              </div>
            </div>

            {/* Items */}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border">
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-muted">Artigo</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-muted">Qtd</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-muted">Match</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-muted">Estado</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {rapport.items.map((item) => (
                  <tr
                    key={item.id}
                    className={item.status === 'ignored' ? 'opacity-40' : ''}
                  >
                    <td className="px-4 py-2.5">
                      <p className="text-text-primary">{item.description}</p>
                      {item.supplierCode && (
                        <p className="text-xs text-text-muted font-mono">
                          {item.supplierCode}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-text-secondary">
                      {parseFloat(item.quantity).toFixed(3)} {item.unit}
                    </td>
                    <td className="px-4 py-2.5">
                      {item.article
                        ? <span className="text-xs text-status-ok">{item.article.name}</span>
                        : <span className="text-xs text-status-critical">Não encontrado</span>
                      }
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs ${STATUS_COLOR[item.status as keyof typeof STATUS_COLOR] ?? 'text-text-muted'}`}>
                        {STATUS_LABEL[item.status as keyof typeof STATUS_LABEL] ?? item.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {item.status === 'unmatched' && (
                        <button
                          onClick={() => handleIgnoreItem(item.id, rapport.id)}
                          className="text-xs text-text-muted hover:text-text-secondary transition-colors"
                        >
                          Ignorar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

Passo 9 — Sidebar + configurar InterFast
Adiciona ao sidebar components/admin/layout/sidebar.tsx:
typescript{ href: '/rapports', label: 'Rapports', icon: IconFileText },
Configurar webhook no InterFast:
Na automatização "Envoie des rapport d'intervention" (ou cria uma nova):

Gatilho: "L'intervention est terminée"
Adiciona uma etapa Webhook:

URL: https://seudominio.com/api/webhooks/interfast
En-têtes HTTP → Adiciona:

Nom: x-webhook-secret
Valeur: SEU_INTERFAST_WEBHOOK_SECRET






Passo 10 — Sanity check
bashpnpm typecheck
pnpm check
pnpm test
pnpm dev
Teste manual:
bashcurl -X POST http://localhost:3000/api/webhooks/interfast \
  -H "x-webhook-secret: SEU_SECRET"
Deve retornar:
json{ "ok": true, "processed": N, "skipped": N, "errors": [] }
Depois acede a /rapports e verifica se apareceram rapports pendentes.
Checklist:

 Migration 0005 aplicada
 rapportImports e rapportImportItems no schema
 lib/interfast-client.ts existe
 lib/rapport-processor.ts existe
 /api/webhooks/interfast existe
 server/routers/rapports.ts existe com 6 endpoints
 app/(admin)/rapports/page.tsx existe
 Sidebar tem link "Rapports"
 Webhook configurado no InterFast
 pnpm typecheck limpo
 pnpm check limpo
 pnpm test passando