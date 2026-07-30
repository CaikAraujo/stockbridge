import { router } from '@/server/trpc';
import { articlesRouter } from './articles';
import { authRouter } from './auth';
import { companyRouter } from './company';
import { dashboardRouter } from './dashboard';
import { driversRouter } from './drivers';
import { gasBottlesRouter } from './gas-bottles';
import { locationsRouter } from './locations';
import { movementsRouter } from './movements';
import { notificationsRouter } from './notifications';
import { purchaseOrdersRouter } from './purchase-orders';
import { rapportsRouter } from './rapports';
import { suppliersRouter } from './suppliers';
import { totpRouter } from './totp';
import { usersRouter } from './users';

export const appRouter = router({
  auth: authRouter,
  articles: articlesRouter,
  company: companyRouter,
  locations: locationsRouter,
  movements: movementsRouter,
  dashboard: dashboardRouter,
  drivers: driversRouter,
  gasBottles: gasBottlesRouter,
  notifications: notificationsRouter,
  purchaseOrders: purchaseOrdersRouter,
  rapports: rapportsRouter,
  suppliers: suppliersRouter,
  totp: totpRouter,
  users: usersRouter,
});

export type AppRouter = typeof appRouter;
