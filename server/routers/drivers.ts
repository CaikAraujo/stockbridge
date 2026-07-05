import { TRPCError } from '@trpc/server';
import { and, desc, eq, gt, gte, inArray, lte } from 'drizzle-orm';
import { z } from 'zod';
import { articles, locations, stockLevels, stockMovements, transfers, users } from '@/db/schema';
import { managerProcedure, protectedProcedure } from '@/server/procedures';
import { router } from '@/server/trpc';

export const driversRouter = router({
  // Lista motoristas ativos com seus dados (excluindo campos sensíveis)
  list: managerProcedure.query(async ({ ctx }) => {
    return ctx.db.query.users.findMany({
      where: (u, { eq: eqFn, and: andFn }) => andFn(eqFn(u.role, 'driver'), eqFn(u.active, true)),
      columns: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        defaultLocationId: true,
        active: true,
        lastLoginAt: true,
      },
    });
  }),

  // Histórico completo de um motorista com lifecycle por operação.
  // Admin/manager podem consultar qualquer driver; driver só o próprio.
  history: protectedProcedure
    .input(
      z.object({
        driverId: z.string().uuid(),
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
        articleId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (ctx.user.role === 'driver' && ctx.user.id !== input.driverId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Motoristas só podem consultar seu próprio histórico',
        });
      }

      const driver = await ctx.db.query.users.findFirst({
        where: (u, { eq: eqFn }) => eqFn(u.id, input.driverId),
        columns: { id: true, name: true, email: true, phone: true },
      });
      if (!driver) return { driver: null, truck: null, operations: [] };

      const truck = await ctx.db.query.locations.findFirst({
        where: (l, { eq: eqFn }) => eqFn(l.assignedUserId, input.driverId),
      });
      if (!truck) return { driver, truck: null, operations: [] };

      const ops = await ctx.db
        .select({
          transferId: transfers.id,
          transferCode: transfers.code,
          direction: transfers.fromLocationId,
          status: transfers.status,
          createdAt: stockMovements.createdAt,
          articleId: articles.id,
          articleName: articles.name,
          articleSku: articles.sku,
          articleUnit: articles.unit,
          qtyShipped: stockMovements.quantityDelta,
          movementType: stockMovements.movementType,
          voidedAt: stockMovements.voidedAt,
          createdByName: users.name,
        })
        .from(stockMovements)
        .innerJoin(articles, eq(stockMovements.articleId, articles.id))
        .innerJoin(users, eq(stockMovements.createdBy, users.id))
        .leftJoin(transfers, eq(stockMovements.transferId, transfers.id))
        .where(
          and(
            eq(stockMovements.locationId, truck.id),
            input.from ? gte(stockMovements.createdAt, input.from) : undefined,
            input.to ? lte(stockMovements.createdAt, input.to) : undefined,
            input.articleId ? eq(stockMovements.articleId, input.articleId) : undefined,
          ),
        )
        .orderBy(desc(stockMovements.createdAt));

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
      where: (l, { eq: eqFn }) => eqFn(l.assignedUserId, ctx.user.id),
    });

    if (!truck) return { truck: null, items: [] };

    const items = await ctx.db
      .select({
        articleId: stockLevels.articleId,
        sku: articles.sku,
        name: articles.name,
        unit: articles.unit,
        barcode: articles.barcode,
        quantity: stockLevels.quantity,
        reorderPoint: articles.reorderPoint,
        refrigerantType: articles.refrigerantType,
      })
      .from(stockLevels)
      .innerJoin(articles, eq(stockLevels.articleId, articles.id))
      .where(and(eq(stockLevels.locationId, truck.id), eq(articles.active, true)))
      .orderBy(articles.name);

    return { truck, items };
  }),

  // Busca artigo por SKU (para scanner QR)
  getArticleBySku: protectedProcedure
    .input(z.object({ sku: z.string().min(1).max(50) }))
    .query(async ({ ctx, input }) => {
      const article = await ctx.db.query.articles.findFirst({
        where: (a, { eq: eqFn, and: andFn }) => andFn(eqFn(a.sku, input.sku), eqFn(a.active, true)),
        columns: {
          id: true,
          sku: true,
          name: true,
          unit: true,
          barcode: true,
          refrigerantType: true,
          active: true,
        },
      });
      return article ?? null;
    }),

  // Disponibilidade do depósito — artigos com saldo > 0 no warehouse + quais caminhões têm o mesmo artigo
  warehouseAvailability: protectedProcedure.query(async ({ ctx }) => {
    // 1) Busca artigos com saldo no depósito (location type = 'warehouse')
    const warehouseRows = await ctx.db
      .select({
        articleId: articles.id,
        name: articles.name,
        sku: articles.sku,
        unit: articles.unit,
        warehouseQty: stockLevels.quantity,
      })
      .from(stockLevels)
      .innerJoin(articles, eq(stockLevels.articleId, articles.id))
      .innerJoin(locations, eq(stockLevels.locationId, locations.id))
      .where(
        and(
          eq(locations.type, 'warehouse'),
          eq(locations.active, true),
          eq(articles.active, true),
          gt(stockLevels.quantity, '0'),
        ),
      )
      .orderBy(articles.name);

    if (warehouseRows.length === 0) return [];

    const articleIds = warehouseRows.map((r) => r.articleId);

    // 2) Busca caminhões que também têm esses artigos — 1 query, sem N+1
    const truckRows = await ctx.db
      .select({
        articleId: stockLevels.articleId,
        truckName: locations.name,
        driverName: users.name,
        quantity: stockLevels.quantity,
      })
      .from(stockLevels)
      .innerJoin(locations, eq(stockLevels.locationId, locations.id))
      .leftJoin(users, eq(locations.assignedUserId, users.id))
      .where(
        and(
          eq(locations.type, 'truck'),
          eq(locations.active, true),
          inArray(stockLevels.articleId, articleIds),
          gt(stockLevels.quantity, '0'),
        ),
      );

    return warehouseRows.map((row) => ({
      articleId: row.articleId,
      name: row.name,
      sku: row.sku,
      unit: row.unit,
      warehouseQty: parseFloat(row.warehouseQty),
      driversWithItem: truckRows
        .filter((t) => t.articleId === row.articleId)
        .map((t) => ({
          driverName: t.driverName ?? 'Sem motorista',
          truckName: t.truckName,
          quantity: parseFloat(t.quantity),
        })),
    }));
  }),
});
