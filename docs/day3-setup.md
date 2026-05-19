Passo 1 — Instalar dependências
bashpnpm add @tabler/icons-react
pnpm add sonner
pnpm add nuqs
pnpm add date-fns
pnpm add otplib qrcode
pnpm add -D @types/qrcode

Passo 2 — Design tokens no Tailwind
Substitui o tailwind.config.ts por:
typescriptimport type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f7ff',
          100: '#e0efff',
          200: '#bfdbfe',
          400: '#0d6eae',
          500: '#064875',
          600: '#053d63',
          700: '#042f4d',
        },
        surface: {
          DEFAULT: '#f0f3f7',
          card:    '#ffffff',
          border:  '#e5e7eb',
        },
        text: {
          primary:   '#111827',
          secondary: '#4b5563',
          muted:     '#9ca3af',
        },
        status: {
          ok:       '#16a34a',
          low:      '#d97706',
          critical: '#dc2626',
        },
      },
      borderRadius: {
        card: '10px',
        btn:  '7px',
        tag:  '5px',
      },
      fontSize: {
        '2xs': ['10px', '14px'],
        'xs':  ['11px', '16px'],
        'sm':  ['12px', '17px'],
        'base':['13px', '19px'],
      },
      minWidth: { sidebar: '220px', sidebar-collapsed: '56px' },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
Instala o plugin:
bashpnpm add -D tailwindcss-animate

Passo 3 — Inicializar shadcn/ui
Este passo é interativo — rode você mesmo no terminal:
bashpnpm dlx shadcn@latest init
Responda:

Style: Default
Base color: Slate
CSS variables: Yes

Depois instala os componentes que vamos usar:
bashpnpm dlx shadcn@latest add button input card table badge dialog dropdown-menu separator tooltip skeleton alert sheet
Confirma que a pasta components/ui/ foi criada com os arquivos.

Passo 4 — Novos routers backend
4.1 Zod schema para movements — lib/schemas/movements.ts
typescriptimport { z } from 'zod';
import { paginationSchema, dateRangeSchema } from './common';

export const movementListSchema = paginationSchema.extend({
  locationId: z.string().uuid().optional(),
  articleId:  z.string().uuid().optional(),
  createdBy:  z.string().uuid().optional(),
  type:       z.enum(['consumption','restock','transfer_out','transfer_in','adjustment','initial','return']).optional(),
  dateRange:  dateRangeSchema.optional(),
  excludeVoided: z.boolean().default(true),
});

export const recentActivitySchema = z.object({
  limit: z.number().int().min(1).max(50).default(10),
  locationId: z.string().uuid().optional(),
});
4.2 Router de movements — server/routers/movements.ts
typescriptimport { desc, eq, and, gte, lte, isNull, not } from 'drizzle-orm';
import { router } from '@/server/trpc';
import { protectedProcedure, managerProcedure } from '@/server/procedures';
import { stockMovements, articles, locations, users } from '@/db/schema';
import { movementListSchema, recentActivitySchema } from '@/lib/schemas/movements';

export const movementsRouter = router({
  recentActivity: protectedProcedure
    .input(recentActivitySchema)
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id:           stockMovements.id,
          movementType: stockMovements.movementType,
          quantityDelta:stockMovements.quantityDelta,
          createdAt:    stockMovements.createdAt,
          unitCostCents:stockMovements.unitCostCents,
          articleName:  articles.name,
          articleUnit:  articles.unit,
          locationName: locations.name,
          locationCode: locations.code,
          createdByName:users.name,
        })
        .from(stockMovements)
        .innerJoin(articles,  eq(stockMovements.articleId,  articles.id))
        .innerJoin(locations, eq(stockMovements.locationId, locations.id))
        .innerJoin(users,     eq(stockMovements.createdBy,  users.id))
        .where(
          and(
            isNull(stockMovements.voidedAt),
            input.locationId ? eq(stockMovements.locationId, input.locationId) : undefined,
          ),
        )
        .orderBy(desc(stockMovements.createdAt))
        .limit(input.limit);

      return rows;
    }),
});
4.3 Router de dashboard — server/routers/dashboard.ts
typescriptimport { desc, eq, and, gte, isNull, count, sum, sql } from 'drizzle-orm';
import { router } from '@/server/trpc';
import { protectedProcedure } from '@/server/procedures';
import { stockMovements, stockLevels, articles, locations, transfers } from '@/db/schema';

