import { and, count, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import { articles, locations, stockLevels, stockMovements, transfers, users } from '@/db/schema';
import { idSchema } from '@/lib/schemas/common';
import { managerProcedure, protectedProcedure } from '@/server/procedures';
import { router } from '@/server/trpc';

/**
 * Conta artigos críticos no depósito (quantity <= minStock).
 * Partilhado com purchaseOrders.getCriticalCount — não duplicar.
 */
export async function countCriticalArticles(
  db: Parameters<Parameters<typeof protectedProcedure.query>[0]>[0]['ctx']['db'],
): Promise<number> {
  const result = await db.execute<{ total: string }>(sql`
    SELECT COUNT(*) AS total
    FROM articles a
    LEFT JOIN stock_levels sl
      ON sl.article_id = a.id
      AND sl.location_id = (
        SELECT id FROM locations WHERE type = 'warehouse' AND active = true LIMIT 1
      )
    WHERE a.active = true
      AND COALESCE(sl.quantity, 0) <= a.min_stock
      AND a.min_stock > 0
  `);
  const row = result.rows[0];
  return Number(row?.total ?? 0);
}

export const dashboardRouter = router({
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [movementsToday, transfersInTransit, criticalCount] = await Promise.all([
      ctx.db
        .select({ total: count() })
        .from(stockMovements)
        .where(
          and(
            isNull(stockMovements.voidedAt),
            gte(stockMovements.createdAt, todayStart),
            eq(stockMovements.movementType, 'consumption'),
          ),
        ),

      ctx.db.select({ total: count() }).from(transfers).where(eq(transfers.status, 'in_transit')),

      countCriticalArticles(ctx.db),
    ]);

    return {
      movementsToday: movementsToday[0]?.total ?? 0,
      transfersInTransit: transfersInTransit[0]?.total ?? 0,
      lowStockAlerts: criticalCount,
    };
  }),

  getTrucksSummary: protectedProcedure.query(async ({ ctx }) => {
    // Busca caminhões com join para o usuário atribuído (sem relações Drizzle)
    const trucks = await ctx.db
      .select({
        id: locations.id,
        code: locations.code,
        name: locations.name,
        plate: locations.plate,
        assignedUserId: locations.assignedUserId,
        assignedUserName: users.name,
      })
      .from(locations)
      .leftJoin(users, eq(locations.assignedUserId, users.id))
      .where(and(eq(locations.type, 'truck'), eq(locations.active, true)));

    const locationIds = trucks.map((t) => t.id);

    if (locationIds.length === 0) return [];

    const [stockByLocation, lowByLocation] = await Promise.all([
      ctx.db
        .select({
          locationId: stockLevels.locationId,
          totalItems: sql<number>`cast(sum(${stockLevels.quantity}) as integer)`,
          distinctSkus: sql<number>`cast(count(distinct ${stockLevels.articleId}) as integer)`,
        })
        .from(stockLevels)
        .where(inArray(stockLevels.locationId, locationIds))
        .groupBy(stockLevels.locationId),

      ctx.db
        .select({
          locationId: stockLevels.locationId,
          lowCount: sql<number>`cast(count(*) as integer)`,
        })
        .from(stockLevels)
        .innerJoin(articles, eq(stockLevels.articleId, articles.id))
        .where(
          and(
            inArray(stockLevels.locationId, locationIds),
            lte(stockLevels.quantity, articles.reorderPoint),
          ),
        )
        .groupBy(stockLevels.locationId),
    ]);

    return trucks.map((t) => {
      const stock = stockByLocation.find((s) => s.locationId === t.id);
      const low = lowByLocation.find((l) => l.locationId === t.id);
      return {
        id: t.id,
        code: t.code,
        name: t.name,
        plate: t.plate,
        assignedUser: t.assignedUserId
          ? { id: t.assignedUserId, name: t.assignedUserName ?? '' }
          : null,
        totalItems: stock?.totalItems ?? 0,
        distinctSkus: stock?.distinctSkus ?? 0,
        lowCount: low?.lowCount ?? 0,
      };
    });
  }),

  getMovementHistory: managerProcedure.query(async ({ ctx }) => {
    // Build an array of the last 14 days (oldest → newest)
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (13 - i));
      return d;
    });

    const rangeStart = days[0]!;
    const rangeEnd   = new Date();

    const rows = await ctx.db
      .select({
        day:  sql<string>`date_trunc('day', ${stockMovements.createdAt})::date::text`,
        type: stockMovements.movementType,
        cnt:  count(),
      })
      .from(stockMovements)
      .where(
        and(
          isNull(stockMovements.voidedAt),
          gte(stockMovements.createdAt, rangeStart),
          lte(stockMovements.createdAt, rangeEnd),
        ),
      )
      .groupBy(
        sql`date_trunc('day', ${stockMovements.createdAt})::date`,
        stockMovements.movementType,
      );

    const ENTRY_TYPES = new Set(['restock', 'initial', 'return']);
    const EXIT_TYPES  = new Set(['consumption', 'transfer_out']);

    // Aggregate per day
    const byDay = new Map<string, { entries: number; exits: number }>();
    for (const row of rows) {
      const key = row.day; // 'YYYY-MM-DD'
      const cur = byDay.get(key) ?? { entries: 0, exits: 0 };
      if (ENTRY_TYPES.has(row.type)) cur.entries += row.cnt;
      if (EXIT_TYPES.has(row.type))  cur.exits   += row.cnt;
      byDay.set(key, cur);
    }

    const labels:  string[] = [];
    const entries: number[] = [];
    const exits:   number[] = [];

    for (const d of days) {
      // Build key matching what Postgres returns: 'YYYY-MM-DD'
      const key = d.toISOString().slice(0, 10);
      const agg = byDay.get(key) ?? { entries: 0, exits: 0 };
      labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
      entries.push(agg.entries);
      exits.push(agg.exits);
    }

    return { labels, entries, exits };
  }),

  getTruckInventory: protectedProcedure.input(idSchema).query(async ({ ctx, input }) => {
    const rows = await ctx.db
      .select({
        articleId: stockLevels.articleId,
        sku: articles.sku,
        barcode: articles.barcode,
        name: articles.name,
        unit: articles.unit,
        categoryId: articles.categoryId,
        quantity: stockLevels.quantity,
        reservedQuantity: stockLevels.reservedQuantity,
        minStock: articles.minStock,
        reorderPoint: articles.reorderPoint,
        costPriceCents: articles.costPriceCents,
        refrigerantType: articles.refrigerantType,
      })
      .from(stockLevels)
      .innerJoin(articles, eq(stockLevels.articleId, articles.id))
      .where(and(eq(stockLevels.locationId, input.id), eq(articles.active, true)))
      .orderBy(articles.name);

    return rows;
  }),
});
