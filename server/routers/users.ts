import { TRPCError } from '@trpc/server';
import * as argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { Resend } from 'resend';
import { z } from 'zod';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { idempotencySchema } from '@/lib/schemas/common';
import {
  createDriverSchema,
  deleteDriverSchema,
  setPinSchema,
  userCreateSchema,
  userUpdateSchema,
  verifyPinSchema,
} from '@/lib/schemas/users';
import { adminProcedure, driverProcedure } from '@/server/procedures';
import { UserService } from '@/server/services/user.service';
import { router } from '@/server/trpc';

const resend = new Resend(process.env.RESEND_API_KEY);
const userService = new UserService(db);

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

  // Lista caminhões disponíveis (sem motorista atribuído) para o formulário de criação
  availableTrucks: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.query.locations.findMany({
      where: (l, { and: andFn, eq: eqFn, isNull: isNullFn }) =>
        andFn(eqFn(l.type, 'truck'), eqFn(l.active, true), isNullFn(l.assignedUserId)),
      columns: { id: true, name: true, code: true, plate: true },
      orderBy: (l, { asc }) => asc(l.name),
    });
  }),

  createDriver: adminProcedure
    .input(createDriverSchema.merge(idempotencySchema))
    .mutation(async ({ ctx, input }) => {
      const { idempotencyKey: _k, ...data } = input;
      const user = await userService.createDriver({ ...data, createdBy: ctx.user.id });

      const baseUrl =
        process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_URL ?? 'http://localhost:3000';

      // Envio best-effort — falha no e-mail não reverte a criação
      await resend.emails
        .send({
          from: process.env.AUTH_EMAIL_FROM ?? 'info@vffroid.ch',
          to: user.email ?? '',
          subject: 'Bem-vindo ao StockBridge',
          html: [
            `<p>Olá <strong>${user.name}</strong>,</p>`,
            `<p>A sua conta de motorista foi criada no StockBridge.</p>`,
            `<p>Para aceder à aplicação, clique no botão abaixo e introduza o seu e-mail para receber o link de acesso.</p>`,
            `<p><a href="${baseUrl}/login" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Aceder ao StockBridge</a></p>`,
            `<p style="color:#6b7280;font-size:12px;">Se não esperava este e-mail, pode ignorá-lo.</p>`,
          ].join(''),
        })
        .catch(() => {
          // Falha silenciosa — e-mail é informativo, não crítico
        });

      return user;
    }),

  deleteDriver: adminProcedure
    .input(deleteDriverSchema.merge(idempotencySchema))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Não é possível excluir a sua própria conta.',
        });
      }
      return userService.deleteDriver({ userId: input.userId });
    }),
});