export const dashboardRouter = router({
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [movementsToday, transfersInTransit, lowStockAlerts] = await Promise.all([
      // Saídas hoje
      ctx.db
        .select({ total: count() })
        .from(stockMovements)
        .where(
          and(
            isNull(stockMovements.voidedAt),
            gte(stockMovements.createdAt, todayStart),
            eq(stockMovements.movementType, 'consumption'),
          ),
        ),

      // Transferências em trânsito
      ctx.db
        .select({ total: count() })
        .from(transfers)
        .where(eq(transfers.status, 'in_transit')),

      // Itens abaixo do ponto de reposição
      ctx.db
        .select({ total: count() })
        .from(stockLevels)
        .innerJoin(articles, eq(stockLevels.articleId, articles.id))
        .where(
          sql`${stockLevels.quantity} <= ${articles.reorderPoint} AND ${stockLevels.quantity} > 0`,
        ),
    ]);

    return {
      movementsToday:    movementsToday[0]?.total    ?? 0,
      transfersInTransit:transfersInTransit[0]?.total ?? 0,
      lowStockAlerts:    lowStockAlerts[0]?.total    ?? 0,
    };
  }),

  getTrucksSummary: protectedProcedure.query(async ({ ctx }) => {
    const trucks = await ctx.db.query.locations.findMany({
      where: (l, { eq, and }) => and(eq(l.type, 'truck'), eq(l.active, true)),
      with: { assignedUser: { columns: { id: true, name: true } } },
    });

    const stockByLocation = await ctx.db
      .select({
        locationId:    stockLevels.locationId,
        totalItems:    sql<number>`cast(sum(${stockLevels.quantity}) as integer)`,
        distinctSkus:  sql<number>`cast(count(distinct ${stockLevels.articleId}) as integer)`,
      })
      .from(stockLevels)
      .groupBy(stockLevels.locationId);

    const lowByLocation = await ctx.db
      .select({
        locationId: stockLevels.locationId,
        lowCount:   sql<number>`cast(count(*) as integer)`,
      })
      .from(stockLevels)
      .innerJoin(articles, eq(stockLevels.articleId, articles.id))
      .where(sql`${stockLevels.quantity} <= ${articles.reorderPoint}`)
      .groupBy(stockLevels.locationId);

    return trucks.map((t) => {
      const stock = stockByLocation.find((s) => s.locationId === t.id);
      const low   = lowByLocation.find((l) => l.locationId === t.id);
      return {
        id:           t.id,
        code:         t.code,
        name:         t.name,
        plate:        t.plate,
        assignedUser: t.assignedUser,
        totalItems:   stock?.totalItems   ?? 0,
        distinctSkus: stock?.distinctSkus ?? 0,
        lowCount:     low?.lowCount       ?? 0,
      };
    });
  }),

  getTruckInventory: protectedProcedure
    .input(import('@/lib/schemas/common').then((m) => m.idSchema))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          articleId:        stockLevels.articleId,
          sku:              articles.sku,
          barcode:          articles.barcode,
          name:             articles.name,
          unit:             articles.unit,
          categoryId:       articles.categoryId,
          quantity:         stockLevels.quantity,
          reservedQuantity: stockLevels.reservedQuantity,
          minStock:         articles.minStock,
          reorderPoint:     articles.reorderPoint,
          costPriceCents:   articles.costPriceCents,
          refrigerantType:  articles.refrigerantType,
        })
        .from(stockLevels)
        .innerJoin(articles, eq(stockLevels.articleId, articles.id))
        .where(
          and(
            eq(stockLevels.locationId, input.id),
            eq(articles.active, true),
          ),
        )
        .orderBy(articles.name);

      return rows;
    }),
});
4.4 Atualiza server/routers/_app.ts
typescriptimport { router } from '@/server/trpc';
import { authRouter }       from './auth';
import { articlesRouter }   from './articles';
import { locationsRouter }  from './locations';
import { movementsRouter }  from './movements';
import { dashboardRouter }  from './dashboard';

export const appRouter = router({
  auth:      authRouter,
  articles:  articlesRouter,
  locations: locationsRouter,
  movements: movementsRouter,
  dashboard: dashboardRouter,
});

