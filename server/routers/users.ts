import { TRPCError } from '@trpc/server';
import * as argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { users } from '@/db/schema';
import { idempotencySchema } from '@/lib/schemas/common';
import {
  setPinSchema,
  userCreateSchema,
  userUpdateSchema,
  verifyPinSchema,
} from '@/lib/schemas/users';
import { adminProcedure, driverProcedure } from '@/server/procedures';
import { router } from '@/server/trpc';

export const usersRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.query.users.findMany({
      where: (u, { eq: eqFn }) => eqFn(u.active, true),
      columns: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        defaultLocationId: true,
        active: true,
        lastLoginAt: true,
      },
      orderBy: (u, { asc }) => asc(u.name),
    });
  }),

  create: adminProcedure
    .input(userCreateSchema.merge(idempotencySchema))
    .mutation(async ({ ctx, input }) => {
      const { idempotencyKey: _k, ...data } = input;
      const [user] = await ctx.db.insert(users).values(data).returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
      });
      if (!user) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      return user;
    }),

  update: adminProcedure
    .input(userUpdateSchema.merge(idempotencySchema))
    .mutation(async ({ ctx, input }) => {
      const { id, idempotencyKey: _k, ...data } = input;
      const [user] = await ctx.db
        .update(users)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning({ id: users.id, name: users.name });
      if (!user) throw new TRPCError({ code: 'NOT_FOUND' });
      return user;
    }),

  // Admin define PIN para um motorista
  setPin: adminProcedure
    .input(setPinSchema.merge(idempotencySchema))
    .mutation(async ({ ctx, input }) => {
      const hash = await argon2.hash(input.pin);
      await ctx.db
        .update(users)
        .set({ pinHash: hash, updatedAt: new Date() })
        .where(eq(users.id, input.userId));
      return { success: true };
    }),

  // Motorista verifica próprio PIN antes de ação sensível
  verifyPin: driverProcedure.input(verifyPinSchema).mutation(async ({ ctx, input }) => {
    const user = await ctx.db.query.users.findFirst({
      where: (u, { eq: eqFn }) => eqFn(u.id, ctx.user.id),
      columns: { pinHash: true },
    });

    if (!user?.pinHash) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'PIN não configurado. Contacte o administrador.',
      });
    }

    const valid = await argon2.verify(user.pinHash, input.pin);
    if (!valid) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'PIN incorreto.',
      });
    }

    return { verified: true };
  }),

  deactivate: adminProcedure
    .input(idempotencySchema.extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [user] = await ctx.db
        .update(users)
        .set({ active: false, updatedAt: new Date() })
        .where(eq(users.id, input.id))
        .returning({ id: users.id });
      if (!user) throw new TRPCError({ code: 'NOT_FOUND' });
      return user;
    }),
});
