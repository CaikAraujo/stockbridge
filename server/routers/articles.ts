import { TRPCError } from '@trpc/server';
import { and, count, eq, ilike } from 'drizzle-orm';
import { DatabaseError } from 'pg';
import { z } from 'zod';
import { articles } from '@/db/schema';
import {
  articleCreateSchema,
  articleListSchema,
  articleUpdateSchema,
} from '@/lib/schemas/articles';
import { idSchema } from '@/lib/schemas/common';
import { adminProcedure, managerProcedure, protectedProcedure } from '@/server/procedures';
import { router } from '@/server/trpc';

export const articlesRouter = router({
  list: protectedProcedure.input(articleListSchema).query(async ({ ctx, input }) => {
    const { page, limit, search, categoryId, active } = input;
    const offset = (page - 1) * limit;

    const escaped = search?.replace(/[\\%_]/g, (m) => `\\${m}`);
    const where = and(
      eq(articles.active, active),
      escaped ? ilike(articles.name, `%${escaped}%`) : undefined,
      categoryId ? eq(articles.categoryId, categoryId) : undefined,
    );

    const [rows, [countRow]] = await Promise.all([
      ctx.db
        .select()
        .from(articles)
        .where(where)
        .orderBy(articles.name, articles.id)
        .limit(limit)
        .offset(offset),
      ctx.db.select({ total: count() }).from(articles).where(where),
    ]);

    return {
      items: rows,
      total: countRow?.total ?? 0,
      page,
      limit,
      totalPages: Math.ceil((countRow?.total ?? 0) / limit),
    };
  }),

  getById: protectedProcedure.input(idSchema).query(async ({ ctx, input }) => {
    const article = await ctx.db.query.articles.findFirst({
      where: (a, { eq }) => eq(a.id, input.id),
    });
    if (!article) throw new TRPCError({ code: 'NOT_FOUND' });
    return article;
  }),

  create: managerProcedure.input(articleCreateSchema).mutation(async ({ ctx, input }) => {
    const { idempotencyKey: _idem, ...data } = input;
    try {
      const [article] = await ctx.db.insert(articles).values(data).returning();
      if (!article) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      return article;
    } catch (err) {
      if (err instanceof DatabaseError && err.code === '23505') {
        throw new TRPCError({ code: 'CONFLICT', message: 'SKU or barcode already exists' });
      }
      throw err;
    }
  }),

  update: managerProcedure.input(articleUpdateSchema).mutation(async ({ ctx, input }) => {
    const { id, idempotencyKey: _idem, ...data } = input;
    const [article] = await ctx.db
      .update(articles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(articles.id, id))
      .returning();
    if (!article) throw new TRPCError({ code: 'NOT_FOUND' });
    return article;
  }),

  archive: adminProcedure.input(idSchema).mutation(async ({ ctx, input }) => {
    const [article] = await ctx.db
      .update(articles)
      .set({ active: false, archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(articles.id, input.id))
      .returning();
    if (!article) throw new TRPCError({ code: 'NOT_FOUND' });
    return article;
  }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(articles)
        .set({ active: false, updatedAt: new Date() })
        .where(eq(articles.id, input.id));
      return { success: true };
    }),
});
