import { TRPCError } from '@trpc/server';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import { z } from 'zod';
import { articles, companySettings, purchaseOrderItems, purchaseOrders, suppliers } from '@/db/schema';
import type { DB } from '@/db/client';
import { idSchema } from '@/lib/schemas/common';
import {
  emailTemplateSchema,
  purchaseOrderCreateSchema,
  purchaseOrderListSchema,
  purchaseOrderUpdateStatusSchema,
} from '@/lib/schemas/purchase-orders';
import { adminProcedure, managerProcedure, protectedProcedure } from '@/server/procedures';
import { countCriticalArticles } from '@/server/routers/dashboard';
import { router } from '@/server/trpc';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTx = PgTransaction<NodePgQueryResultHKT, any, any>;

/**
 * Gera referência CMD-YYYYMMDD-XXX de forma atómica.
 *
 * Advisory lock PostgreSQL (pg_advisory_xact_lock) garante exclusão mútua
 * dentro da transação sem lock de tabela. O número fixo é um hash do prefixo
 * "CMD_SEQ" — sem risco de colisão com outros advisory locks do sistema.
 *
 * DEVE ser chamado dentro de uma transação activa (tx, não db).
 */
async function generateReferenceTx(tx: AnyTx): Promise<string> {
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const datePart = `${today.getFullYear()}${pad(today.getMonth() + 1)}${pad(today.getDate())}`;
  const prefix = `CMD-${datePart}-`;

  // Adquire advisory lock exclusivo para geração de referências.
  // 7358965 = hash arbitrário fixo para 'CMD_REFERENCE_SEQ'.
  await tx.execute(sql`SELECT pg_advisory_xact_lock(7358965)`);

  const result = await tx.execute<{ total: string }>(
    sql`SELECT COUNT(*) AS total FROM purchase_orders WHERE reference LIKE ${prefix + '%'}`,
  );
  const seq = Number(result.rows[0]?.total ?? 0) + 1;
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

export const purchaseOrdersRouter = router({
  list: protectedProcedure.input(purchaseOrderListSchema).query(async ({ ctx, input }) => {
    const { page, limit, supplierId, status } = input;
    const offset = (page - 1) * limit;

    const where = and(
      supplierId ? eq(purchaseOrders.supplierId, supplierId) : undefined,
      status ? eq(purchaseOrders.status, status) : undefined,
    );

    const [rows, [countRow]] = await Promise.all([
      ctx.db
        .select({
          id: purchaseOrders.id,
          reference: purchaseOrders.reference,
          status: purchaseOrders.status,
          supplierId: purchaseOrders.supplierId,
          supplierName: suppliers.name,
          supplierEmail: suppliers.email,
          createdAt: purchaseOrders.createdAt,
          sentAt: purchaseOrders.sentAt,
          itemCount: sql<number>`cast(count(${purchaseOrderItems.id}) as integer)`,
        })
        .from(purchaseOrders)
        .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
        .leftJoin(purchaseOrderItems, eq(purchaseOrderItems.purchaseOrderId, purchaseOrders.id))
        .where(where)
        .groupBy(purchaseOrders.id, suppliers.id)
        .orderBy(desc(purchaseOrders.createdAt))
        .limit(limit)
        .offset(offset),
      ctx.db.select({ total: count() }).from(purchaseOrders).where(where),
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
    const order = await ctx.db.query.purchaseOrders.findFirst({
      where: (po, { eq }) => eq(po.id, input.id),
    });
    if (!order) throw new TRPCError({ code: 'NOT_FOUND' });

    const [supplier, items] = await Promise.all([
      ctx.db.query.suppliers.findFirst({
        where: (s, { eq }) => eq(s.id, order.supplierId),
      }),
      ctx.db
        .select({
          id: purchaseOrderItems.id,
          articleId: purchaseOrderItems.articleId,
          articleSku: articles.sku,
          articleName: articles.name,
          articleUnit: articles.unit,
          quantity: purchaseOrderItems.quantity,
          unitCostSnapshot: purchaseOrderItems.unitCostSnapshot,
        })
        .from(purchaseOrderItems)
        .innerJoin(articles, eq(purchaseOrderItems.articleId, articles.id))
        .where(eq(purchaseOrderItems.purchaseOrderId, order.id)),
    ]);

    return { ...order, supplier, items };
  }),

  create: managerProcedure
    .input(purchaseOrderCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const { idempotencyKey: _k, supplierId, emailSubject, emailBody, message, items } = input;

      const supplier = await ctx.db.query.suppliers.findFirst({
        where: (s, { eq, and }) => and(eq(s.id, supplierId), eq(s.active, true)),
        columns: { id: true },
      });
      if (!supplier) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Fournisseur introuvable ou inactif' });
      }

      const [order] = await ctx.db.transaction(async (tx) => {
        // Advisory lock + count dentro da mesma transação — sem race condition
        const reference = await generateReferenceTx(tx);

        const inserted = await tx
          .insert(purchaseOrders)
          .values({
            reference,
            supplierId,
            emailSubject,
            emailBody,
            message: message ?? null,
            createdBy: ctx.session!.user.id,
          })
          .returning();

        const order = inserted[0];
        if (!order) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

        if (items.length > 0) {
          await tx.insert(purchaseOrderItems).values(
            items.map((item) => ({
              purchaseOrderId: order.id,
              articleId: item.articleId,
              quantity: item.quantity,
              unitCostSnapshot: item.unitCostSnapshot?.toString() ?? null,
            })),
          );
        }

        return inserted;
      });

      return order!;
    }),

  updateStatus: managerProcedure
    .input(purchaseOrderUpdateStatusSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, status, idempotencyKey: _k } = input;

      const existing = await ctx.db.query.purchaseOrders.findFirst({
        where: (po, { eq }) => eq(po.id, id),
        columns: { id: true, status: true },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });

      const [updated] = await ctx.db
        .update(purchaseOrders)
        .set({
          status,
          sentAt: status === 'sent' ? new Date() : undefined,
          updatedAt: new Date(),
        })
        .where(eq(purchaseOrders.id, id))
        .returning();

      return updated!;
    }),

  getEmailTemplate: protectedProcedure.query(async ({ ctx }) => {
    const settings = await ctx.db.query.companySettings.findFirst({
      columns: {
        emailTemplateSubject: true,
        emailTemplateGreeting: true,
        emailTemplateBody: true,
        emailTemplateFooter: true,
        name: true,
      },
    });
    return settings ?? null;
  }),

  saveEmailTemplate: adminProcedure
    .input(emailTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      const { idempotencyKey: _k, ...data } = input;

      const existing = await ctx.db.query.companySettings.findFirst({
        columns: { id: true },
      });
      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Paramètres entreprise introuvables',
        });
      }

      const [updated] = await ctx.db
        .update(companySettings)
        .set({ ...data, updatedAt: new Date() })
        .returning();

      return updated!;
    }),

  /** Artigos críticos: quantity <= minStock no depósito central */
  getCriticalArticles: protectedProcedure.query(async ({ ctx }) => {
    type CriticalRow = {
      id: string;
      sku: string;
      name: string;
      unit: string;
      current_qty: string;
      min_stock: string;
      supplier_id: string | null;
      supplier_name: string | null;
    };
    const result = await ctx.db.execute<CriticalRow>(sql`
      SELECT
        a.id,
        a.sku,
        a.name,
        a.unit,
        COALESCE(sl.quantity, 0) AS current_qty,
        a.min_stock,
        s.id AS supplier_id,
        s.name AS supplier_name
      FROM articles a
      LEFT JOIN stock_levels sl
        ON sl.article_id = a.id
        AND sl.location_id = (
          SELECT id FROM locations WHERE type = 'warehouse' AND active = true LIMIT 1
        )
      LEFT JOIN suppliers s ON s.id = a.supplier_id AND s.active = true
      WHERE a.active = true
        AND COALESCE(sl.quantity, 0) <= a.min_stock
        AND a.min_stock > 0
      ORDER BY (a.min_stock - COALESCE(sl.quantity, 0)) DESC, a.name
    `);
    return result.rows;
  }),

  /** Contador para o dashboard — reutiliza helper partilhado */
  getCriticalCount: protectedProcedure.query(async ({ ctx }) => {
    const total = await countCriticalArticles(ctx.db);
    return { total };
  }),
});
