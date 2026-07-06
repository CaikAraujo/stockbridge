import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { companySettings } from '@/db/schema';
import { idempotencySchema } from '@/lib/schemas/common';
import { adminProcedure, protectedProcedure } from '@/server/procedures';
import { router } from '@/server/trpc';

const segmentEnum = z.enum([
  'refrigeracao',
  'hvac',
  'eletrica',
  'climatizacao',
  'outro',
]);

const onboardingInput = z.object({
  name: z.string().min(2).max(100),
  segment: segmentEnum,
  country: z.string().default('CH'),
  city: z.string().optional(),
  phone: z.string().optional(),
  taxId: z.string().optional(),
  employeeCount: z.number().int().min(1).max(500).optional(),
  vehicleCount: z.number().int().min(1).max(100).optional(),
  contactEmail: z.string().email().optional(),
});

const updateInput = onboardingInput.partial().extend({
  name: z.string().min(2).max(100).optional(),
  segment: segmentEnum.optional(),
});

export const companyRouter = router({
  getSettings: protectedProcedure.query(async ({ ctx }) => {
    const row = await ctx.db.query.companySettings.findFirst();
    return row ?? null;
  }),

  saveOnboarding: adminProcedure
    .input(onboardingInput.merge(idempotencySchema))
    .mutation(async ({ ctx, input }) => {
      const { idempotencyKey: _k, ...data } = input;

      const existing = await ctx.db.query.companySettings.findFirst({
        columns: { id: true, onboardingCompletedAt: true },
      });

      if (existing) {
        const [updated] = await ctx.db
          .update(companySettings)
          .set({
            ...data,
            updatedAt: new Date(),
          })
          .returning();
        if (!updated) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
        return updated;
      }

      const [created] = await ctx.db
        .insert(companySettings)
        .values({
          ...data,
          onboardingCompletedAt: new Date(),
        })
        .returning();
      if (!created) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      return created;
    }),

  updateSettings: adminProcedure
    .input(updateInput.merge(idempotencySchema))
    .mutation(async ({ ctx, input }) => {
      const { idempotencyKey: _k, ...data } = input;

      const existing = await ctx.db.query.companySettings.findFirst({
        columns: { id: true },
      });
      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Configurações da empresa não encontradas. Complete o onboarding primeiro.',
        });
      }

      const [updated] = await ctx.db
        .update(companySettings)
        .set({ ...data, updatedAt: new Date() })
        .returning();
      if (!updated) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      return updated;
    }),
});
