import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { articles, locations, stockLevels, users } from '@/db/schema';
import { idempotencySchema } from '@/lib/schemas/common';
import { locationListSchema } from '@/lib/schemas/locations';
import { adminProcedure, protectedProcedure } from '@/server/procedures';
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

  assignDriver: adminProcedure
    .input(
      z
        .object({
          locationId: z.string().uuid(),
          userId: z.string().uuid().nullable(),
        })
        .merge(idempotencySchema),
    )
    .mutation(async ({ ctx, input }) => {
      const [loc] = await ctx.db
        .update(locations)
        .set({ assignedUserId: input.userId, updatedAt: new Date() })
        .where(eq(locations.id, input.locationId))
        .returning({ id: locations.id, name: locations.name });
      if (!loc) throw new TRPCError({ code: 'NOT_FOUND' });
      return loc;
    }),
});
