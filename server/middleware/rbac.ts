import { TRPCError } from '@trpc/server';
import { middleware } from '@/server/trpc';

export const isAuthed = middleware(({ ctx, next }) => {
  if (!ctx.session?.user?.id) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.session.user,
    },
  });
});

export const isAdmin = isAuthed.unstable_pipe(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next({ ctx });
});

export const isManager = isAuthed.unstable_pipe(({ ctx, next }) => {
  if (ctx.user.role !== 'admin' && ctx.user.role !== 'manager') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next({ ctx });
});

export const isAtLeastDriver = isAuthed.unstable_pipe(({ ctx, next }) => {
  if (!['admin', 'manager', 'driver'].includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next({ ctx });
});

// alias para compatibilidade — remover quando PWA tiver role exclusiva
export const isDriver = isAtLeastDriver;
