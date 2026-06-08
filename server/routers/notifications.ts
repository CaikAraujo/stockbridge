import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { notifications } from '@/db/schema';
import { adminProcedure, managerProcedure } from '@/server/procedures';
import { router } from '@/server/trpc';

export const notificationsRouter = router({
  list: managerProcedure
    .input(
      z
        .object({
          status: z.enum(['unread', 'resolved']).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const status = input?.status;
      return ctx.db.query.notifications.findMany({
        where: status ? (n, { eq: eqFn }) => eqFn(n.status, status) : undefined,
        orderBy: (n, { desc: descFn }) => descFn(n.createdAt),
        limit: 50,
      });
    }),

  unreadCount: managerProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.query.notifications.findMany({
      where: (n, { eq: eqFn }) => eqFn(n.status, 'unread'),
      columns: { id: true },
    });
    return { count: rows.length };
  }),

  resolve: adminProcedure
    .input(
      z.object({
        idempotencyKey: z.string().uuid(),
        id: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(notifications)
        .set({
          status: 'resolved',
          resolvedAt: new Date(),
          resolvedBy: ctx.user.id,
        })
        .where(eq(notifications.id, input.id));
      return { success: true };
    }),

  delete: adminProcedure
    .input(
      z.object({
        idempotencyKey: z.string().uuid(),
        id: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(notifications).where(eq(notifications.id, input.id));
      return { success: true };
    }),
});
