import { TRPCError } from '@trpc/server';
import { and, desc, eq, gte, isNull, lte } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { articles, locations, stockMovements, users } from '@/db/schema';
import { idempotencySchema } from '@/lib/schemas/common';
import { recentActivitySchema } from '@/lib/schemas/movements';
import {
  adminProcedure,
  driverProcedure,
  managerProcedure,
  protectedProcedure,
} from '@/server/procedures';
import { StockMovementService } from '@/server/services/stock-movement.service';
import { router } from '@/server/trpc';

const movementService = new StockMovementService(db);

export const movementsRouter = router({
  // Atividade recente (dashboard)
  recentActivity: protectedProcedure.input(recentActivitySchema).query(async ({ ctx, input }) => {
    if (ctx.user.role === 'driver') {
      const myTruck = await ctx.db.query.locations.findFirst({
        where: (l, { eq }) => eq(l.assignedUserId, ctx.user.id),
        columns: { id: true },
      });
      if (!myTruck) return [];
      if (input.locationId && input.locationId !== myTruck.id) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      input = { ...input, locationId: myTruck.id };
    }

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

  // Lista filtrável (manager+)
  list: managerProcedure
    .input(
      z.object({
        locationId: z.string().uuid().optional(),
        createdBy: z.string().uuid().optional(),
        type: z
          .enum([
            'consumption',
            'restock',
            'transfer_out',
            'transfer_in',
            'adjustment',
            'initial',
            'return',
          ])
          .optional(),
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
        page: z.number().int().positive().default(1),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const offset = (input.page - 1) * input.limit;
      const where = and(
        input.locationId ? eq(stockMovements.locationId, input.locationId) : undefined,
        input.createdBy ? eq(stockMovements.createdBy, input.createdBy) : undefined,
        input.type ? eq(stockMovements.movementType, input.type) : undefined,
        input.from ? gte(stockMovements.createdAt, input.from) : undefined,
        input.to ? lte(stockMovements.createdAt, input.to) : undefined,
      );

      const rows = await ctx.db
        .select({
          id: stockMovements.id,
          movementType: stockMovements.movementType,
          quantityDelta: stockMovements.quantityDelta,
          createdAt: stockMovements.createdAt,
          voidedAt: stockMovements.voidedAt,
          unitCostCents: stockMovements.unitCostCents,
          reason: stockMovements.reason,
          notes: stockMovements.notes,
          articleName: articles.name,
          articleSku: articles.sku,
          articleUnit: articles.unit,
          locationName: locations.name,
          locationCode: locations.code,
          createdByName: users.name,
        })
        .from(stockMovements)
        .innerJoin(articles, eq(stockMovements.articleId, articles.id))
        .innerJoin(locations, eq(stockMovements.locationId, locations.id))
        .innerJoin(users, eq(stockMovements.createdBy, users.id))
        .where(where)
        .orderBy(desc(stockMovements.createdAt))
        .limit(input.limit)
        .offset(offset);

      return rows;
    }),

  // Retirada: Depósito → Caminhão (driver self-service)
  withdraw: driverProcedure
    .input(
      z
        .object({
          articleId: z.string().uuid(),
          quantity: z.number().positive(),
          fromLocationId: z.string().uuid(),
          toLocationId: z.string().uuid(),
          notes: z.string().max(300).optional(),
        })
        .merge(idempotencySchema),
    )
    .mutation(async ({ ctx, input }) => {
      const [from, to] = await Promise.all([
        ctx.db.query.locations.findFirst({
          where: (l, { eq }) => eq(l.id, input.fromLocationId),
          columns: { id: true, type: true, assignedUserId: true, active: true },
        }),
        ctx.db.query.locations.findFirst({
          where: (l, { eq }) => eq(l.id, input.toLocationId),
          columns: { id: true, type: true, assignedUserId: true, active: true },
        }),
      ]);
      if (!from?.active || !to?.active) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Location inválida' });
      }
      if (ctx.user.role === 'driver') {
        const isWithdraw =
          from.type === 'warehouse' && to.type === 'truck' && to.assignedUserId === ctx.user.id;
        const isReturn =
          from.type === 'truck' && from.assignedUserId === ctx.user.id && to.type === 'warehouse';
        if (!isWithdraw && !isReturn) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Motorista só transfere entre o depósito e o próprio caminhão',
          });
        }
      }

      return movementService.createWithdrawal({
        ...input,
        createdBy: ctx.user.id,
      });
    }),

  // Devolução: Caminhão → Depósito (driver self-service)
  return: driverProcedure
    .input(
      z
        .object({
          articleId: z.string().uuid(),
          quantity: z.number().positive(),
          fromLocationId: z.string().uuid(),
          toLocationId: z.string().uuid(),
          notes: z.string().max(300).optional(),
        })
        .merge(idempotencySchema),
    )
    .mutation(async ({ ctx, input }) => {
      const [from, to] = await Promise.all([
        ctx.db.query.locations.findFirst({
          where: (l, { eq }) => eq(l.id, input.fromLocationId),
          columns: { id: true, type: true, assignedUserId: true, active: true },
        }),
        ctx.db.query.locations.findFirst({
          where: (l, { eq }) => eq(l.id, input.toLocationId),
          columns: { id: true, type: true, assignedUserId: true, active: true },
        }),
      ]);
      if (!from?.active || !to?.active) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Location inválida' });
      }
      if (ctx.user.role === 'driver') {
        const isWithdraw =
          from.type === 'warehouse' && to.type === 'truck' && to.assignedUserId === ctx.user.id;
        const isReturn =
          from.type === 'truck' && from.assignedUserId === ctx.user.id && to.type === 'warehouse';
        if (!isWithdraw && !isReturn) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Motorista só transfere entre o depósito e o próprio caminhão',
          });
        }
      }

      return movementService.createReturn({
        ...input,
        createdBy: ctx.user.id,
      });
    }),

  // Void (admin)
  void: adminProcedure
    .input(
      z
        .object({
          movementId: z.string().uuid(),
          voidReason: z.string().min(5).max(300),
        })
        .merge(idempotencySchema),
    )
    .mutation(async ({ ctx, input }) => {
      return movementService.voidMovement({
        movementId: input.movementId,
        voidedBy: ctx.user.id,
        voidReason: input.voidReason,
      });
    }),
});
