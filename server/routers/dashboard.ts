import { and, count, eq, gt, gte, isNull, lte, sql } from 'drizzle-orm';
import { articles, locations, stockLevels, stockMovements, transfers, users } from '@/db/schema';
import { idSchema } from '@/lib/schemas/common';
import { protectedProcedure } from '@/server/procedures';
import { router } from '@/server/trpc';

export const dashboardRouter = router({
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [movementsToday, transfersInTransit, lowStockAlerts] = await Promise.all([
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

      ctx.db
        .select({ total: count() })
        .from(stockLevels)
        .innerJoin(articles, eq(stockLevels.articleId, articles.id))
        .where(
          and(lte(stockLevels.quantity, articles.reorderPoint), gt(stockLevels.quantity, '0')),
        ),
    ]);

    return {
      movementsToday: movementsToday[0]?.total ?? 0,
      transfersInTransit: transfersInTransit[0]?.total ?? 0,
      lowStockAlerts: lowStockAlerts[0]?.total ?? 0,
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
        .where(sql`${stockLevels.locationId} = any(${locationIds})`)
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
            sql`${stockLevels.locationId} = any(${locationIds})`,
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
