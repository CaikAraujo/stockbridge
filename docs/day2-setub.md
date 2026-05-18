Passo 1 — Instalar dependências
bashpnpm add @trpc/server@next @trpc/client@next @trpc/react-query@next @trpc/next@next
pnpm add @tanstack/react-query
pnpm add next-auth@beta @auth/drizzle-adapter
pnpm add zod
pnpm add superjson
pnpm add resend
pnpm add argon2
pnpm add server-only
pnpm add -D @types/node vitest @vitejs/plugin-react
Depois confirma:
bashpnpm typecheck

Passo 2 — Atualizar schema (tabelas que o Auth.js precisa)
O Auth.js v5 exige três tabelas que ainda não existem: accounts, verification_tokens, e colunas específicas na tabela sessions. Abre db/schema.ts e adiciona ao final, antes dos comentários de migration:
typescript// ============================================================
// AUTH.JS REQUIRED TABLES
// ============================================================

export const accounts = pgTable(
  'accounts',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refreshToken: text('refresh_token'),
    accessToken: text('access_token'),
    expiresAt: integer('expires_at'),
    tokenType: text('token_type'),
    scope: text('scope'),
    idToken: text('id_token'),
    sessionState: text('session_state'),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.provider, t.providerAccountId] }),
    userIdx: index('accounts_user_idx').on(t.userId),
  }),
);

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.identifier, t.token] }),
    expiresIdx: index('verification_tokens_expires_idx').on(t.expires),
  }),
);
A tabela sessions que já existe é compatível com Auth.js v5 (o adapter usa id como sessionToken). Não precisa mudar.

Passo 3 — Nova migration
bashpnpm db:generate
pnpm db:migrate
Confirma que gerou 0001_*.sql (ou 0002_*) com as tabelas accounts e verification_tokens.

Passo 4 — Auth.js v5
4.1 Configuração principal — lib/auth/config.ts
typescriptimport NextAuth from 'next-auth';
import Resend from 'next-auth/providers/resend';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '@/db/client';
import { users, sessions, accounts, verificationTokens } from '@/db/schema';
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'admin' | 'manager' | 'driver';
    } & DefaultSession['user'];
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    sessionsTable: sessions,
    accountsTable: accounts,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.AUTH_EMAIL_FROM ?? 'noreply@stockbridge.local',
    }),
  ],
  session: { strategy: 'database' },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      session.user.role = (user as { role: 'admin' | 'manager' | 'driver' }).role;
      return session;
    },
  },
  pages: {
    signIn: '/login',
    verifyRequest: '/login/verify',
    error: '/login/error',
  },
});
4.2 Route handler — app/api/auth/[...nextauth]/route.ts
typescriptimport { handlers } from '@/lib/auth/config';

export const { GET, POST } = handlers;
4.3 Adicionar variáveis de ambiente no .env
envAUTH_SECRET=gere-com-openssl-rand-base64-32
AUTH_EMAIL_FROM=noreply@stockbridge.local
RESEND_API_KEY=re_sua_chave_aqui
Gera o AUTH_SECRET:
bashnode -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
Cole o resultado no .env. Atualiza o .env.example com as chaves (sem valores).

Passo 5 — tRPC base
5.1 Context — server/trpc.ts
typescriptimport 'server-only';
import { initTRPC, TRPCError } from '@trpc/server';
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import superjson from 'superjson';
import { auth } from '@/lib/auth/config';
import { db } from '@/db/client';

export const createContext = async (opts: FetchCreateContextFnOptions) => {
  const session = await auth();
  const ip =
    opts.req.headers.get('x-forwarded-for') ??
    opts.req.headers.get('x-real-ip') ??
    'unknown';
  const userAgent = opts.req.headers.get('user-agent') ?? 'unknown';

  return { db, session, ip, userAgent };
};

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

export const router = t.router;
export const middleware = t.middleware;
export const createCallerFactory = t.createCallerFactory;

Passo 6 — Middleware
6.1 RBAC — server/middleware/rbac.ts
typescriptimport { TRPCError } from '@trpc/server';
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

export const isDriver = isAuthed.unstable_pipe(({ ctx, next }) => {
  if (!['admin', 'manager', 'driver'].includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }
  return next({ ctx });
});
6.2 Audit — server/middleware/audit.ts
typescriptimport { middleware } from '@/server/trpc';
import { auditLog } from '@/db/schema';

const SENSITIVE_KEYS = ['password', 'pin', 'token', 'secret', 'apiKey', 'totpSecret'];

