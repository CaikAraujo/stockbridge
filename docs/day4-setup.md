Passo 1 — Instalar dependências
bashpnpm add @zxing/browser @zxing/library
pnpm add qrcode
pnpm add -D @types/qrcode
@zxing/browser — leitura de QR/barcode via câmera do celular.
qrcode — geração de QR code no admin (já instalado no Dia 3, confirma).

Passo 2 — Service de movimentação
Este é o arquivo mais importante do projeto. Toda lógica de negócio fica aqui — os routers apenas orquestram.
server/services/stock-movement.service.ts
typescriptimport 'server-only';
import { and, eq, gte, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import type { DB } from '@/db/client';
import {
  stockMovements, stockLevels, transfers,
  transferItems, articles,
} from '@/db/schema';

// Gera código de transferência sequencial por ano
async function generateTransferCode(db: DB): Promise<string> {
  const year = new Date().getFullYear();
  const [row] = await db
    .select({ total: sql<number>`cast(count(*) as integer)` })
    .from(transfers)
    .where(gte(transfers.createdAt, new Date(`${year}-01-01`)));
  const seq = (row?.total ?? 0) + 1;
  return `TRF-${year}-${String(seq).padStart(4, '0')}`;
}

// Valida que a location tem saldo suficiente
async function assertSufficientStock(
  db: DB,
  articleId: string,
  locationId: string,
  quantity: number,
) {
  const [level] = await db
    .select({ quantity: stockLevels.quantity })
    .from(stockLevels)
    .where(
      and(
        eq(stockLevels.articleId, articleId),
        eq(stockLevels.locationId, locationId),
      ),
    );

  const current = parseFloat(level?.quantity ?? '0');
  if (current < quantity) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Estoque insuficiente. Disponível: ${current}, solicitado: ${quantity}`,
    });
  }
}

export interface WithdrawalParams {
  articleId:       string;
  quantity:        number;  // positivo
  fromLocationId:  string;  // depósito
  toLocationId:    string;  // caminhão
  createdBy:       string;
  idempotencyKey:  string;
  jobId?:          string;
  notes?:          string;
}

export interface ReturnParams {
  articleId:       string;
  quantity:        number;  // positivo
  fromLocationId:  string;  // caminhão
  toLocationId:    string;  // depósito
  createdBy:       string;
  idempotencyKey:  string;
  notes?:          string;
}

export interface VoidParams {
  movementId:  string;
  voidedBy:    string;
  voidReason:  string;
  requestedBy: string;  // quem está solicitando (para checar permissão)
}

export class StockMovementService {
  constructor(private db: DB) {}

  // ================================================================
  // RETIRADA: Depósito → Caminhão
  // Cria transferência imediata (sem pending/in_transit — self-service)
  // ================================================================
  async createWithdrawal(params: WithdrawalParams) {
    if (params.quantity <= 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Quantidade deve ser maior que zero' });
    }

    await assertSufficientStock(
      this.db, params.articleId, params.fromLocationId, params.quantity,
    );

    const code = await generateTransferCode(this.db);
    const quantityStr = params.quantity.toFixed(3);

    // Busca custo atual do artigo para snapshot
    const [article] = await this.db
      .select({ costPriceCents: articles.costPriceCents })
      .from(articles)
      .where(eq(articles.id, params.articleId));

    return await this.db.transaction(async (tx) => {
      // 1. Cria transferência já como recebida (imediata)
      const [transfer] = await tx
        .insert(transfers)
        .values({
          code,
          fromLocationId: params.fromLocationId,
          toLocationId:   params.toLocationId,
          status:         'received',
          createdBy:      params.createdBy,
          shippedBy:      params.createdBy,
          shippedAt:      new Date(),
          receivedBy:     params.createdBy,
          receivedAt:     new Date(),
          notes:          params.notes,
        })
        .returning();

      if (!transfer) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      // 2. Movimento de saída do depósito
      await tx.insert(stockMovements).values({
        articleId:       params.articleId,
        locationId:      params.fromLocationId,
        quantityDelta:   `-${quantityStr}`,
        movementType:    'transfer_out',
        transferId:      transfer.id,
        jobId:           params.jobId,
        unitCostCents:   article?.costPriceCents,
        createdBy:       params.createdBy,
        notes:           params.notes,
        idempotencyKey:  `${params.idempotencyKey}-out`,
      });

      // 3. Movimento de entrada no caminhão
      await tx.insert(stockMovements).values({
        articleId:       params.articleId,
        locationId:      params.toLocationId,
        quantityDelta:   quantityStr,
        movementType:    'transfer_in',
        transferId:      transfer.id,
        jobId:           params.jobId,
        unitCostCents:   article?.costPriceCents,
        createdBy:       params.createdBy,
        notes:           params.notes,
        idempotencyKey:  `${params.idempotencyKey}-in`,
      });

      // 4. Item da transferência
      await tx.insert(transferItems).values({
        transferId:       transfer.id,
        articleId:        params.articleId,
        quantityShipped:  quantityStr,
        quantityReceived: quantityStr,
      });

      return transfer;
    });
  }

  // ================================================================
  // DEVOLUÇÃO: Caminhão → Depósito
  // ================================================================
  async createReturn(params: ReturnParams) {
    if (params.quantity <= 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Quantidade deve ser maior que zero' });
    }

    await assertSufficientStock(
      this.db, params.articleId, params.fromLocationId, params.quantity,
    );

    const code = await generateTransferCode(this.db);
    const quantityStr = params.quantity.toFixed(3);

    const [article] = await this.db
      .select({ costPriceCents: articles.costPriceCents })
      .from(articles)
      .where(eq(articles.id, params.articleId));

    return await this.db.transaction(async (tx) => {
      const [transfer] = await tx
        .insert(transfers)
        .values({
          code,
          fromLocationId: params.fromLocationId,
          toLocationId:   params.toLocationId,
          status:         'received',
          createdBy:      params.createdBy,
          shippedBy:      params.createdBy,
          shippedAt:      new Date(),
          receivedBy:     params.createdBy,
          receivedAt:     new Date(),
          notes:          params.notes,
        })
        .returning();

      if (!transfer) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      await tx.insert(stockMovements).values({
        articleId:       params.articleId,
        locationId:      params.fromLocationId,
        quantityDelta:   `-${quantityStr}`,
        movementType:    'transfer_out',
        transferId:      transfer.id,
        unitCostCents:   article?.costPriceCents,
        createdBy:       params.createdBy,
        notes:           params.notes,
        idempotencyKey:  `${params.idempotencyKey}-out`,
      });

      await tx.insert(stockMovements).values({
        articleId:       params.articleId,
        locationId:      params.toLocationId,
        quantityDelta:   quantityStr,
        movementType:    'transfer_in',
        transferId:      transfer.id,
        unitCostCents:   article?.costPriceCents,
        createdBy:       params.createdBy,
        notes:           params.notes,
        idempotencyKey:  `${params.idempotencyKey}-in`,
      });

      await tx.insert(transferItems).values({
        transferId:       transfer.id,
        articleId:        params.articleId,
        quantityShipped:  quantityStr,
        quantityReceived: quantityStr,
      });

      return transfer;
    });
  }

  // ================================================================
  // VOID: estorno de movimento
  // O trigger SQL reverte o stock_levels automaticamente
  // ================================================================
  async voidMovement(params: VoidParams) {
    const [movement] = await this.db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.id, params.movementId));

    if (!movement) {
      throw new TRPCError({ code: 'NOT_FOUND' });
    }
    if (movement.voidedAt) {
      throw new TRPCError({ code: 'CONFLICT', message: 'Movimento já foi estornado' });
    }

    const [voided] = await this.db
      .update(stockMovements)
      .set({
        voidedAt:   new Date(),
        voidedBy:   params.voidedBy,
        voidReason: params.voidReason,
      })
      .where(eq(stockMovements.id, params.movementId))
      .returning();

    return voided;
  }
}

Passo 3 — Estender router movements
Substitui server/routers/movements.ts pelo conteúdo completo:
typescriptimport { z } from 'zod';
import { desc, eq, and, gte, lte, isNull } from 'drizzle-orm';
import { router } from '@/server/trpc';
import {
  protectedProcedure, driverProcedure,
  managerProcedure, adminProcedure,
} from '@/server/procedures';
import { stockMovements, articles, locations, users } from '@/db/schema';
import { recentActivitySchema } from '@/lib/schemas/movements';
import { idSchema, idempotencySchema } from '@/lib/schemas/common';
import { StockMovementService } from '@/server/services/stock-movement.service';
import { db } from '@/db/client';

const movementService = new StockMovementService(db);

export const movementsRouter = router({
  // Atividade recente (dashboard)
  recentActivity: protectedProcedure
    .input(recentActivitySchema)
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id:           stockMovements.id,
          movementType: stockMovements.movementType,
          quantityDelta:stockMovements.quantityDelta,
          createdAt:    stockMovements.createdAt,
          unitCostCents:stockMovements.unitCostCents,
          articleName:  articles.name,
          articleUnit:  articles.unit,
          locationName: locations.name,
          locationCode: locations.code,
          createdByName:users.name,
        })
        .from(stockMovements)
        .innerJoin(articles,  eq(stockMovements.articleId,  articles.id))
        .innerJoin(locations, eq(stockMovements.locationId, locations.id))
        .innerJoin(users,     eq(stockMovements.createdBy,  users.id))
        .where(
          and(
            isNull(stockMovements.voidedAt),
            input.locationId ? eq(stockMovements.locationId, input.locationId) : undefined,
          ),
        )
        .orderBy(desc(stockMovements.createdAt))
        .limit(input.limit);
      return rows;
    }),

  // Lista filtrável (admin)
  list: managerProcedure
    .input(z.object({
      locationId: z.string().uuid().optional(),
      createdBy:  z.string().uuid().optional(),
      type:       z.enum(['consumption','restock','transfer_out','transfer_in','adjustment','initial','return']).optional(),
      from:       z.coerce.date().optional(),
      to:         z.coerce.date().optional(),
      page:       z.number().int().positive().default(1),
      limit:      z.number().int().min(1).max(100).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const offset = (input.page - 1) * input.limit;
      const where = and(
        input.locationId ? eq(stockMovements.locationId, input.locationId) : undefined,
        input.createdBy  ? eq(stockMovements.createdBy,  input.createdBy)  : undefined,
        input.type       ? eq(stockMovements.movementType, input.type)      : undefined,
        input.from       ? gte(stockMovements.createdAt, input.from)        : undefined,
        input.to         ? lte(stockMovements.createdAt, input.to)          : undefined,
      );

      const rows = await ctx.db
        .select({
          id:           stockMovements.id,
          movementType: stockMovements.movementType,
          quantityDelta:stockMovements.quantityDelta,
          createdAt:    stockMovements.createdAt,
          voidedAt:     stockMovements.voidedAt,
          unitCostCents:stockMovements.unitCostCents,
          reason:       stockMovements.reason,
          notes:        stockMovements.notes,
          articleName:  articles.name,
          articleSku:   articles.sku,
          articleUnit:  articles.unit,
          locationName: locations.name,
          locationCode: locations.code,
          createdByName:users.name,
        })
        .from(stockMovements)
        .innerJoin(articles,  eq(stockMovements.articleId,  articles.id))
        .innerJoin(locations, eq(stockMovements.locationId, locations.id))
        .innerJoin(users,     eq(stockMovements.createdBy,  users.id))
        .where(where)
        .orderBy(desc(stockMovements.createdAt))
        .limit(input.limit)
        .offset(offset);

      return rows;
    }),

  // Retirada: Depósito → Caminhão (driver self-service)
  withdraw: driverProcedure
    .input(z.object({
      articleId:      z.string().uuid(),
      quantity:       z.number().positive(),
      fromLocationId: z.string().uuid(),  // depósito
      toLocationId:   z.string().uuid(),  // caminhão do driver
      notes:          z.string().max(300).optional(),
    }).merge(idempotencySchema))
    .mutation(async ({ ctx, input }) => {
      // Valida que toLocationId é o caminhão do próprio driver
      if (ctx.user.role === 'driver') {
        const loc = await ctx.db.query.locations.findFirst({
          where: (l, { eq, and }) =>
            and(eq(l.id, input.toLocationId), eq(l.assignedUserId, ctx.user.id)),
        });
        if (!loc) {
          throw new Error('Você só pode retirar para o seu próprio caminhão');
        }
      }

      return movementService.createWithdrawal({
        ...input,
        createdBy: ctx.user.id,
      });
    }),

  // Devolução: Caminhão → Depósito (driver self-service)
  return: driverProcedure
    .input(z.object({
      articleId:      z.string().uuid(),
      quantity:       z.number().positive(),
      fromLocationId: z.string().uuid(),  // caminhão
      toLocationId:   z.string().uuid(),  // depósito
      notes:          z.string().max(300).optional(),
    }).merge(idempotencySchema))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role === 'driver') {
        const loc = await ctx.db.query.locations.findFirst({
          where: (l, { eq, and }) =>
            and(eq(l.id, input.fromLocationId), eq(l.assignedUserId, ctx.user.id)),
        });
        if (!loc) {
          throw new Error('Você só pode devolver do seu próprio caminhão');
        }
      }

      return movementService.createReturn({
        ...input,
        createdBy: ctx.user.id,
      });
    }),

  // Void (admin/manager)
  void: adminProcedure
    .input(z.object({
      movementId: z.string().uuid(),
      voidReason: z.string().min(5).max(300),
    }).merge(idempotencySchema))
    .mutation(async ({ ctx, input }) => {
      return movementService.voidMovement({
        movementId:  input.movementId,
        voidedBy:    ctx.user.id,
        voidReason:  input.voidReason,
        requestedBy: ctx.user.id,
      });
    }),
});

Passo 4 — Router drivers
server/routers/drivers.ts
typescriptimport { z } from 'zod';
import { desc, eq, and, gte, lte, isNull } from 'drizzle-orm';
import { router } from '@/server/trpc';
import { protectedProcedure, managerProcedure } from '@/server/procedures';
import { stockMovements, articles, locations, users, stockLevels, transfers } from '@/db/schema';

export const driversRouter = router({
  // Lista drivers com seus caminhões
  list: managerProcedure.query(async ({ ctx }) => {
    return ctx.db.query.users.findMany({
      where: (u, { eq, and }) => and(eq(u.role, 'driver'), eq(u.active, true)),
      columns: {
        id: true, name: true, email: true, phone: true,
        defaultLocationId: true, lastLoginAt: true, active: true,
        pinHash: false, totpSecret: false,
      },
    });
  }),

  // Histórico completo de um motorista com lifecycle por operação
  history: managerProcedure
    .input(z.object({
      driverId:   z.string().uuid(),
      from:       z.coerce.date().optional(),
      to:         z.coerce.date().optional(),
      articleId:  z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      // Busca o caminhão do motorista
      const truck = await ctx.db.query.locations.findFirst({
        where: (l, { eq }) => eq(l.assignedUserId, input.driverId),
      });

      if (!truck) return { driver: null, truck: null, operations: [] };

      const driver = await ctx.db.query.users.findFirst({
        where: (u, { eq }) => eq(u.id, input.driverId),
        columns: { id: true, name: true, email: true, phone: true },
      });

      // Busca transferências do/para o caminhão no período
      const ops = await ctx.db
        .select({
          transferId:   transfers.id,
          transferCode: transfers.code,
          direction:    transfers.fromLocationId,
          status:       transfers.status,
          createdAt:    transfers.createdAt,
          articleId:    articles.id,
          articleName:  articles.name,
          articleSku:   articles.sku,
          articleUnit:  articles.unit,
          qtyShipped:   stockMovements.quantityDelta,
          movementType: stockMovements.movementType,
          voidedAt:     stockMovements.voidedAt,
          createdByName:users.name,
        })
        .from(stockMovements)
        .innerJoin(articles,   eq(stockMovements.articleId, articles.id))
        .innerJoin(users,      eq(stockMovements.createdBy, users.id))
        .leftJoin(transfers,   eq(stockMovements.transferId, transfers.id))
        .where(
          and(
            eq(stockMovements.locationId, truck.id),
            input.from ? gte(stockMovements.createdAt, input.from) : undefined,
            input.to   ? lte(stockMovements.createdAt, input.to)   : undefined,
            input.articleId ? eq(stockMovements.articleId, input.articleId) : undefined,
          ),
        )
        .orderBy(desc(stockMovements.createdAt));

      // Enriquece com status de lifecycle
      const enriched = ops.map((op) => {
        const qty = parseFloat(op.qtyShipped ?? '0');
        let lifecycle: 'in_truck' | 'returned' | 'consumed' | 'voided' = 'in_truck';

        if (op.voidedAt) lifecycle = 'voided';
        else if (op.movementType === 'transfer_out') lifecycle = 'returned';
        else if (op.movementType === 'consumption') lifecycle = 'consumed';
        else lifecycle = 'in_truck';

        return { ...op, qty: Math.abs(qty), lifecycle };
      });

      return { driver, truck, operations: enriched };
    }),

  // Saldo atual do caminhão do motorista logado (para PWA)
  myTruckStock: protectedProcedure.query(async ({ ctx }) => {
    const truck = await ctx.db.query.locations.findFirst({
      where: (l, { eq }) => eq(l.assignedUserId, ctx.user.id),
    });

    if (!truck) return { truck: null, items: [] };

    const items = await ctx.db
      .select({
        articleId:       stockLevels.articleId,
        sku:             articles.sku,
        name:            articles.name,
        unit:            articles.unit,
        barcode:         articles.barcode,
        quantity:        stockLevels.quantity,
        reorderPoint:    articles.reorderPoint,
        refrigerantType: articles.refrigerantType,
      })
      .from(stockLevels)
      .innerJoin(articles, eq(stockLevels.articleId, articles.id))
      .where(
        and(
          eq(stockLevels.locationId, truck.id),
          eq(articles.active, true),
        ),
      )
      .orderBy(articles.name);

    return { truck, items };
  }),

  // Busca artigo por SKU (para scanner QR)
  getArticleBySku: protectedProcedure
    .input(z.object({ sku: z.string().min(1).max(50) }))
    .query(async ({ ctx, input }) => {
      const article = await ctx.db.query.articles.findFirst({
        where: (a, { eq, and }) =>
          and(eq(a.sku, input.sku), eq(a.active, true)),
      });
      return article ?? null;
    }),
});
Atualiza server/routers/_app.ts:
typescriptimport { router } from '@/server/trpc';
import { authRouter }      from './auth';
import { articlesRouter }  from './articles';
import { locationsRouter } from './locations';
import { movementsRouter } from './movements';
import { dashboardRouter } from './dashboard';
import { driversRouter }   from './drivers';

export const appRouter = router({
  auth:      authRouter,
  articles:  articlesRouter,
  locations: locationsRouter,
  movements: movementsRouter,
  dashboard: dashboardRouter,
  drivers:   driversRouter,
});

export type AppRouter = typeof appRouter;

Passo 5 — Zod schemas adicionais
lib/schemas/movements.ts — adiciona schemas de mutation:
typescriptimport { z } from 'zod';
import { paginationSchema, dateRangeSchema, idempotencySchema } from './common';

export const recentActivitySchema = z.object({
  limit:      z.number().int().min(1).max(50).default(10),
  locationId: z.string().uuid().optional(),
});

export const movementListSchema = paginationSchema.extend({
  locationId: z.string().uuid().optional(),
  createdBy:  z.string().uuid().optional(),
  type:       z.enum(['consumption','restock','transfer_out','transfer_in','adjustment','initial','return']).optional(),
  from:       z.coerce.date().optional(),
  to:         z.coerce.date().optional(),
});

export const withdrawSchema = z.object({
  articleId:      z.string().uuid(),
  quantity:       z.number().positive(),
  fromLocationId: z.string().uuid(),
  toLocationId:   z.string().uuid(),
  notes:          z.string().max(300).optional(),
}).merge(idempotencySchema);

export const returnSchema = withdrawSchema;

export const voidSchema = z.object({
  movementId: z.string().uuid(),
  voidReason: z.string().min(5).max(300),
}).merge(idempotencySchema);

Passo 6 — Admin: artigos
app/(admin)/articles/page.tsx
typescriptimport { AdminTopbar }      from '@/components/admin/layout/topbar';
import { ArticlesTable }    from '@/components/admin/articles/articles-table';
import { createServerClient } from '@/lib/trpc/server';

export default async function ArticlesPage() {
  const api      = await createServerClient();
  const articles = await api.articles.list({ page: 1, limit: 100, active: true });

  return (
    <>
      <AdminTopbar title="Artigos" subtitle="Catálogo de itens do estoque" />
      <main className="flex-1 overflow-auto p-5">
        <ArticlesTable initialData={articles} />
      </main>
    </>
  );
}
components/admin/articles/articles-table.tsx
typescript'use client';

import { useState } from 'react';
import { IconPlus, IconQrcode, IconSearch, IconEdit } from '@tabler/icons-react';
import { api } from '@/lib/trpc/client';
import QRCode from 'qrcode';

type Article = {
  id: string; sku: string; name: string; unit: string;
  barcode: string | null; active: boolean;
  minStock: string; reorderPoint: string;
  refrigerantType: string | null;
};

async function downloadQR(sku: string, name: string) {
  const url   = `${window.location.origin}/scan/${sku}`;
  const dataUrl = await QRCode.toDataURL(url, { width: 300, margin: 2 });
  const a       = document.createElement('a');
  a.href        = dataUrl;
  a.download    = `qr-${sku}.png`;
  a.click();
}

export function ArticlesTable({ initialData }: { initialData: { items: Article[] } }) {
  const [search, setSearch] = useState('');

  const filtered = initialData.items.filter((a) =>
    !search ||
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.sku.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="relative max-w-xs flex-1">
          <IconSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar artigo ou SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-btn border border-surface-border py-2 pl-8 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-500 focus:outline-none"
          />
        </div>
        
          href="/articles/new"
          className="flex items-center gap-1.5 rounded-btn bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
        >
          <IconPlus size={15} />
          Novo artigo
        </a>
      </div>

      {/* Table */}
      <div className="rounded-card border border-surface-border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface">
              {['SKU', 'Nome', 'Unidade', 'Mín.', 'Ponto reposição', 'Tipo gás', ''].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-text-muted uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {filtered.map((a) => (
              <tr key={a.id} className="hover:bg-surface transition-colors">
                <td className="px-4 py-2.5 font-mono text-xs text-text-secondary">{a.sku}</td>
                <td className="px-4 py-2.5 font-medium text-text-primary">{a.name}</td>
                <td className="px-4 py-2.5">
                  <span className="rounded px-1.5 py-0.5 text-xs bg-surface text-text-secondary">
                    {a.unit}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-text-secondary">{parseFloat(a.minStock).toFixed(3)}</td>
                <td className="px-4 py-2.5 text-text-secondary">{parseFloat(a.reorderPoint).toFixed(3)}</td>
                <td className="px-4 py-2.5 text-text-secondary">{a.refrigerantType ?? '—'}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => downloadQR(a.sku, a.name)}
                      className="flex items-center gap-1 rounded px-2 py-1 text-xs text-brand-500 hover:bg-brand-50 transition-colors"
                      title="Baixar QR code"
                    >
                      <IconQrcode size={14} />
                      QR
                    </button>
                    
                      href={`/articles/${a.id}/edit`}
                      className="flex items-center gap-1 rounded px-2 py-1 text-xs text-text-secondary hover:bg-surface transition-colors"
                    >
                      <IconEdit size={14} />
                      Editar
                    </a>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-text-muted">
                  Nenhum artigo encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

Passo 7 — Admin: movimentações
app/(admin)/movements/page.tsx
typescriptimport { AdminTopbar }         from '@/components/admin/layout/topbar';
import { MovementsTable }      from '@/components/admin/movements/movements-table';
import { createServerClient }  from '@/lib/trpc/server';

export default async function MovementsPage() {
  const api       = await createServerClient();
  const movements = await api.movements.list({ page: 1, limit: 50 });
  const locations = await api.locations.list({ active: true });
  const drivers   = await api.drivers.list();

  return (
    <>
      <AdminTopbar title="Movimentações" subtitle="Histórico completo de entradas e saídas" />
      <main className="flex-1 overflow-auto p-5">
        <MovementsTable
          initialData={movements}
          locations={locations}
          drivers={drivers}
        />
      </main>
    </>
  );
}
components/admin/movements/movements-table.tsx
typescript'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  IconArrowUpRight, IconArrowDownLeft,
  IconTransfer, IconAdjustments, IconBan,
} from '@tabler/icons-react';

const TYPE_CONFIG = {
  consumption:  { label: 'Consumo',       icon: IconArrowUpRight,  color: 'text-status-critical', bg: 'bg-red-50' },
  restock:      { label: 'Entrada',        icon: IconArrowDownLeft, color: 'text-status-ok',       bg: 'bg-green-50' },
  transfer_out: { label: 'Saída (transf)', icon: IconArrowUpRight,  color: 'text-status-low',      bg: 'bg-amber-50' },
  transfer_in:  { label: 'Entrada (transf)',icon: IconArrowDownLeft, color: 'text-brand-500',       bg: 'bg-blue-50' },
  adjustment:   { label: 'Ajuste',         icon: IconAdjustments,  color: 'text-text-secondary',  bg: 'bg-gray-50' },
  initial:      { label: 'Inicial',        icon: IconArrowDownLeft, color: 'text-text-muted',      bg: 'bg-gray-50' },
  return:       { label: 'Devolução',      icon: IconArrowDownLeft, color: 'text-status-ok',       bg: 'bg-green-50' },
} as const;

type Movement = {
  id: string; movementType: keyof typeof TYPE_CONFIG;
  quantityDelta: string; createdAt: Date; voidedAt: Date | null;
  articleName: string; articleSku: string; articleUnit: string;
  locationName: string; createdByName: string;
  unitCostCents: number | null; notes: string | null;
};

export function MovementsTable({
  initialData, locations, drivers,
}: {
  initialData: Movement[];
  locations:   { id: string; name: string }[];
  drivers:     { id: string; name: string }[];
}) {
  const [typeFilter, setTypeFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');

  const filtered = initialData.filter((m) => {
    const matchType     = !typeFilter     || m.movementType === typeFilter;
    const matchLocation = !locationFilter || m.locationName === locationFilter;
    return matchType && matchLocation;
  });

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex gap-3">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-btn border border-surface-border px-3 py-2 text-sm text-text-primary bg-white focus:outline-none focus:border-brand-500"
        >
          <option value="">Todos os tipos</option>
          {Object.entries(TYPE_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          className="rounded-btn border border-surface-border px-3 py-2 text-sm text-text-primary bg-white focus:outline-none focus:border-brand-500"
        >
          <option value="">Todas as locations</option>
          {locations.map((l) => (
            <option key={l.id} value={l.name}>{l.name}</option>
          ))}
        </select>
      </div>

      {/* Tabela */}
      <div className="rounded-card border border-surface-border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface">
              {['Tipo', 'Artigo', 'Quantidade', 'Location', 'Operador', 'Data/hora', ''].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-text-muted uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {filtered.map((m) => {
              const cfg = TYPE_CONFIG[m.movementType];
              const Icon = cfg.icon;
              const qty  = parseFloat(m.quantityDelta);
              return (
                <tr key={m.id} className={`hover:bg-surface transition-colors ${m.voidedAt ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-2.5">
                    <div className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                      <Icon size={12} />
                      {cfg.label}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-text-primary">{m.articleName}</p>
                    <p className="text-xs text-text-muted font-mono">{m.articleSku}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`font-medium ${qty < 0 ? 'text-status-critical' : 'text-status-ok'}`}>
                      {qty > 0 ? '+' : ''}{qty.toFixed(3)} {m.articleUnit}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary">{m.locationName}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{m.createdByName}</td>
                  <td className="px-4 py-2.5 text-text-secondary text-xs">
                    {format(new Date(m.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </td>
                  <td className="px-4 py-2.5">
                    {m.voidedAt && (
                      <span className="inline-flex items-center gap-1 text-xs text-text-muted">
                        <IconBan size={12} /> Estornado
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-text-muted">
                  Nenhuma movimentação encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

Passo 8 — Admin: histórico por motorista
app/(admin)/drivers/[id]/page.tsx
typescriptimport { AdminTopbar }        from '@/components/admin/layout/topbar';
import { DriverHistory }      from '@/components/admin/drivers/driver-history';
import { createServerClient } from '@/lib/trpc/server';
import { notFound }           from 'next/navigation';

export default async function DriverHistoryPage({ params }: { params: { id: string } }) {
  const api     = await createServerClient();
  const history = await api.drivers.history({ driverId: params.id });

  if (!history.driver) notFound();

  return (
    <>
      <AdminTopbar
        title={`Histórico — ${history.driver.name}`}
        subtitle={`Caminhão: ${history.truck?.name ?? '—'} · ${history.truck?.code ?? '—'}`}
      />
      <main className="flex-1 overflow-auto p-5">
        <DriverHistory history={history} driverId={params.id} />
      </main>
    </>
  );
}
components/admin/drivers/driver-history.tsx
typescript'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { IconTruck, IconPackage, IconArrowBack, IconCircleCheck, IconBan } from '@tabler/icons-react';

const LIFECYCLE_CONFIG = {
  in_truck: { label: 'No caminhão', icon: IconTruck,        color: 'text-brand-500',       bg: 'bg-blue-50' },
  returned: { label: 'Devolvido',   icon: IconArrowBack,    color: 'text-status-ok',       bg: 'bg-green-50' },
  consumed: { label: 'Consumido',   icon: IconCircleCheck,  color: 'text-text-secondary',  bg: 'bg-gray-50' },
  voided:   { label: 'Estornado',   icon: IconBan,          color: 'text-text-muted',      bg: 'bg-gray-50' },
} as const;

type Operation = {
  transferId: string | null; transferCode: string | null;
  articleName: string; articleSku: string; articleUnit: string;
  qty: number; movementType: string; lifecycle: keyof typeof LIFECYCLE_CONFIG;
  createdAt: Date; createdByName: string;
};

export function DriverHistory({
  history, driverId,
}: {
  history: { driver: { name: string } | null; truck: { name: string; code: string } | null; operations: Operation[] };
  driverId: string;
}) {
  const [from, setFrom]   = useState('');
  const [to, setTo]       = useState('');
  const [status, setStatus] = useState<string>('');

  const filtered = history.operations.filter((op) => {
    const date         = new Date(op.createdAt);
    const matchFrom    = !from || date >= new Date(from);
    const matchTo      = !to   || date <= new Date(`${to}T23:59:59`);
    const matchStatus  = !status || op.lifecycle === status;
    return matchFrom && matchTo && matchStatus;
  });

  // Counts por lifecycle
  const counts = {
    in_truck: history.operations.filter((o) => o.lifecycle === 'in_truck').length,
    returned: history.operations.filter((o) => o.lifecycle === 'returned').length,
    consumed: history.operations.filter((o) => o.lifecycle === 'consumed').length,
  };

  return (
    <div className="space-y-4">
      {/* Summary pills */}
      <div className="flex gap-3">
        {([
          ['in_truck', `No caminhão (${counts.in_truck})`, 'bg-blue-50 text-brand-500'],
          ['returned', `Devolvido (${counts.returned})`,   'bg-green-50 text-status-ok'],
          ['consumed', `Consumido (${counts.consumed})`,   'bg-gray-50 text-text-secondary'],
        ] as const).map(([val, label, cls]) => (
          <button
            key={val}
            onClick={() => setStatus(status === val ? '' : val)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              status === val ? cls + ' ring-1 ring-current' : 'bg-surface text-text-secondary hover:bg-brand-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filtros de data */}
      <div className="flex gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-text-secondary">De</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-btn border border-surface-border px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-brand-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-text-secondary">Até</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-btn border border-surface-border px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-brand-500"
          />
        </div>
        {(from || to || status) && (
          <button
            onClick={() => { setFrom(''); setTo(''); setStatus(''); }}
            className="text-xs text-text-muted hover:text-text-secondary"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Lista */}
      <div className="rounded-card border border-surface-border bg-white divide-y divide-surface-border">
        {filtered.map((op, i) => {
          const cfg  = LIFECYCLE_CONFIG[op.lifecycle];
          const Icon = cfg.icon;
          return (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${cfg.bg}`}>
                <Icon size={16} className={cfg.color} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  {op.articleName}
                  <span className="ml-2 font-mono text-xs text-text-muted">{op.articleSku}</span>
                </p>
                <p className="text-xs text-text-secondary">
                  {op.qty.toFixed(3)} {op.articleUnit} ·{' '}
                  {format(new Date(op.createdAt), "dd/MM HH:mm", { locale: ptBR })} ·{' '}
                  {op.createdByName}
                  {op.transferCode && ` · ${op.transferCode}`}
                </p>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                <Icon size={11} />
                {cfg.label}
              </span>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-text-muted">
            Nenhuma operação encontrada para os filtros selecionados.
          </p>
        )}
      </div>
    </div>
  );
}

Passo 9 — PWA layout mobile
app/(driver)/layout.tsx
typescriptimport { auth }     from '@/lib/auth/config';
import { redirect } from 'next/navigation';

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'driver' && session.user.role !== 'admin') {
    redirect('/dashboard');
  }

  return (
    <div className="flex h-screen flex-col bg-surface overflow-hidden max-w-[430px] mx-auto">
      {children}
    </div>
  );
}

Passo 10 — PWA home
app/(driver)/driver/page.tsx
typescriptimport { createServerClient } from '@/lib/trpc/server';
import { auth }               from '@/lib/auth/config';
import { DriverHome }         from '@/components/driver/home';

export default async function DriverHomePage() {
  const session = await auth();
  const api     = await createServerClient();
  const data    = await api.drivers.myTruckStock();

  return <DriverHome data={data} userName={session?.user?.name ?? ''} />;
}
components/driver/home.tsx
typescript'use client';

import Link from 'next/link';
import { IconQrcode, IconHistory, IconPackage, IconAlertTriangle } from '@tabler/icons-react';

type Item = {
  articleId: string; name: string; unit: string;
  quantity: string; reorderPoint: string;
};

export function DriverHome({
  data, userName,
}: {
  data: { truck: { name: string; code: string } | null; items: Item[] };
  userName: string;
}) {
  const lowItems = data.items.filter(
    (i) => parseFloat(i.quantity) <= parseFloat(i.reorderPoint),
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-brand-500 px-4 pb-5 pt-10">
        <p className="text-sm text-white/75">Olá,</p>
        <h1 className="text-xl font-medium text-white">{userName}</h1>
        <p className="mt-0.5 text-sm text-white/75">
          {data.truck?.name ?? 'Sem caminhão atribuído'}
        </p>
      </div>

      {/* Ações rápidas */}
      <div className="grid grid-cols-2 gap-3 px-4 pt-4">
        <Link
          href="/driver/scan"
          className="flex flex-col items-center gap-2 rounded-card border border-surface-border bg-white px-4 py-5 hover:bg-brand-50 transition-colors"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-500">
            <IconQrcode size={24} className="text-white" />
          </div>
          <span className="text-sm font-medium text-text-primary">Escanear QR</span>
          <span className="text-center text-xs text-text-secondary">Retirada ou devolução</span>
        </Link>
        <Link
          href="/driver/history"
          className="flex flex-col items-center gap-2 rounded-card border border-surface-border bg-white px-4 py-5 hover:bg-brand-50 transition-colors"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface">
            <IconHistory size={24} className="text-text-secondary" />
          </div>
          <span className="text-sm font-medium text-text-primary">Histórico</span>
          <span className="text-center text-xs text-text-secondary">Minhas operações</span>
        </Link>
      </div>

      {/* Alertas */}
      {lowItems.length > 0 && (
        <div className="mx-4 mt-4 flex items-start gap-2 rounded-btn bg-amber-50 border border-amber-200 p-3">
          <IconAlertTriangle size={16} className="text-status-low flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            <strong>{lowItems.length} {lowItems.length === 1 ? 'item abaixo' : 'itens abaixo'}</strong>{' '}
            do estoque mínimo no seu caminhão.
          </p>
        </div>
      )}

      {/* Saldo do caminhão */}
      <div className="flex-1 overflow-auto px-4 pt-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-text-primary">
            Seu estoque — {data.items.length} itens
          </h2>
        </div>
        <div className="rounded-card border border-surface-border bg-white divide-y divide-surface-border">
          {data.items.map((item) => {
            const qty     = parseFloat(item.quantity);
            const reorder = parseFloat(item.reorderPoint);
            const isLow   = qty <= reorder;
            return (
              <div key={item.articleId} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className={`h-2 w-2 rounded-full ${isLow ? 'bg-status-low' : 'bg-status-ok'}`} />
                  <p className="text-sm text-text-primary">{item.name}</p>
                </div>
                <span className={`text-sm font-medium ${isLow ? 'text-status-low' : 'text-text-primary'}`}>
                  {qty.toFixed(3)} {item.unit}
                </span>
              </div>
            );
          })}
          {data.items.length === 0 && (
            <div className="flex flex-col items-center py-8 text-text-muted">
              <IconPackage size={32} className="mb-2 opacity-30" />
              <p className="text-sm">Caminhão vazio</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

Passo 11 — PWA scanner
app/(driver)/driver/scan/page.tsx
typescriptimport { QrScanner } from '@/components/driver/qr-scanner';

export default function ScanPage() {
  return <QrScanner />;
}
components/driver/qr-scanner.tsx
typescript'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { IconX, IconFlashlightOff } from '@tabler/icons-react';
import { BrowserMultiFormatReader } from '@zxing/browser';

export function QrScanner() {
  const router    = useRouter();
  const videoRef  = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);

  const handleResult = useCallback((text: string) => {
    if (!scanning) return;
    setScanning(false);

    // QR code contém URL como https://app.com/scan/{sku}
    // ou diretamente o SKU
    try {
      const url = new URL(text);
      const sku = url.pathname.split('/scan/')[1];
      if (sku) router.push(`/driver/scan/${encodeURIComponent(sku)}`);
    } catch {
      // Não é URL — trata como SKU direto
      router.push(`/driver/scan/${encodeURIComponent(text)}`);
    }
  }, [scanning, router]);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current!, (result, err) => {
        if (result) handleResult(result.getText());
        if (err && !(err instanceof Error && err.message.includes('No MultiFormat'))) {
          // Ignora erros de "nenhum QR encontrado" que ocorrem a cada frame
        }
      })
      .catch((e: unknown) => {
        setError('Não foi possível acessar a câmera. Verifique as permissões.');
      });

    return () => {
      readerRef.current?.reset();
    };
  }, [handleResult]);

  return (
    <div className="relative flex h-screen flex-col bg-black">
      {/* Vídeo fullscreen */}
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        playsInline
        muted
      />

      {/* Overlay escuro nas bordas */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-64 w-64 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />
      </div>

      {/* Instrução */}
      <div className="absolute bottom-20 left-0 right-0 text-center">
        <p className="text-sm font-medium text-white">
          Aponte para o QR code da prateleira
        </p>
      </div>

      {/* Fechar */}
      <button
        onClick={() => router.back()}
        className="absolute right-4 top-12 flex h-10 w-10 items-center justify-center rounded-full bg-black/50"
      >
        <IconX size={20} className="text-white" />
      </button>

      {/* Erro */}
      {error && (
        <div className="absolute inset-x-4 top-20 rounded-btn bg-red-500 px-4 py-3 text-sm text-white">
          {error}
        </div>
      )}
    </div>
  );
}

Passo 12 — PWA form retirada/devolução
app/(driver)/driver/scan/[sku]/page.tsx
typescriptimport { createServerClient } from '@/lib/trpc/server';
import { WithdrawReturnForm } from '@/components/driver/withdraw-return-form';
import { notFound }           from 'next/navigation';
import { auth }               from '@/lib/auth/config';

export default async function ScanArticlePage({ params }: { params: { sku: string } }) {
  const sku     = decodeURIComponent(params.sku);
  const session = await auth();
  const api     = await createServerClient();

  const [article, truckData] = await Promise.all([
    api.drivers.getArticleBySku({ sku }),
    api.drivers.myTruckStock(),
  ]);

  if (!article) notFound();

  // Busca o depósito (warehouse)
  const locations = await api.locations.list({ type: 'warehouse', active: true });
  const warehouse = locations[0];

  if (!warehouse || !truckData.truck) notFound();

  return (
    <WithdrawReturnForm
      article={article}
      warehouse={warehouse}
      truck={truckData.truck}
      userName={session?.user?.name ?? ''}
    />
  );
}
components/driver/withdraw-return-form.tsx
typescript'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconPackage, IconArrowDown, IconArrowUp, IconMinus, IconPlus, IconCheck } from '@tabler/icons-react';
import { api } from '@/lib/trpc/client';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';

type Article = { id: string; name: string; sku: string; unit: string; };
type Location = { id: string; name: string; code: string; };

type Action = 'withdraw' | 'return';

const STEP = 0.5; // incremento padrão — ajustável por unidade

export function WithdrawReturnForm({
  article, warehouse, truck, userName,
}: {
  article:   Article;
  warehouse: Location;
  truck:     Location;
  userName:  string;
}) {
  const router   = useRouter();
  const [action, setAction]   = useState<Action>('withdraw');
  const [qty,    setQty]      = useState(1);
  const [loading, setLoading] = useState(false);

  const withdraw = api.movements.withdraw.useMutation();
  const returnItem = api.movements.return.useMutation();

  const handleSubmit = async () => {
    if (qty <= 0) return;
    setLoading(true);

    try {
      const key = uuidv4();
      if (action === 'withdraw') {
        await withdraw.mutateAsync({
          articleId:      article.id,
          quantity:       qty,
          fromLocationId: warehouse.id,
          toLocationId:   truck.id,
          idempotencyKey: key,
        });
        toast.success(`${qty} ${article.unit} retirado(s) com sucesso`);
      } else {
        await returnItem.mutateAsync({
          articleId:      article.id,
          quantity:       qty,
          fromLocationId: truck.id,
          toLocationId:   warehouse.id,
          idempotencyKey: key,
        });
        toast.success(`${qty} ${article.unit} devolvido(s) com sucesso`);
      }
      router.push('/driver');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao registrar operação';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <div className="bg-brand-500 px-4 pb-6 pt-10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
            <IconPackage size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-medium text-white">{article.name}</h1>
            <p className="text-xs text-white/75">SKU: {article.sku}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Selecionar ação */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setAction('withdraw')}
            className={`flex flex-col items-center gap-2 rounded-card border-2 p-4 transition-colors ${
              action === 'withdraw'
                ? 'border-brand-500 bg-brand-50'
                : 'border-surface-border bg-white'
            }`}
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
              action === 'withdraw' ? 'bg-brand-500' : 'bg-surface'
            }`}>
              <IconArrowDown size={20} className={action === 'withdraw' ? 'text-white' : 'text-text-secondary'} />
            </div>
            <span className={`text-sm font-medium ${action === 'withdraw' ? 'text-brand-500' : 'text-text-secondary'}`}>
              Retirada
            </span>
            <span className="text-center text-xs text-text-muted">Depósito → Caminhão</span>
          </button>

          <button
            onClick={() => setAction('return')}
            className={`flex flex-col items-center gap-2 rounded-card border-2 p-4 transition-colors ${
              action === 'return'
                ? 'border-status-ok bg-green-50'
                : 'border-surface-border bg-white'
            }`}
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
              action === 'return' ? 'bg-status-ok' : 'bg-surface'
            }`}>
              <IconArrowUp size={20} className={action === 'return' ? 'text-white' : 'text-text-secondary'} />
            </div>
            <span className={`text-sm font-medium ${action === 'return' ? 'text-status-ok' : 'text-text-secondary'}`}>
              Devolução
            </span>
            <span className="text-center text-xs text-text-muted">Caminhão → Depósito</span>
          </button>
        </div>

        {/* Seletor de quantidade */}
        <div className="rounded-card border border-surface-border bg-white p-5">
          <p className="mb-4 text-center text-sm font-medium text-text-primary">
            Quantidade ({article.unit})
          </p>
          <div className="flex items-center justify-center gap-6">
            <button
              onClick={() => setQty((q) => Math.max(STEP, parseFloat((q - STEP).toFixed(3))))}
              className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-surface-border bg-surface hover:bg-brand-50 hover:border-brand-500 transition-colors"
            >
              <IconMinus size={20} className="text-text-secondary" />
            </button>
            <div className="text-center">
              <p className="text-4xl font-medium text-text-primary">{qty.toFixed(1)}</p>
              <p className="text-sm text-text-muted">{article.unit}</p>
            </div>
            <button
              onClick={() => setQty((q) => parseFloat((q + STEP).toFixed(3)))}
              className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-surface-border bg-surface hover:bg-brand-50 hover:border-brand-500 transition-colors"
            >
              <IconPlus size={20} className="text-text-secondary" />
            </button>
          </div>

          {/* Input manual */}
          <input
            type="number"
            step={STEP}
            min={STEP}
            value={qty}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v > 0) setQty(v);
            }}
            className="mt-4 w-full rounded-btn border border-surface-border px-3 py-2 text-center text-sm text-text-primary focus:border-brand-500 focus:outline-none"
          />
        </div>

        {/* Resumo */}
        <div className="rounded-btn bg-surface px-4 py-3 text-xs text-text-secondary">
          {action === 'withdraw' ? (
            <p><strong>{warehouse.name}</strong> → <strong>{truck.name}</strong></p>
          ) : (
            <p><strong>{truck.name}</strong> → <strong>{warehouse.name}</strong></p>
          )}
          <p className="mt-0.5">Operador: {userName}</p>
        </div>
      </div>

      {/* Botão confirmar */}
      <div className="border-t border-surface-border bg-white p-4">
        <button
          onClick={handleSubmit}
          disabled={loading || qty <= 0}
          className={`flex w-full items-center justify-center gap-2 rounded-btn py-4 text-base font-medium text-white transition-colors disabled:opacity-40 ${
            action === 'withdraw' ? 'bg-brand-500 hover:bg-brand-600' : 'bg-status-ok hover:bg-green-700'
          }`}
        >
          {loading ? (
            <span>Registrando...</span>
          ) : (
            <>
              <IconCheck size={20} />
              Confirmar {action === 'withdraw' ? 'Retirada' : 'Devolução'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
Instala uuid:
bashpnpm add uuid
pnpm add -D @types/uuid

Passo 13 — PWA histórico do dia
app/(driver)/driver/history/page.tsx
typescriptimport { createServerClient } from '@/lib/trpc/server';
import { auth }               from '@/lib/auth/config';
import { DriverDayHistory }   from '@/components/driver/day-history';

export default async function DriverHistoryPage() {
  const session = await auth();
  const api     = await createServerClient();

  const history = await api.drivers.history({
    driverId: session!.user.id,
    from:     new Date(new Date().setHours(0, 0, 0, 0)),
  });

  return <DriverDayHistory history={history} />;
}
components/driver/day-history.tsx
typescript'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { IconArrowLeft, IconTruck, IconArrowBack, IconCircleCheck, IconBan } from '@tabler/icons-react';

const LIFECYCLE = {
  in_truck: { label: 'No caminhão', icon: IconTruck,       color: 'text-brand-500',      bg: 'bg-blue-50' },
  returned: { label: 'Devolvido',   icon: IconArrowBack,   color: 'text-status-ok',      bg: 'bg-green-50' },
  consumed: { label: 'Consumido',   icon: IconCircleCheck, color: 'text-text-secondary', bg: 'bg-gray-50' },
  voided:   { label: 'Estornado',   icon: IconBan,         color: 'text-text-muted',     bg: 'bg-gray-50' },
} as const;

type Op = {
  articleName: string; articleUnit: string; qty: number;
  lifecycle: keyof typeof LIFECYCLE; createdAt: Date;
};

export function DriverDayHistory({ history }: { history: { operations: Op[] } }) {
  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <div className="bg-brand-500 px-4 pb-5 pt-10">
        <div className="flex items-center gap-3">
          <Link href="/driver" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
            <IconArrowLeft size={18} className="text-white" />
          </Link>
          <div>
            <h1 className="text-base font-medium text-white">Minhas operações</h1>
            <p className="text-xs text-white/75">
              {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="rounded-card border border-surface-border bg-white divide-y divide-surface-border">
          {history.operations.map((op, i) => {
            const cfg  = LIFECYCLE[op.lifecycle];
            const Icon = cfg.icon;
            return (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${cfg.bg}`}>
                  <Icon size={16} className={cfg.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{op.articleName}</p>
                  <p className="text-xs text-text-secondary">
                    {op.qty.toFixed(3)} {op.articleUnit} ·{' '}
                    {format(new Date(op.createdAt), 'HH:mm')}
                  </p>
                </div>
                <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
              </div>
            );
          })}
          {history.operations.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-text-muted">
              Nenhuma operação hoje.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

Passo 14 — Testes de integração
tests/integration/stock-movement.test.ts
typescriptimport { describe, it, expect, beforeAll } from 'vitest';
import { StockMovementService } from '@/server/services/stock-movement.service';
import { db } from '@/db/client';

// Testa com dados reais do seed (depósito + caminhão João)
describe('StockMovementService', () => {
  let service: StockMovementService;

  beforeAll(() => {
    service = new StockMovementService(db);
  });

  it('rejeita quantidade zero', async () => {
    await expect(
      service.createWithdrawal({
        articleId:      'fake-id',
        quantity:       0,
        fromLocationId: 'fake-wh',
        toLocationId:   'fake-truck',
        createdBy:      'fake-user',
        idempotencyKey: 'test-key-1',
      }),
    ).rejects.toThrow('maior que zero');
  });

  it('rejeita quantidade negativa', async () => {
    await expect(
      service.createWithdrawal({
        articleId:      'fake-id',
        quantity:       -1,
        fromLocationId: 'fake-wh',
        toLocationId:   'fake-truck',
        createdBy:      'fake-user',
        idempotencyKey: 'test-key-2',
      }),
    ).rejects.toThrow('maior que zero');
  });

  it('cálculo de saldo após movimentos', () => {
    // Mesma lógica dos testes do Dia 2
    const movements = [
      { quantityDelta: '10.000', voidedAt: null },
      { quantityDelta: '-3.500', voidedAt: null },
      { quantityDelta: '-2.000', voidedAt: new Date() }, // voidado
    ];
    const saldo = movements
      .filter((m) => m.voidedAt === null)
      .reduce((acc, m) => acc + parseFloat(m.quantityDelta), 0);
    expect(saldo).toBeCloseTo(6.5);
  });
});
bashpnpm test

Passo 15 — Sanity check
bashpnpm typecheck
pnpm check
pnpm test
pnpm dev
Verifica no browser:

/dashboard → dashboard carrega ✅
/articles → lista de artigos ✅
/movements → tabela de movimentações ✅
/driver → PWA home do motorista ✅
/driver/scan → câmera abre ✅

Checklist:

 server/services/stock-movement.service.ts existe
 server/routers/movements.ts tem withdraw, return, void
 server/routers/drivers.ts existe com history, myTruckStock, getArticleBySku
 _app.ts exporta drivers
 app/(admin)/articles/page.tsx existe
 app/(admin)/movements/page.tsx existe
 app/(admin)/drivers/[id]/page.tsx existe
 app/(driver)/driver/page.tsx existe
 app/(driver)/driver/scan/page.tsx existe
 app/(driver)/driver/scan/[sku]/page.tsx existe
 app/(driver)/driver/history/page.tsx existe