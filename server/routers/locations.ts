import { eq } from 'drizzle-orm';
import { articles, locations, stockLevels, users } from '@/db/schema';
import { locationListSchema } from '@/lib/schemas/locations';
import { protectedProcedure } from '@/server/procedures';
import { router } from '@/server/trpc';

export const locationsRouter = router({
  list: protectedProcedure.input(locationListSchema).query(async ({ ctx, input }) => {
    const rows = await ctx.db.query.locations.findMany({
      where: (l, { eq: eqFn, and: andFn }) =>
        andFn(eqFn(l.active, input.active), input.type ? eqFn(l.type, input.type) : undefined),
      with: {
        assignedUser: {
          columns: { id: true, name: true, email: true, role: true },
        },
      },
    });
    return rows;
  }),

  getStock: protectedProcedure
    .input(locationListSchema.pick({ active: true }))
    .query(async ({ ctx }) => {
      const rows = await ctx.db
        .select({
          locationId: stockLevels.locationId,
          locationName: locations.name,
          locationCode: locations.code,
          locationType: locations.type,
          assignedUserName: users.name,
          articleId: stockLevels.articleId,
          articleName: articles.name,
          articleSku: articles.sku,
          articleUnit: articles.unit,
          quantity: stockLevels.quantity,
          reservedQuantity: stockLevels.reservedQuantity,
        })
        .from(stockLevels)
        .innerJoin(locations, eq(stockLevels.locationId, locations.id))
        .innerJoin(articles, eq(stockLevels.articleId, articles.id))
        .leftJoin(users, eq(locations.assignedUserId, users.id))
        .where(eq(locations.active, true));

      return rows;
    }),
});
