import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { rapportImportItems, rapportImports } from '@/db/schema';
import { adminProcedure, managerProcedure } from '@/server/procedures';
import { StockMovementService } from '@/server/services/stock-movement.service';
import { router } from '@/server/trpc';

export const rapportsRouter = router({
  // ─── LIST ────────────────────────────────────────────────────────────────────
  list: managerProcedure
    .input(
      z
        .object({
          status: z.enum(['pending', 'confirmed', 'rejected', 'partial']).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const statusFilter = input?.status ?? undefined;
      return ctx.db.query.rapportImports.findMany({
        where: statusFilter ? (r, { eq: eqFn }) => eqFn(r.status, statusFilter) : undefined,
        with: {
          items: {
            with: {
              article: {
                columns: { id: true, name: true, sku: true, unit: true },
              },
            },
          },
          location: { columns: { id: true, name: true, code: true } },
        },
        orderBy: (r, { desc: descFn }) => descFn(r.createdAt),
        limit: 50,
      });
    }),

  // ─── MAP ITEM ────────────────────────────────────────────────────────────────
  mapItem: adminProcedure
    .input(
      z.object({
        idempotencyKey: z.string().uuid(),
        itemId: z.string().uuid(),
        articleId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(rapportImportItems)
        .set({ articleId: input.articleId, status: 'matched' })
        .where(eq(rapportImportItems.id, input.itemId));
      return { success: true };
    }),

  // ─── IGNORE ITEM ─────────────────────────────────────────────────────────────
  ignoreItem: adminProcedure
    .input(
      z.object({
        idempotencyKey: z.string().uuid(),
        itemId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(rapportImportItems)
        .set({ status: 'ignored' })
        .where(eq(rapportImportItems.id, input.itemId));
      return { success: true };
    }),

  // ─── SET LOCATION ─────────────────────────────────────────────────────────────
  setLocation: adminProcedure
    .input(
      z.object({
        idempotencyKey: z.string().uuid(),
        rapportId: z.string().uuid(),
        locationId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(rapportImports)
        .set({ locationId: input.locationId, updatedAt: new Date() })
        .where(eq(rapportImports.id, input.rapportId));
      return { success: true };
    }),

  // ─── CONFIRM ─────────────────────────────────────────────────────────────────
  confirm: adminProcedure
    .input(
      z.object({
        idempotencyKey: z.string().uuid(),
        rapportId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rapport = await ctx.db.query.rapportImports.findFirst({
        where: (r, { eq: eqFn }) => eqFn(r.id, input.rapportId),
        with: { items: true },
      });

      if (!rapport) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Rapport não encontrado' });
      }
      if (rapport.status !== 'pending' && rapport.status !== 'partial') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Rapport já processado',
        });
      }
      if (!rapport.locationId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Seleciona o caminhão antes de confirmar',
        });
      }

      const service = new StockMovementService(ctx.db);
      let confirmed = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const item of rapport.items) {
        if (item.status === 'confirmed' || item.movementId) {
          skipped++;
          continue;
        }
        if (item.status === 'ignored' || !item.articleId) {
          skipped++;
          continue;
        }

        try {
          const movement = await service.createConsumption({
            articleId: item.articleId,
            locationId: rapport.locationId,
            quantity: parseFloat(item.quantity),
            reason: `Consumo rapport ${rapport.interfastReference ?? rapport.interfastInterventionId}`,
            createdBy: ctx.user.id,
            idempotencyKey: `rapport-item-${item.id}`,
            allowNegative: false,
          });

          await ctx.db
            .update(rapportImportItems)
            .set({ movementId: movement.id, status: 'confirmed' })
            .where(eq(rapportImportItems.id, item.id));

          confirmed++;
        } catch (err) {
          errors.push(
            `Item ${item.description}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      const finalStatus = errors.length > 0 ? 'partial' : 'confirmed';

      await ctx.db
        .update(rapportImports)
        .set({
          status: finalStatus,
          confirmedBy: ctx.user.id,
          confirmedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(rapportImports.id, input.rapportId));

      return { confirmed, skipped, errors };
    }),

  // ─── REJECT ──────────────────────────────────────────────────────────────────
  reject: adminProcedure
    .input(
      z.object({
        idempotencyKey: z.string().uuid(),
        rapportId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const rapport = await ctx.db.query.rapportImports.findFirst({
        where: (r, { eq: eqFn }) => eqFn(r.id, input.rapportId),
        columns: { id: true, status: true },
      });

      if (!rapport) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Rapport não encontrado' });
      }
      if (rapport.status !== 'pending') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Rapport já processado' });
      }

      await ctx.db
        .update(rapportImports)
        .set({
          status: 'rejected',
          confirmedBy: ctx.user.id,
          confirmedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(rapportImports.id, input.rapportId));

      return { success: true };
    }),

  // ─── PROCESS NOW (trigger manual — só para testes/admin) ─────────────────────
  processNow: adminProcedure
    .input(z.object({ idempotencyKey: z.string().uuid() }))
    .mutation(async () => {
      const { processRecentInterventions } = await import('@/lib/rapport-processor');
      return processRecentInterventions(48);
    }),
});