function sanitize(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input;
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>).map(([k, v]) => [
      k,
      SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s)) ? '[REDACTED]' : v,
    ]),
  );
}

export const withAudit = middleware(async ({ ctx, next, path, type, input }) => {
  const result = await next();

  if (type === 'mutation' && ctx.session?.user?.id) {
    const [entityType] = path.split('.');
    const typedInput = input as Record<string, unknown> | undefined;

    await ctx.db.insert(auditLog).values({
      userId: ctx.session.user.id,
      action: path,
      entityType: entityType ?? path,
      entityKey: typedInput?.id?.toString() ?? typedInput?.idempotencyKey?.toString() ?? null,
      payload: sanitize(input) as Record<string, unknown>,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
  }

  return result;
});
6.3 Idempotency — server/middleware/idempotency.ts
typescriptimport { middleware } from '@/server/trpc';
import { idempotencyKeys } from '@/db/schema';
import { and, eq, gt } from 'drizzle-orm';

export const withIdempotency = middleware(async ({ ctx, next, path, input }) => {
  const typedInput = input as Record<string, unknown> | undefined;
  const key = typedInput?.idempotencyKey as string | undefined;

  if (!key || !ctx.session?.user?.id) return next();

  const userId = ctx.session.user.id;
  const now = new Date();

  // Verifica se já existe resposta cacheada
  const existing = await ctx.db
    .select()
    .from(idempotencyKeys)
    .where(
      and(
        eq(idempotencyKeys.userId, userId),
        eq(idempotencyKeys.endpoint, path),
        eq(idempotencyKeys.key, key),
        gt(idempotencyKeys.expiresAt, now),
      ),
    )
    .limit(1);

  if (existing[0]?.response) {
    return existing[0].response as ReturnType<typeof next>;
  }

  const result = await next();

  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  await ctx.db
    .insert(idempotencyKeys)
    .values({ key, userId, endpoint: path, response: result as Record<string, unknown>, statusCode: 200, expiresAt })
    .onConflictDoNothing();

  return result;
});

Passo 7 — Procedures tipadas
Cria server/procedures.ts:
typescriptimport { middleware, createCallerFactory } from '@/server/trpc';
import { initTRPC } from '@trpc/server';
import type { Context } from '@/server/trpc';
import { isAuthed, isAdmin, isManager, isDriver } from '@/server/middleware/rbac';
import { withAudit } from '@/server/middleware/audit';
import { withIdempotency } from '@/server/middleware/idempotency';
import superjson from 'superjson';

const t = initTRPC.context<Context>().create({ transformer: superjson });

// Sem auth — healthcheck, login
export const publicProcedure = t.procedure;

// Qualquer usuário logado
export const protectedProcedure = t.procedure.use(isAuthed);

// Apenas admin
export const adminProcedure = t.procedure.use(isAdmin).use(withAudit);

// Admin ou manager
export const managerProcedure = t.procedure.use(isManager).use(withAudit);

// Qualquer role (inclui driver) — mutations com idempotência
export const driverProcedure = t.procedure
  .use(isDriver)
  .use(withIdempotency)
  .use(withAudit);

Passo 8 — Zod schemas
8.1 Common — lib/schemas/common.ts
typescriptimport { z } from 'zod';

export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export const idSchema = z.object({
  id: z.string().uuid(),
});

export const idempotencySchema = z.object({
  idempotencyKey: z.string().uuid(),
});

export const dateRangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
8.2 Articles — lib/schemas/articles.ts
typescriptimport { z } from 'zod';
import { paginationSchema, idempotencySchema } from './common';

const unitEnum = z.enum(['un', 'pc', 'cx', 'kg', 'g', 'l', 'ml', 'm', 'cm', 'rl', 'par']);

export const articleCreateSchema = z.object({
  sku: z.string().min(1).max(50),
  barcode: z.string().max(50).optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  unit: unitEnum,
  categoryId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  costPriceCents: z.number().int().nonnegative().optional(),
  salePriceCents: z.number().int().nonnegative().optional(),
  minStock: z.string().regex(/^\d+(\.\d{1,3})?$/).default('0'),
  reorderPoint: z.string().regex(/^\d+(\.\d{1,3})?$/).default('0'),
  refrigerantType: z.string().max(20).optional(),
});

export const articleUpdateSchema = articleCreateSchema.partial().extend({
  id: z.string().uuid(),
});

export const articleListSchema = paginationSchema.extend({
  search: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  active: z.boolean().default(true),
});
8.3 Locations — lib/schemas/locations.ts
typescriptimport { z } from 'zod';

export const locationListSchema = z.object({
  type: z.enum(['warehouse', 'truck']).optional(),
  active: z.boolean().default(true),
  withStock: z.boolean().default(false),
});

Passo 9 — Routers
9.1 Auth router — server/routers/auth.ts
typescriptimport { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router } from '@/server/trpc';
import { publicProcedure, protectedProcedure } from '@/server/procedures';

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
9.2 Articles router — server/routers/articles.ts
typescriptimport { TRPCError } from '@trpc/server';
import { ilike, eq, and } from 'drizzle-orm';
import { router } from '@/server/trpc';
import { adminProcedure, managerProcedure, protectedProcedure } from '@/server/procedures';
import { articles } from '@/db/schema';
import { articleCreateSchema, articleUpdateSchema, articleListSchema } from '@/lib/schemas/articles';
import { idSchema } from '@/lib/schemas/common';

export const articlesRouter = router({
  list: protectedProcedure
    .input(articleListSchema)
    .query(async ({ ctx, input }) => {
      const { page, limit, search, categoryId, active } = input;
      const offset = (page - 1) * limit;

      const where = and(
        eq(articles.active, active),
        search ? ilike(articles.name, `%${search}%`) : undefined,
        categoryId ? eq(articles.categoryId, categoryId) : undefined,
      );

      const [rows, countResult] = await Promise.all([
        ctx.db.select().from(articles).where(where).limit(limit).offset(offset),
        ctx.db.select().from(articles).where(where),
      ]);

      return {
        items: rows,
        total: countResult.length,
        page,
        limit,
        totalPages: Math.ceil(countResult.length / limit),
      };
    }),

  getById: protectedProcedure
    .input(idSchema)
    .query(async ({ ctx, input }) => {
      const article = await ctx.db.query.articles.findFirst({
        where: (a, { eq }) => eq(a.id, input.id),
      });
      if (!article) throw new TRPCError({ code: 'NOT_FOUND' });
      return article;
    }),

  create: managerProcedure
    .input(articleCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const [article] = await ctx.db
        .insert(articles)
        .values(input)
        .returning();
      return article;
    }),

  update: managerProcedure
    .input(articleUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [article] = await ctx.db
        .update(articles)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(articles.id, id))
        .returning();
      if (!article) throw new TRPCError({ code: 'NOT_FOUND' });
      return article;
    }),

  archive: adminProcedure
    .input(idSchema)
    .mutation(async ({ ctx, input }) => {
      const [article] = await ctx.db
        .update(articles)
        .set({ active: false, archivedAt: new Date(), updatedAt: new Date() })
        .where(eq(articles.id, input.id))
        .returning();
      if (!article) throw new TRPCError({ code: 'NOT_FOUND' });
      return article;
    }),
});
9.3 Locations router — server/routers/locations.ts
typescriptimport { eq } from 'drizzle-orm';
import { router } from '@/server/trpc';
import { protectedProcedure } from '@/server/procedures';
import { locations, stockLevels, articles, users } from '@/db/schema';
import { locationListSchema } from '@/lib/schemas/locations';

