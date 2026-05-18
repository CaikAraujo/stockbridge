import 'server-only';
import { appRouter } from '@/server/routers/_app';
import { createCallerFactory, createServerContext } from '@/server/trpc';

const createCaller = createCallerFactory(appRouter);

export const createServerClient = async () => {
  const ctx = await createServerContext();
  return createCaller(ctx);
};
