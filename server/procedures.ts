import { withAudit } from '@/server/middleware/audit';
import { withIdempotency } from '@/server/middleware/idempotency';
import { isAdmin, isAuthed, isDriver, isManager } from '@/server/middleware/rbac';
import { procedure } from '@/server/trpc';

// Sem auth — healthcheck, login (mutations proibidas)
export const publicProcedure = procedure;

// Qualquer usuário logado
export const protectedProcedure = procedure.use(isAuthed);

// Apenas admin
export const adminProcedure = procedure.use(isAdmin).use(withIdempotency).use(withAudit);

// Admin ou manager
export const managerProcedure = procedure.use(isManager).use(withIdempotency).use(withAudit);

// Qualquer role (inclui driver) — mutations com idempotência
export const driverProcedure = procedure.use(isDriver).use(withIdempotency).use(withAudit);