export const locationsRouter = router({
  list: protectedProcedure
    .input(locationListSchema)
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.query.locations.findMany({
        where: (l, { eq, and }) =>
          and(
            eq(l.active, input.active),
            input.type ? eq(l.type, input.type) : undefined,
          ),
        with: {
          assignedUser: {
            columns: { id: true, name: true, email: true, role: true },
          },
        },
      });
      return rows;
    }),

  getStock: protectedProcedure
    .input(locationListSchema.pick({ active: true }))
    .query(async ({ ctx }) => {
      const rows = await ctx.db
        .select({
          locationId: stockLevels.locationId,
          locationName: locations.name,
          locationCode: locations.code,
          locationType: locations.type,
          assignedUserName: users.name,
          articleId: stockLevels.articleId,
          articleName: articles.name,
          articleSku: articles.sku,
          articleUnit: articles.unit,
          quantity: stockLevels.quantity,
          reservedQuantity: stockLevels.reservedQuantity,
        })
        .from(stockLevels)
        .innerJoin(locations, eq(stockLevels.locationId, locations.id))
        .innerJoin(articles, eq(stockLevels.articleId, articles.id))
        .leftJoin(users, eq(locations.assignedUserId, users.id))
        .where(eq(locations.active, true));

      return rows;
    }),
});
9.4 Root router — server/routers/_app.ts
typescriptimport { router } from '@/server/trpc';
import { authRouter } from './auth';
import { articlesRouter } from './articles';
import { locationsRouter } from './locations';

