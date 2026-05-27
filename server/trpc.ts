import 'server-only';
import { initTRPC } from '@trpc/server';
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import { cookies } from 'next/headers';
import superjson from 'superjson';
import { db } from '@/db/client';
import { auth } from '@/lib/auth/config';

export const createContext = async (opts: FetchCreateContextFnOptions) => {
  const session = await auth();
  const xff = opts.req.headers.get('x-forwarded-for');
  const ip = xff?.split(',')[0]?.trim() ?? opts.req.headers.get('x-real-ip') ?? 'unknown';
  const userAgent = opts.req.headers.get('user-agent') ?? 'unknown';

  const cookieStore = await cookies();
  const sessionToken =
    cookieStore.get('authjs.session-token')?.value ??
    cookieStore.get('__Secure-authjs.session-token')?.value ??
    null;

  return { db, session, ip, userAgent, sessionToken };
};

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    if (process.env.NODE_ENV === 'production' && error.code === 'INTERNAL_SERVER_ERROR') {
      return { ...shape, message: 'Internal server error' };
    }
    return shape;
  },
});

export const createServerContext = async () => {
  const session = await auth();
  return { db, session, ip: 'server', userAgent: 'server', sessionToken: null };
};

export const router = t.router;
export const middleware = t.middleware;
export const procedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;
