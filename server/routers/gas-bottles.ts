import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { articles, gasBottles, stockLevels } from '@/db/schema';
import { adminProcedure, managerProcedure } from '@/server/procedures';
import { router } from '@/server/trpc';

/**
 * Normaliza codigo de gas para matching.
 * "Gaz R32" -> "R32", "R-404A" -> "R404A"
 */
export function normalizeGasCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/GAZ\s*/i, '')
    .replace(/[^A-Z0-9]/g, '');
}

export const gasBottlesRouter = router({
  list: managerProcedure.query(async ({ ctx }) => {
    return ctx.db.query.gasBottles.findMany({
      with: {
        location: { columns: { id: true, name: true, code: true, type: true } },
      },
      orderBy: (b, { asc }) => asc(b.name),
    });
  }),

  create: adminProcedure
    .input(
      z.object({
        idempotencyKey: z.string().uuid(),
        name: z.string().min(1).max(100),
        reference: z.string().min(1).max(50),
        gasTypeCode: z.string().min(1).max(20),
        initialWeightKg: z.number().positive(),
        locationId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.gasBottles.findFirst({
        where: (b, { eq: eqFn }) => eqFn(b.reference, input.reference),
        columns: { id: true },
      });
      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `Referencia "${input.reference}" ja existe`,
        });
      }

      const sku = `GAZ-${input.reference.toUpperCase().replace(/[^A-Z0-9]/g, '-')}`;
      const [article] = await ctx.db
        .insert(articles)
        .values({
          sku,
          name: `${input.name} (REF: ${input.reference})`,
          unit: 'un',
          active: true,
          minStock: '0',
          reorderPoint: '0',
        })
        .returning({ id: articles.id });

      if (!article) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      const [bottle] = await ctx.db
        .insert(gasBottles)
        .values({
          name: input.name,
          reference: input.reference,
          gasTypeCode: normalizeGasCode(input.gasTypeCode),
          initialWeightKg: String(input.initialWeightKg),
          currentWeightKg: String(input.initialWeightKg),
          status: 'available',
          locationId: input.locationId ?? null,
          articleId: article.id,
          createdBy: ctx.user.id,
        })
        .returning();

      if (!bottle) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      if (input.locationId) {
        await ctx.db
          .insert(stockLevels)
          .values({
            articleId: article.id,
            locationId: input.locationId,
            quantity: '1',
          })
          .onConflictDoNothing();
      }

      return bottle;
    }),

  delete: adminProcedure
    .input(
      z.object({
        idempotencyKey: z.string().uuid(),
        bottleId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const bottle = await ctx.db.query.gasBottles.findFirst({
        where: (b, { eq: eqFn }) => eqFn(b.id, input.bottleId),
        columns: { id: true, articleId: true },
      });
      if (!bottle) throw new TRPCError({ code: 'NOT_FOUND' });

      await ctx.db.delete(gasBottles).where(eq(gasBottles.id, input.bottleId));

      if (bottle.articleId) {
        await ctx.db
          .update(articles)
          .set({ active: false })
          .where(eq(articles.id, bottle.articleId));
      }

      return { success: true };
    }),
});