export type AppRouter = typeof appRouter;

Passo 5 — middleware.ts (proteção de rotas)
Cria middleware.ts na raiz do projeto:
typescriptimport { auth } from '@/lib/auth/config';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/login/verify', '/login/error', '/login/totp'];
const DRIVER_HOME  = '/driver';
const ADMIN_HOME   = '/dashboard';

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn   = !!req.auth?.user;
  const role         = req.auth?.user?.role;
  const isPublic     = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // Redireciona usuário logado que tenta acessar login
  if (isPublic && isLoggedIn) {
    const dest = role === 'driver' ? DRIVER_HOME : ADMIN_HOME;
    return NextResponse.redirect(new URL(dest, req.url));
  }

  // Redireciona não-logado para login
  if (!isPublic && !isLoggedIn) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Driver tenta acessar painel admin
  if (isLoggedIn && role === 'driver' && !pathname.startsWith(DRIVER_HOME)) {
    return NextResponse.redirect(new URL(DRIVER_HOME, req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon\\.ico|icons).*)'],
};

Passo 6 — Layout admin
6.1 Componente sidebar — components/admin/layout/sidebar.tsx
typescript'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IconLayoutDashboard, IconTruck, IconArrowLeftRight,
  IconTransfer, IconBox, IconBriefcase, IconClipboardList,
  IconUsers, IconShieldLock, IconSettings, IconPackage,
  IconLayoutSidebarLeftCollapse, IconLayoutSidebarRightCollapse,
} from '@tabler/icons-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const NAV_GROUPS = [
  {
    items: [
      { href: '/dashboard',     label: 'Dashboard',         icon: IconLayoutDashboard },
      { href: '/trucks',        label: 'Caminhões',          icon: IconTruck },
      { href: '/movements',     label: 'Movimentações',      icon: IconArrowLeftRight },
      { href: '/transfers',     label: 'Transferências',     icon: IconTransfer },
    ],
  },
  {
    items: [
      { href: '/articles',      label: 'Artigos',            icon: IconBox },
      { href: '/jobs',          label: 'Ordens de serviço',  icon: IconBriefcase },
      { href: '/inventory',     label: 'Inventário',         icon: IconClipboardList },
    ],
  },
  {
    items: [
      { href: '/users',         label: 'Usuários',           icon: IconUsers },
      { href: '/audit',         label: 'Auditoria',          icon: IconShieldLock },
      { href: '/settings',      label: 'Configurações',      icon: IconSettings },
    ],
  },
];

export function AdminSidebar() {
  const pathname  = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Persiste preferência
  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    if (stored) setCollapsed(stored === 'true');
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      localStorage.setItem('sidebar-collapsed', String(!prev));
      return !prev;
    });
  };

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          'flex h-screen flex-col bg-brand-500 transition-all duration-200',
          collapsed ? 'w-14' : 'w-[220px]',
        )}
      >
        {/* Logo */}
        <div className={cn(
          'flex items-center gap-2.5 border-b border-white/10 px-4 py-5',
          collapsed && 'justify-center px-0',
        )}>
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-white/20">
            <IconPackage size={16} className="text-white" />
          </div>
          {!collapsed && (
            <span className="text-sm font-medium text-white">StockBridge</span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi}>
              {gi > 0 && <div className="my-1.5 h-px bg-white/10" />}
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                const item = (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors',
                      'text-white/85 hover:bg-white/12 hover:text-white',
                      active && 'bg-white/18 font-medium text-white',
                      collapsed && 'justify-center px-0',
                    )}
                  >
                    <Icon size={18} className="flex-shrink-0" />
                    {!collapsed && <span className="truncate">{label}</span>}
                  </Link>
                );

                if (collapsed) {
                  return (
                    <Tooltip key={href}>
                      <TooltipTrigger asChild>{item}</TooltipTrigger>
                      <TooltipContent side="right">{label}</TooltipContent>
                    </Tooltip>
                  );
                }
                return item;
              })}
            </div>
          ))}
        </nav>

        {/* Collapse button */}
        <button
          onClick={toggle}
          className={cn(
            'flex items-center gap-2.5 border-t border-white/10 px-4 py-3',
            'text-xs text-white/75 hover:text-white transition-colors',
            collapsed && 'justify-center px-0',
          )}
        >
          {collapsed
            ? <IconLayoutSidebarRightCollapse size={18} />
            : <>
                <IconLayoutSidebarLeftCollapse size={18} />
                <span>Minimizar</span>
              </>
          }
        </button>
      </aside>
    </TooltipProvider>
  );
}
6.2 Topbar — components/admin/layout/topbar.tsx
typescriptimport { auth, signOut } from '@/lib/auth/config';
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { IconChevronDown, IconLogout, IconUser } from '@tabler/icons-react';

