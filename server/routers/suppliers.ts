import { TRPCError } from '@trpc/server';
import { and, count, eq, ilike, inArray, or } from 'drizzle-orm';
import { z } from 'zod';
import { articles, suppliers } from '@/db/schema';
import { idSchema } from '@/lib/schemas/common';
import {
  supplierBulkAssignSchema,
  supplierCreateSchema,
  supplierListSchema,
  supplierToggleActiveSchema,
  supplierUpdateSchema,
} from '@/lib/schemas/suppliers';
import { adminProcedure, managerProcedure, protectedProcedure } from '@/server/procedures';
import { router } from '@/server/trpc';

export const suppliersRouter = router({
  list: protectedProcedure.input(supplierListSchema).query(async ({ ctx, input }) => {
    const { page, limit, search, includeInactive } = input;
    const offset = (page - 1) * limit;

    const escaped = search?.replace(/[\\%_]/g, (m) => `\\${m}`);
    const where = and(
      includeInactive ? undefined : eq(suppliers.active, true),
      escaped
        ? or(
            ilike(suppliers.name, `%${escaped}%`),
            ilike(suppliers.email, `%${escaped}%`),
            ilike(suppliers.contactName, `%${escaped}%`),
          )
        : undefined,
    );

    const [rows, [countRow]] = await Promise.all([
      ctx.db
        .select()
        .from(suppliers)
        .where(where)
        .orderBy(suppliers.name, suppliers.id)
        .limit(limit)
        .offset(offset),
      ctx.db.select({ total: count() }).from(suppliers).where(where),
    ]);

    // Article count per supplier
    const ids = rows.map((s) => s.id);
    const articleCounts =
      ids.length > 0
        ? await ctx.db
            .select({
              supplierId: articles.supplierId,
              total: count(),
            })
            .from(articles)
            .where(and(inArray(articles.supplierId, ids), eq(articles.active, true)))
            .groupBy(articles.supplierId)
        : [];

    const countMap = new Map(articleCounts.map((r) => [r.supplierId, r.total]));

    return {
      items: rows.map((s) => ({ ...s, articleCount: countMap.get(s.id) ?? 0 })),
      total: countRow?.total ?? 0,
      page,
      limit,
      totalPages: Math.ceil((countRow?.total ?? 0) / limit),
    };
  }),

  listActive: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({ id: suppliers.id, name: suppliers.name, email: suppliers.email, contactName: suppliers.contactName })
      .from(suppliers)
      .where(eq(suppliers.active, true))
      .orderBy(suppliers.name);
  }),

  getById: protectedProcedure.input(idSchema).query(async ({ ctx, input }) => {
    const supplier = await ctx.db.query.suppliers.findFirst({
      where: (s, { eq }) => eq(s.id, input.id),
    });
    if (!supplier) throw new TRPCError({ code: 'NOT_FOUND' });
    return supplier;
  }),

  create: managerProcedure.input(supplierCreateSchema).mutation(async ({ ctx, input }) => {
    const { idempotencyKey: _k, ...data } = input;
    const [supplier] = await ctx.db
      .insert(suppliers)
      .values({
        ...data,
        email: data.email || null,
      })
      .returning();
    if (!supplier) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
    return supplier;
  }),

  update: managerProcedure.input(supplierUpdateSchema).mutation(async ({ ctx, input }) => {
    const { id, idempotencyKey: _k, ...data } = input;
    const [supplier] = await ctx.db
      .update(suppliers)
      .set({ ...data, email: data.email || null, updatedAt: new Date() })
      .where(eq(suppliers.id, id))
      .returning();
    if (!supplier) throw new TRPCError({ code: 'NOT_FOUND' });
    return supplier;
  }),

  toggleActive: adminProcedure
    .input(supplierToggleActiveSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, active, idempotencyKey: _k } = input;
      const [supplier] = await ctx.db
        .update(suppliers)
        .set({ active, updatedAt: new Date() })
        .where(eq(suppliers.id, id))
        .returning();
      if (!supplier) throw new TRPCError({ code: 'NOT_FOUND' });
      return supplier;
    }),

  bulkAssignToArticles: managerProcedure
    .input(supplierBulkAssignSchema)
    .mutation(async ({ ctx, input }) => {
      const { articleIds, supplierId, idempotencyKey: _k } = input;

      if (supplierId) {
        const exists = await ctx.db.query.suppliers.findFirst({
          where: (s, { eq, and }) => and(eq(s.id, supplierId), eq(s.active, true)),
          columns: { id: true },
        });
        if (!exists) throw new TRPCError({ code: 'NOT_FOUND', message: 'Fournisseur introuvable' });
      }

      await ctx.db
        .update(articles)
        .set({ supplierId: supplierId ?? null, updatedAt: new Date() })
        .where(inArray(articles.id, articleIds));

      return { updated: articleIds.length };
    }),

  getLinkedArticleCount: protectedProcedure
    .input(z.object({ supplierId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({ total: count() })
        .from(articles)
        .where(and(eq(articles.supplierId, input.supplierId), eq(articles.active, true)));
      return { total: row?.total ?? 0 };
    }),
});
