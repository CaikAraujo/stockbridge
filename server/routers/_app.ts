import { router } from '@/server/trpc';
import { articlesRouter } from './articles';
import { authRouter } from './auth';
import { dashboardRouter } from './dashboard';
import { driversRouter } from './drivers';
import { gasBottlesRouter } from './gas-bottles';
import { locationsRouter } from './locations';
import { movementsRouter } from './movements';
import { notificationsRouter } from './notifications';
import { rapportsRouter } from './rapports';
import { totpRouter } from './totp';
import { usersRouter } from './users';

export const appRouter = router({
  auth: authRouter,
  articles: articlesRouter,
  locations: locationsRouter,
  movements: movementsRouter,
  dashboard: dashboardRouter,
  drivers: driversRouter,
  gasBottles: gasBottlesRouter,
  notifications: notificationsRouter,
  rapports: rapportsRouter,
  totp: totpRouter,
  users: usersRouter,
});

export type AppRouter = typeof appRouter;
