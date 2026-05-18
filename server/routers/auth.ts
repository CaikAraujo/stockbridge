import { TRPCError } from '@trpc/server';
import { protectedProcedure, publicProcedure } from '@/server/procedures';
import { router } from '@/server/trpc';

export const authRouter = router({
  getSession: publicProcedure.query(({ ctx }) => {
    return ctx.session;
  }),

  getMe: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, ctx.user.id),
      columns: {
        id: true,
        name: true,
        email: true,
        role: true,
        defaultLocationId: true,
        active: true,
        lastLoginAt: true,
        pinHash: false,
        totpSecret: false,
      },
    });

    if (!user) throw new TRPCError({ code: 'NOT_FOUND' });
    return user;
  }),
});