interface AdminTopbarProps {
  title:    string;
  subtitle?: string;
}

export async function AdminTopbar({ title, subtitle }: AdminTopbarProps) {
  const session = await auth();
  const user    = session?.user;
  const initials = user?.name?.split(' ').map((n) => n[0]).slice(0, 2).join('') ?? 'AD';

  return (
    <header className="flex h-[52px] flex-shrink-0 items-center justify-between border-b border-surface-border bg-white px-5">
      <div>
        <h1 className="text-sm font-medium text-text-primary">{title}</h1>
        {subtitle && <p className="text-xs text-text-secondary">{subtitle}</p>}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-surface transition-colors">
            <div className="flex flex-col text-right">
              <span className="text-xs font-medium text-text-primary">{user?.name ?? 'Admin'}</span>
              <span className="text-2xs text-text-secondary capitalize">{user?.role}</span>
            </div>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-white text-2xs font-medium">
              {initials}
            </div>
            <IconChevronDown size={14} className="text-text-muted" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem>
            <IconUser size={14} className="mr-2" />
            Meu perfil
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild className="text-red-600 focus:text-red-600">
            <form action={async () => { 'use server'; await signOut({ redirectTo: '/login' }); }}>
              <button type="submit" className="flex w-full items-center">
                <IconLogout size={14} className="mr-2" />
                Sair
              </button>
            </form>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
6.3 Layout admin — app/(admin)/layout.tsx
typescriptimport { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { AdminSidebar } from '@/components/admin/layout/sidebar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role === 'driver') redirect('/driver');

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <AdminSidebar />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {children}
      </div>
    </div>
  );
}
6.4 Redirect raiz — app/page.tsx
typescriptimport { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';

export default async function RootPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role === 'driver') redirect('/driver');
  redirect('/dashboard');
}

Passo 7 — Tela de login
app/login/page.tsx
typescriptimport { signIn } from '@/lib/auth/config';
import { IconPackage, IconMail } from '@tabler/icons-react';
import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; callbackUrl?: string };
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500">
            <IconPackage size={22} className="text-white" />
          </div>
          <h1 className="text-base font-medium text-text-primary">StockBridge</h1>
          <p className="mt-1 text-sm text-text-secondary">Acesso ao sistema</p>
        </div>

        {/* Form */}
        <div className="rounded-card border border-surface-border bg-white p-6 shadow-sm">
          {searchParams.error && (
            <div className="mb-4 rounded-btn bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">
              {searchParams.error === 'Verification'
                ? 'Link expirado ou inválido. Solicite um novo.'
                : 'Erro ao fazer login. Tente novamente.'}
            </div>
          )}

          <form
            action={async (formData: FormData) => {
              'use server';
              try {
                await signIn('resend', {
                  email: formData.get('email') as string,
                  redirectTo: searchParams.callbackUrl ?? '/dashboard',
                });
              } catch (err) {
                if (err instanceof AuthError) {
                  redirect(`/login?error=${err.type}`);
                }
                throw err;
              }
            }}
          >
            <label className="mb-1.5 block text-sm font-medium text-text-primary">
              E-mail
            </label>
            <input
              type="email"
              name="email"
              required
              placeholder="seu@email.com"
              className="mb-4 w-full rounded-btn border border-surface-border px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <button
              type="submit"
              className="w-full rounded-btn bg-brand-500 py-2.5 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
            >
              Enviar link de acesso
            </button>
          </form>

          <div className="mt-4 flex gap-2 rounded-btn bg-brand-50 px-3 py-2.5">
            <IconMail size={15} className="mt-0.5 flex-shrink-0 text-brand-500" />
            <p className="text-xs text-brand-500 leading-relaxed">
              Você receberá um link seguro no e-mail. Válido por 10 minutos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

