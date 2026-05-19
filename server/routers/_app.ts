import { router } from '@/server/trpc';
import { articlesRouter } from './articles';
import { authRouter } from './auth';
import { dashboardRouter } from './dashboard';
import { driversRouter } from './drivers';
import { locationsRouter } from './locations';
import { movementsRouter } from './movements';

export const appRouter = router({
  auth: authRouter,
  articles: articlesRouter,
  locations: locationsRouter,
  movements: movementsRouter,
  dashboard: dashboardRouter,
  drivers: driversRouter,
});

export type AppRouter = typeof appRouter;