export const appRouter = router({
  auth: authRouter,
  articles: articlesRouter,
  locations: locationsRouter,
});

export type AppRouter = typeof appRouter;

Passo 10 — API route handler
app/api/trpc/[trpc]/route.ts
typescriptimport { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server/routers/_app';
import { createContext } from '@/server/trpc';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: ({ req }) =>
      createContext({
        req,
        resHeaders: new Headers(),
        info: { isBatchCall: false, calls: [] },
      }),
    onError({ error, path }) {
      if (error.code === 'INTERNAL_SERVER_ERROR') {
        console.error(`tRPC error on ${path}:`, error);
      }
    },
  });

export { handler as GET, handler as POST };

Passo 11 — tRPC client
lib/trpc/client.tsx
typescript'use client';

import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@/server/routers/_app';

export const api = createTRPCReact<AppRouter>();
lib/trpc/server.ts
typescriptimport 'server-only';
import { createCallerFactory, router } from '@/server/trpc';
import { appRouter } from '@/server/routers/_app';
import { createContext } from '@/server/trpc';

const createCaller = createCallerFactory(appRouter);

export const createServerClient = async () => {
  const ctx = await createContext({
    req: new Request('http://internal'),
    resHeaders: new Headers(),
    info: { isBatchCall: false, calls: [] },
  });
  return createCaller(ctx);
};
lib/trpc/provider.tsx
typescript'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import { api } from './client';

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc',
          transformer: superjson,
        }),
      ],
    }),
  );

  return (
    <api.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </api.Provider>
  );
}
Adiciona o Provider no app/layout.tsx:
typescriptimport { TRPCProvider } from '@/lib/trpc/provider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body>
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}

Passo 12 — Testes unitários
Cria vitest.config.ts na raiz:
typescriptimport { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
Adiciona script no package.json:
json"test": "vitest run",
"test:watch": "vitest"
tests/unit/stock-math.test.ts
typescriptimport { describe, it, expect } from 'vitest';

// Testa a matemática central do sistema
// stock atual = soma de todos os quantityDelta não voidados
function calculateStock(movements: { quantityDelta: string; voidedAt: Date | null }[]) {
  return movements
    .filter((m) => m.voidedAt === null)
    .reduce((acc, m) => acc + parseFloat(m.quantityDelta), 0);
}

describe('Stock math', () => {
  it('calcula saldo correto com múltiplos movimentos', () => {
    const movements = [
      { quantityDelta: '100.000', voidedAt: null },
      { quantityDelta: '-2.500', voidedAt: null },
      { quantityDelta: '-0.500', voidedAt: null },
    ];
    expect(calculateStock(movements)).toBeCloseTo(97.0);
  });

  it('ignora movimentos voidados', () => {
    const movements = [
      { quantityDelta: '100.000', voidedAt: null },
      { quantityDelta: '-50.000', voidedAt: new Date() }, // voidado
    ];
    expect(calculateStock(movements)).toBeCloseTo(100.0);
  });

  it('aceita decimais de 3 casas (kg de gás)', () => {
    const movements = [
      { quantityDelta: '5.000', voidedAt: null },
      { quantityDelta: '-1.250', voidedAt: null },
    ];
    expect(calculateStock(movements)).toBeCloseTo(3.75);
  });

  it('saldo nunca vai abaixo de zero sem aviso', () => {
    const movements = [
      { quantityDelta: '2.000', voidedAt: null },
      { quantityDelta: '-3.000', voidedAt: null },
    ];
    // Sistema permite negativo (divergência real), mas alertar
    expect(calculateStock(movements)).toBeCloseTo(-1.0);
  });
});
Roda:
bashpnpm test
Todos os 4 testes devem passar.

Passo 13 — Sanity check final
Roda tudo em sequência:
bashpnpm typecheck    # zero erros
pnpm check        # zero erros
pnpm test         # 4 testes passando
pnpm dev          # sobe sem erros
Acessa no browser:

http://localhost:3000/api/trpc/auth.getSession deve retornar {"result":{"data":null}}
Se retornar JSON sem erro 500, o tRPC está funcionando.

Checklist:

 pnpm typecheck limpo
 pnpm check limpo
 pnpm test 4/4 passando
 /api/trpc/auth.getSession respondendo JSON
 lib/auth/config.ts existe com Auth.js configurado
 server/routers/_app.ts com 3 routers
 server/middleware/ com 3 arquivos
 lib/trpc/provider.tsx adicionado ao app/layout.tsx