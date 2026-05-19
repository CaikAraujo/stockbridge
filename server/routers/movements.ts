import { and, desc, eq, isNull } from 'drizzle-orm';
import { articles, locations, stockMovements, users } from '@/db/schema';
import { recentActivitySchema } from '@/lib/schemas/movements';
import { protectedProcedure } from '@/server/procedures';
import { router } from '@/server/trpc';

export const movementsRouter = router({
  recentActivity: protectedProcedure.input(recentActivitySchema).query(async ({ ctx, input }) => {
    const rows = await ctx.db
      .select({
        id: stockMovements.id,
        movementType: stockMovements.movementType,
        quantityDelta: stockMovements.quantityDelta,
        createdAt: stockMovements.createdAt,
        unitCostCents: stockMovements.unitCostCents,
        articleName: articles.name,
        articleUnit: articles.unit,
        locationName: locations.name,
        locationCode: locations.code,
        createdByName: users.name,
      })
      .from(stockMovements)
      .innerJoin(articles, eq(stockMovements.articleId, articles.id))
      .innerJoin(locations, eq(stockMovements.locationId, locations.id))
      .innerJoin(users, eq(stockMovements.createdBy, users.id))
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
});