Passo 8 — Tela de verificação
app/login/verify/page.tsx
typescriptimport Link from 'next/link';
import { IconPackage, IconMailCheck, IconArrowLeft } from '@tabler/icons-react';

export default function VerifyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500">
          <IconPackage size={22} className="text-white" />
        </div>

        <div className="mt-8 rounded-card border border-surface-border bg-white p-8 shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50">
            <IconMailCheck size={28} className="text-brand-500" />
          </div>
          <h2 className="mb-2 text-sm font-medium text-text-primary">
            Verifique seu e-mail
          </h2>
          <p className="mb-6 text-sm text-text-secondary leading-relaxed">
            Enviamos um link de acesso. Clique no link para entrar no sistema.
            O link expira em <strong>10 minutos</strong>.
          </p>
          <p className="text-xs text-text-muted">
            Não recebeu?{' '}
            <Link href="/login" className="text-brand-500 hover:underline font-medium">
              Tentar novamente
            </Link>
          </p>
        </div>

        <Link
          href="/login"
          className="mt-4 inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
        >
          <IconArrowLeft size={13} />
          Voltar ao login
        </Link>
      </div>
    </div>
  );
}

Passo 9 — Tela de TOTP (stub funcional)
app/login/totp/page.tsx
typescript'use client';

import { useState } from 'react';
import { IconPackage, IconShieldLock } from '@tabler/icons-react';
import Link from 'next/link';

