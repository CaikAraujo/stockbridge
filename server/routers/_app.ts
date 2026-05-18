import { router } from '@/server/trpc';
import { articlesRouter } from './articles';
import { authRouter } from './auth';
import { locationsRouter } from './locations';

export const appRouter = router({
  auth: authRouter,
  articles: articlesRouter,
  locations: locationsRouter,
});

export type AppRouter = typeof appRouter;