export default function TotpPage() {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...digits];
    next[index] = value.slice(-1);
    setDigits(next);
    if (value && index < 5) {
      document.getElementById(`digit-${index + 1}`)?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      document.getElementById(`digit-${index - 1}`)?.focus();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500">
            <IconPackage size={22} className="text-white" />
          </div>
        </div>

        <div className="rounded-card border border-surface-border bg-white p-6 shadow-sm text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
            <IconShieldLock size={24} className="text-brand-500" />
          </div>
          <h2 className="mb-1 text-sm font-medium text-text-primary">
            Verificação em 2 etapas
          </h2>
          <p className="mb-6 text-xs text-text-secondary">
            Digite o código do seu app autenticador
          </p>

          <div className="mb-2 flex justify-center gap-2">
            {digits.map((d, i) => (
              <input
                key={i}
                id={`digit-${i}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="h-11 w-9 rounded-btn border border-surface-border text-center text-lg font-medium text-text-primary focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            ))}
          </div>
          <p className="mb-5 text-2xs text-text-muted">
            Google Authenticator · Microsoft Authenticator · Authy
          </p>

          <button
            disabled={digits.some((d) => !d)}
            className="w-full rounded-btn bg-brand-500 py-2.5 text-sm font-medium text-white hover:bg-brand-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Verificar
          </button>

          <Link
            href="/login"
            className="mt-4 block text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            Voltar ao login
          </Link>
        </div>
      </div>
    </div>
  );
}

Passo 10 — Dashboard
app/(admin)/dashboard/page.tsx
typescriptimport { AdminTopbar } from '@/components/admin/layout/topbar';
import { StatsCards }  from '@/components/admin/dashboard/stats-cards';
import { TruckList }   from '@/components/admin/dashboard/truck-list';
import { ActivityFeed } from '@/components/admin/dashboard/activity-feed';
import { createServerClient } from '@/lib/trpc/server';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default async function DashboardPage() {
  const api    = await createServerClient();
  const [stats, trucks, activity] = await Promise.all([
    api.dashboard.getStats(),
    api.dashboard.getTrucksSummary(),
    api.movements.recentActivity({ limit: 10 }),
  ]);

  const today = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });

  return (
    <>
      <AdminTopbar title="Dashboard" subtitle={`Visão geral — ${today}`} />
      <main className="flex-1 overflow-auto p-5">
        <StatsCards stats={stats} />
        <div className="mt-4 grid grid-cols-2 gap-4">
          <TruckList trucks={trucks} />
          <ActivityFeed activity={activity} />
        </div>
      </main>
    </>
  );
}
components/admin/dashboard/stats-cards.tsx
typescriptimport { IconPackages, IconTransfer, IconAlertTriangle } from '@tabler/icons-react';

interface Props {
  stats: { movementsToday: number; transfersInTransit: number; lowStockAlerts: number };
}

export function StatsCards({ stats }: Props) {
  const cards = [
    {
      label:   'Saídas hoje',
      value:   stats.movementsToday,
      icon:    IconPackages,
      accent:  'border-l-brand-500',
      iconColor: 'text-brand-500',
    },
    {
      label:   'Transferências em trânsito',
      value:   stats.transfersInTransit,
      icon:    IconTransfer,
      accent:  'border-l-[#7c3aed]',
      iconColor: 'text-[#7c3aed]',
    },
    {
      label:   'Alertas de estoque',
      value:   stats.lowStockAlerts,
      icon:    IconAlertTriangle,
      accent:  stats.lowStockAlerts > 0 ? 'border-l-status-low' : 'border-l-status-ok',
      iconColor: stats.lowStockAlerts > 0 ? 'text-status-low' : 'text-status-ok',
      valueColor: stats.lowStockAlerts > 0 ? 'text-status-low' : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`rounded-card border border-surface-border bg-white p-4 border-l-4 ${c.accent}`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-text-secondary">{c.label}</p>
              <p className={`mt-1.5 text-2xl font-medium ${c.valueColor ?? 'text-text-primary'}`}>
                {c.value}
              </p>
            </div>
            <c.icon size={20} className={c.iconColor} />
          </div>
        </div>
      ))}
    </div>
  );
}
components/admin/dashboard/truck-list.tsx
typescriptimport Link from 'next/link';
import { IconTruck } from '@tabler/icons-react';

interface Truck {
  id: string; code: string; name: string; plate: string | null;
  assignedUser: { name: string } | null;
  totalItems: number; distinctSkus: number; lowCount: number;
}

export function TruckList({ trucks }: { trucks: Truck[] }) {
  return (
    <div className="rounded-card border border-surface-border bg-white">
      <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
        <h2 className="text-sm font-medium text-text-primary">Saldo por caminhão</h2>
        <Link href="/trucks" className="text-xs font-medium text-brand-500 hover:underline">
          Ver todos →
        </Link>
      </div>
      <div className="divide-y divide-surface-border">
        {trucks.map((t) => (
          <Link
            key={t.id}
            href={`/trucks/${t.id}`}
            className="flex items-center justify-between px-4 py-2.5 hover:bg-surface transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`h-2 w-2 rounded-full flex-shrink-0 ${
                  t.lowCount > 0 ? 'bg-status-low' : 'bg-status-ok'
                }`}
              />
              <div>
                <p className="text-sm font-medium text-text-primary">{t.name}</p>
                <p className="text-xs text-text-secondary">
                  {t.assignedUser?.name ?? '—'} · {t.code}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-sm font-medium ${t.lowCount > 0 ? 'text-status-low' : 'text-text-primary'}`}>
                {t.totalItems} itens
              </p>
              {t.lowCount > 0 && (
                <p className="text-2xs text-status-low">{t.lowCount} abaixo do mínimo</p>
              )}
            </div>
          </Link>
        ))}
        {trucks.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-text-muted">
            Nenhum caminhão cadastrado.
          </p>
        )}
      </div>
    </div>
  );
}
components/admin/dashboard/activity-feed.tsx
typescriptimport { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { IconArrowUpRight, IconArrowDownLeft, IconTransfer, IconAdjustments } from '@tabler/icons-react';
import Link from 'next/link';

const MOVEMENT_CONFIG = {
  consumption:   { label: 'saída',         icon: IconArrowUpRight,   bg: 'bg-amber-50',   color: 'text-amber-700' },
  restock:       { label: 'entrada',        icon: IconArrowDownLeft,  bg: 'bg-green-50',   color: 'text-green-700' },
  transfer_out:  { label: 'transferência',  icon: IconTransfer,       bg: 'bg-violet-50',  color: 'text-violet-700' },
  transfer_in:   { label: 'transferência',  icon: IconTransfer,       bg: 'bg-violet-50',  color: 'text-violet-700' },
  adjustment:    { label: 'ajuste',         icon: IconAdjustments,    bg: 'bg-blue-50',    color: 'text-blue-700' },
  initial:       { label: 'inicial',        icon: IconArrowDownLeft,  bg: 'bg-gray-50',    color: 'text-gray-600' },
  return:        { label: 'devolução',      icon: IconArrowDownLeft,  bg: 'bg-green-50',   color: 'text-green-700' },
} as const;

type Activity = {
  id: string; movementType: keyof typeof MOVEMENT_CONFIG;
  quantityDelta: string; articleName: string; articleUnit: string;
  locationName: string; createdByName: string; createdAt: Date;
};

export function ActivityFeed({ activity }: { activity: Activity[] }) {
  return (
    <div className="rounded-card border border-surface-border bg-white">
      <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
        <h2 className="text-sm font-medium text-text-primary">Atividade recente</h2>
        <Link href="/movements" className="text-xs font-medium text-brand-500 hover:underline">
          Ver tudo →
        </Link>
      </div>
      <div className="divide-y divide-surface-border">
        {activity.map((a) => {
          const cfg  = MOVEMENT_CONFIG[a.movementType];
          const Icon = cfg.icon;
          const qty  = parseFloat(a.quantityDelta);
          return (
            <div key={a.id} className="flex items-start gap-2.5 px-4 py-2.5">
              <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md ${cfg.bg}`}>
                <Icon size={14} className={cfg.color} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-text-primary">
                  {a.articleName} —{' '}
                  <span className={qty < 0 ? 'text-status-low' : 'text-status-ok'}>
                    {Math.abs(qty)} {a.articleUnit}
                  </span>
                  <span className={`ml-1.5 inline-flex rounded px-1.5 py-0.5 text-2xs font-medium ${cfg.bg} ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </p>
                <p className="text-xs text-text-secondary">
                  {a.createdByName} · {a.locationName} ·{' '}
                  {formatDistanceToNow(new Date(a.createdAt), { locale: ptBR, addSuffix: true })}
                </p>
              </div>
            </div>
          );
        })}
        {activity.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-text-muted">
            Nenhuma atividade hoje.
          </p>
        )}
      </div>
    </div>
  );
}

Passo 11 — Detalhe do caminhão
app/(admin)/trucks/[id]/page.tsx
typescriptimport { AdminTopbar } from '@/components/admin/layout/topbar';
import { TruckInventoryTable } from '@/components/admin/trucks/inventory-table';
import { createServerClient } from '@/lib/trpc/server';
import { notFound } from 'next/navigation';
import { IconTruck } from '@tabler/icons-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default async function TruckDetailPage({ params }: { params: { id: string } }) {
  const api = await createServerClient();

  const [trucks, inventory] = await Promise.all([
    api.dashboard.getTrucksSummary(),
    api.dashboard.getTruckInventory({ id: params.id }),
  ]);

  const truck = trucks.find((t) => t.id === params.id);
  if (!truck) notFound();

  return (
    <>
      <AdminTopbar
        title={truck.name}
        subtitle={`${truck.assignedUser?.name ?? '—'} · ${truck.code}${truck.plate ? ` · ${truck.plate}` : ''}`}
      />
      <main className="flex-1 overflow-auto p-5">
        {/* Header stats */}
        <div className="mb-4 flex items-center justify-between rounded-card border border-surface-border bg-white px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50">
              <IconTruck size={22} className="text-brand-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">{truck.name}</p>
              <p className="text-xs text-text-secondary">
                {truck.assignedUser?.name ?? 'Sem motorista'} · {truck.code}
              </p>
            </div>
          </div>
          <div className="flex gap-8">
            {[
              { label: 'Itens totais',    value: truck.totalItems },
              { label: 'SKUs distintos',  value: truck.distinctSkus },
              { label: 'Abaixo do mínimo', value: truck.lowCount, warn: truck.lowCount > 0 },
            ].map((s) => (
              <div key={s.label} className="text-right">
                <p className={`text-lg font-medium ${s.warn ? 'text-status-low' : 'text-text-primary'}`}>
                  {s.value}
                </p>
                <p className="text-xs text-text-secondary">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <TruckInventoryTable items={inventory} truckId={params.id} />
      </main>
    </>
  );
}
components/admin/trucks/inventory-table.tsx
typescript'use client';

import { useState, useMemo } from 'react';
import { IconSearch } from '@tabler/icons-react';

type Item = {
  articleId: string; sku: string; barcode: string | null;
  name: string; unit: string; quantity: string;
  minStock: string; reorderPoint: string; costPriceCents: number | null;
  refrigerantType: string | null;
};

function getStatus(qty: number, reorder: number, min: number) {
  if (qty <= 0)      return 'empty';
  if (qty <= reorder) return qty <= min ? 'critical' : 'low';
  return 'ok';
}

const STATUS_STYLE = {
  ok:       { dot: 'bg-status-ok',       text: 'text-status-ok',       label: 'Ok' },
  low:      { dot: 'bg-status-low',      text: 'text-status-low',      label: 'Baixo' },
  critical: { dot: 'bg-status-critical', text: 'text-status-critical', label: 'Crítico' },
  empty:    { dot: 'bg-gray-300',        text: 'text-gray-400',        label: 'Zerado' },
};

export function TruckInventoryTable({ items, truckId }: { items: Item[]; truckId: string }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'ok' | 'low' | 'critical'>('all');

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const qty    = parseFloat(item.quantity);
      const reorder = parseFloat(item.reorderPoint);
      const min    = parseFloat(item.minStock);
      const status = getStatus(qty, reorder, min);

      const matchSearch = !search ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.sku.toLowerCase().includes(search.toLowerCase()) ||
        (item.barcode ?? '').includes(search);

      const matchFilter = filter === 'all' || status === filter;

      return matchSearch && matchFilter;
    });
  }, [items, search, filter]);

  const counts = useMemo(() => ({
    ok:       items.filter((i) => { const q = parseFloat(i.quantity); const r = parseFloat(i.reorderPoint); const m = parseFloat(i.minStock); return getStatus(q, r, m) === 'ok'; }).length,
    low:      items.filter((i) => { const q = parseFloat(i.quantity); const r = parseFloat(i.reorderPoint); const m = parseFloat(i.minStock); return getStatus(q, r, m) === 'low'; }).length,
    critical: items.filter((i) => { const q = parseFloat(i.quantity); const r = parseFloat(i.reorderPoint); const m = parseFloat(i.minStock); return getStatus(q, r, m) === 'critical'; }).length,
  }), [items]);

  return (
    <div className="rounded-card border border-surface-border bg-white">
      {/* Filters */}
      <div className="flex items-center gap-3 border-b border-surface-border px-4 py-3">
        <div className="relative flex-1">
          <IconSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar artigo, SKU ou código de barras..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-btn border border-surface-border py-2 pl-8 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div className="flex gap-1.5">
          {([['all', 'Todos', items.length], ['ok', 'Ok', counts.ok], ['low', 'Baixo', counts.low], ['critical', 'Crítico', counts.critical]] as const).map(([val, label, count]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === val
                  ? 'bg-brand-500 text-white'
                  : 'bg-surface text-text-secondary hover:bg-brand-50 hover:text-brand-500'
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface">
              {['Artigo', 'Unid.', 'Qtd. atual', 'Mínimo', 'Status'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-text-muted uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {filtered.map((item) => {
              const qty    = parseFloat(item.quantity);
              const reorder = parseFloat(item.reorderPoint);
              const min    = parseFloat(item.minStock);
              const status = getStatus(qty, reorder, min);
              const st     = STATUS_STYLE[status];

              return (
                <tr key={item.articleId} className="hover:bg-surface transition-colors">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-text-primary">{item.name}</p>
                    <p className="text-xs text-text-muted font-mono">{item.sku}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-surface text-text-secondary">
                      {item.unit}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`font-medium ${st.text}`}>{qty.toFixed(3)}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-text-muted">
                    mín. {parseFloat(item.minStock).toFixed(3)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${st.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                      {st.label}
                    </span>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-text-muted">
                  {search ? 'Nenhum item encontrado para esta busca.' : 'Caminhão sem itens em estoque.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

Passo 12 — Sanity check final
bashpnpm typecheck   # zero erros
pnpm check       # zero erros
pnpm test        # 4/4 passando
pnpm dev         # sobe sem erros
Verifica no browser:

http://localhost:3000 → redireciona para /login ✅
/login → tela de login aparece ✅
/dashboard sem login → redireciona para /login ✅

Checklist:

 middleware.ts na raiz do projeto
 app/(admin)/layout.tsx existe
 app/login/page.tsx existe
 app/(admin)/dashboard/page.tsx existe
 app/(admin)/trucks/[id]/page.tsx existe
 components/admin/layout/sidebar.tsx existe
 server/routers/dashboard.ts existe
 server/routers/movements.ts existe
 _app.ts exporta dashboard e movements