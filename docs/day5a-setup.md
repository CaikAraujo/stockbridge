Passo 1 — Instalar dependências
bashpnpm add jspdf
pnpm add argon2
jspdf — geração de PDF das etiquetas.
argon2 — já está no projeto, confirma com pnpm list argon2.

Passo 2 — Idempotency crash fix
Substitui server/middleware/idempotency.ts:
typescriptimport { middleware } from '@/server/trpc';
import { idempotencyKeys } from '@/db/schema';
import { and, eq, gt, lt } from 'drizzle-orm';

type MiddlewareNextResult = Awaited
  ReturnType<Parameters<Parameters<typeof middleware>[0]>[0]['next']>
>;

const STALE_TIMEOUT_MS = 30_000; // 30 segundos

export const withIdempotency = middleware(async ({ ctx, next, path, input }) => {
  const typedInput =
    input && typeof input === 'object' ? (input as Record<string, unknown>) : undefined;
  const rawKey   = typedInput?.idempotencyKey;
  const key      = typeof rawKey === 'string' ? rawKey : undefined;

  if (!key || !ctx.session?.user?.id) return next();

  const userId = ctx.session.user.id;
  const now    = new Date();

  // Tenta reservar a chave
  const reserved = await ctx.db
    .insert(idempotencyKeys)
    .values({
      key,
      userId,
      endpoint:  path,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      response:  null,
      statusCode: null,
    })
    .onConflictDoNothing()
    .returning({ key: idempotencyKeys.key });

  if (reserved.length === 0) {
    // Chave já existe — busca o cache
    const [cached] = await ctx.db
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

    if (cached?.response) {
      // Resposta cacheada — retorna sem executar
      return cached.response as unknown as MiddlewareNextResult;
    }

    // Reserva órfã — verifica se é stale (crash anterior)
    const staleThreshold = new Date(now.getTime() - STALE_TIMEOUT_MS);
    const isStale = cached && cached.createdAt < staleThreshold;

    if (isStale) {
      // Remove reserva abandonada e permite retry
      await ctx.db
        .delete(idempotencyKeys)
        .where(
          and(
            eq(idempotencyKeys.userId, userId),
            eq(idempotencyKeys.endpoint, path),
            eq(idempotencyKeys.key, key),
          ),
        );
      // Retry recursivo não é possível aqui — instrui o cliente
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Operação anterior falhou. Gere um novo idempotencyKey e tente novamente.',
      });
    }

    throw new TRPCError({
      code: 'CONFLICT',
      message: 'Operação em andamento. Aguarde e tente novamente.',
    });
  }

  const result = await next();

  // Salva resposta no cache
  await ctx.db
    .update(idempotencyKeys)
    .set({
      response:   result as unknown as Record<string, unknown>,
      statusCode: 200,
    })
    .where(
      and(
        eq(idempotencyKeys.userId, userId),
        eq(idempotencyKeys.endpoint, path),
        eq(idempotencyKeys.key, key),
      ),
    );

  return result;
});
Adiciona o import que faltou no topo:
typescriptimport { TRPCError } from '@trpc/server';

Passo 3 — Rate limit magic link
lib/rate-limit.ts
typescript// Rate limiter em memória — adequado para single-tenant em VPS único
// Para multi-instância futura: substituir por Redis

interface RateLimitEntry {
  count:   number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Limpa entradas expiradas a cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 5 * 60 * 1000);

export interface RateLimitResult {
  allowed:    boolean;
  remaining:  number;
  resetAt:    Date;
}

export function checkRateLimit(
  key:      string,
  max:      number,
  windowMs: number,
): RateLimitResult {
  const now   = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1, resetAt: new Date(now + windowMs) };
  }

  if (entry.count >= max) {
    return { allowed: false, remaining: 0, resetAt: new Date(entry.resetAt) };
  }

  entry.count++;
  return {
    allowed:   true,
    remaining: max - entry.count,
    resetAt:   new Date(entry.resetAt),
  };
}
Aplica no login — app/login/page.tsx:
Substitui o server action inline por:
typescriptimport { signIn } from '@/lib/auth/config';
import { IconPackage, IconMail } from '@tabler/icons-react';
import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import { checkRateLimit } from '@/lib/rate-limit';
import { headers } from 'next/headers';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const { error, callbackUrl } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500">
            <IconPackage size={22} className="text-white" />
          </div>
          <h1 className="text-base font-medium text-text-primary">StockBridge</h1>
          <p className="mt-1 text-sm text-text-secondary">Acesso ao sistema</p>
        </div>

        <div className="rounded-card border border-surface-border bg-white p-6 shadow-sm">
          {error && (
            <div className="mb-4 rounded-btn border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error === 'RateLimit'
                ? 'Muitas tentativas. Aguarde 10 minutos.'
                : error === 'Verification'
                  ? 'Link expirado ou inválido. Solicite um novo.'
                  : 'Erro ao fazer login. Tente novamente.'}
            </div>
          )}

          <form
            action={async (formData: FormData) => {
              'use server';
              const email = formData.get('email') as string;
              const headersList = await headers();
              const ip =
                headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
                headersList.get('x-real-ip') ??
                'unknown';

              // Rate limit: 5 tentativas por IP+email a cada 10 minutos
              const rlKey    = `login:${ip}:${email}`;
              const rl       = checkRateLimit(rlKey, 5, 10 * 60 * 1000);
              if (!rl.allowed) {
                redirect('/login?error=RateLimit');
              }

              try {
                await signIn('resend', {
                  email,
                  redirectTo: callbackUrl ?? '/dashboard',
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
              className="w-full rounded-btn bg-brand-500 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600"
            >
              Enviar link de acesso
            </button>
          </form>

          <div className="mt-4 flex gap-2 rounded-btn bg-brand-50 px-3 py-2.5">
            <IconMail size={15} className="mt-0.5 flex-shrink-0 text-brand-500" />
            <p className="text-xs leading-relaxed text-brand-500">
              Você receberá um link seguro no e-mail. Válido por 10 minutos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

Passo 4 — Router users
lib/schemas/users.ts
typescriptimport { z } from 'zod';

export const userCreateSchema = z.object({
  name:              z.string().min(1).max(100),
  email:             z.string().email().optional(),
  phone:             z.string().max(20).optional(),
  role:              z.enum(['admin', 'manager', 'driver']),
  defaultLocationId: z.string().uuid().optional(),
});

export const userUpdateSchema = userCreateSchema.partial().extend({
  id:     z.string().uuid(),
  active: z.boolean().optional(),
});

export const setPinSchema = z.object({
  userId: z.string().uuid(),
  pin:    z.string().length(4).regex(/^\d{4}$/, 'PIN deve ter 4 dígitos'),
});

export const verifyPinSchema = z.object({
  pin: z.string().length(4).regex(/^\d{4}$/),
});
server/routers/users.ts
typescriptimport * as argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router } from '@/server/trpc';
import { adminProcedure, protectedProcedure, driverProcedure } from '@/server/procedures';
import { users } from '@/db/schema';
import { userCreateSchema, userUpdateSchema, setPinSchema, verifyPinSchema } from '@/lib/schemas/users';
import { idempotencySchema } from '@/lib/schemas/common';

export const usersRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.query.users.findMany({
      where: (u, { eq }) => eq(u.active, true),
      columns: {
        id: true, name: true, email: true, phone: true,
        role: true, defaultLocationId: true, active: true,
        lastLoginAt: true,
      },
      orderBy: (u, { asc }) => asc(u.name),
    });
  }),

  create: adminProcedure
    .input(userCreateSchema.merge(idempotencySchema))
    .mutation(async ({ ctx, input }) => {
      const { idempotencyKey: _k, ...data } = input;
      const [user] = await ctx.db.insert(users).values(data).returning({
        id: users.id, name: users.name, email: users.email, role: users.role,
      });
      if (!user) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      return user;
    }),

  update: adminProcedure
    .input(userUpdateSchema.merge(idempotencySchema))
    .mutation(async ({ ctx, input }) => {
      const { id, idempotencyKey: _k, ...data } = input;
      const [user] = await ctx.db
        .update(users)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning({ id: users.id, name: users.name });
      if (!user) throw new TRPCError({ code: 'NOT_FOUND' });
      return user;
    }),

  // Admin define PIN para um motorista
  setPin: adminProcedure
    .input(setPinSchema.merge(idempotencySchema))
    .mutation(async ({ ctx, input }) => {
      const hash = await argon2.hash(input.pin);
      await ctx.db
        .update(users)
        .set({ pinHash: hash, updatedAt: new Date() })
        .where(eq(users.id, input.userId));
      return { success: true };
    }),

  // Motorista verifica próprio PIN antes de ação sensível
  verifyPin: driverProcedure
    .input(verifyPinSchema)
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.query.users.findFirst({
        where: (u, { eq }) => eq(u.id, ctx.user.id),
        columns: { pinHash: true },
      });

      if (!user?.pinHash) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'PIN não configurado. Contacte o administrador.',
        });
      }

      const valid = await argon2.verify(user.pinHash, input.pin);
      if (!valid) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'PIN incorreto.',
        });
      }

      return { verified: true };
    }),

  deactivate: adminProcedure
    .input(idempotencySchema.extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [user] = await ctx.db
        .update(users)
        .set({ active: false, updatedAt: new Date() })
        .where(eq(users.id, input.id))
        .returning({ id: users.id });
      if (!user) throw new TRPCError({ code: 'NOT_FOUND' });
      return user;
    }),
});
Adiciona import que faltou:
typescriptimport { z } from 'zod';
Atualiza server/routers/_app.ts:
typescriptimport { router }         from '@/server/trpc';
import { authRouter }     from './auth';
import { articlesRouter } from './articles';
import { locationsRouter }from './locations';
import { movementsRouter }from './movements';
import { dashboardRouter }from './dashboard';
import { driversRouter }  from './drivers';
import { usersRouter }    from './users';

export const appRouter = router({
  auth:      authRouter,
  articles:  articlesRouter,
  locations: locationsRouter,
  movements: movementsRouter,
  dashboard: dashboardRouter,
  drivers:   driversRouter,
  users:     usersRouter,
});

export type AppRouter = typeof appRouter;

Passo 5 — Gerador de PDF com etiquetas QR
lib/qr-pdf.ts
typescript'use client';

import jsPDF from 'jspdf';
import QRCode from 'qrcode';

// Layout A4 — 4 etiquetas por linha
const PAGE_W     = 210; // mm
const PAGE_H     = 297; // mm
const MARGIN     = 8;   // mm
const COLS       = 4;
const LABEL_W    = (PAGE_W - MARGIN * 2) / COLS; // ~48.5mm
const LABEL_H    = 42;  // mm
const QR_SIZE    = 28;  // mm
const BORDER_CLR = 210; // cinza claro

export async function generateQRLabelsPDF(
  articles: { sku: string; name: string }[],
  appUrl:   string,
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  let col  = 0;
  let row  = 0;

  for (const article of articles) {
    const url      = `${appUrl}/scan/${encodeURIComponent(article.sku)}`;
    const qrData   = await QRCode.toDataURL(url, { width: 200, margin: 1, errorCorrectionLevel: 'M' });

    const x = MARGIN + col * LABEL_W;
    const y = MARGIN + row * LABEL_H;

    // Borda
    doc.setDrawColor(BORDER_CLR);
    doc.setLineWidth(0.2);
    doc.rect(x, y, LABEL_W, LABEL_H);

    // QR centralizado
    const qrX = x + (LABEL_W - QR_SIZE) / 2;
    doc.addImage(qrData, 'PNG', qrX, y + 2, QR_SIZE, QR_SIZE);

    // Nome (truncado se necessário)
    const maxChars = 22;
    const name     = article.name.length > maxChars
      ? `${article.name.slice(0, maxChars)}…`
      : article.name;

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(name, x + LABEL_W / 2, y + QR_SIZE + 6, { align: 'center' });

    // SKU
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(article.sku, x + LABEL_W / 2, y + QR_SIZE + 10, { align: 'center' });

    col++;
    if (col >= COLS) {
      col = 0;
      row++;
      if (y + LABEL_H * 2 > PAGE_H - MARGIN && articles.indexOf(article) < articles.length - 1) {
        doc.addPage();
        row = 0;
      }
    }
  }

  doc.save('etiquetas-stockbridge.pdf');
}

Passo 6 — Formulário de artigos
components/admin/articles/article-form.tsx
typescript'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/trpc/client';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

const UNITS = [
  { value: 'un',  label: 'Unidade (un)' },
  { value: 'pc',  label: 'Peça (pc)' },
  { value: 'cx',  label: 'Caixa (cx)' },
  { value: 'kg',  label: 'Quilograma (kg)' },
  { value: 'g',   label: 'Grama (g)' },
  { value: 'l',   label: 'Litro (l)' },
  { value: 'ml',  label: 'Mililitro (ml)' },
  { value: 'm',   label: 'Metro (m)' },
  { value: 'cm',  label: 'Centímetro (cm)' },
  { value: 'rl',  label: 'Rolo (rl)' },
  { value: 'par', label: 'Par' },
] as const;

type ArticleFormProps = {
  mode:      'create' | 'edit';
  articleId?: string;
  initial?: {
    sku: string; name: string; description?: string | null;
    unit: string; barcode?: string | null;
    costPriceCents?: number | null; salePriceCents?: number | null;
    minStock: string; reorderPoint: string;
    refrigerantType?: string | null;
  };
};

function centsToReais(cents: number | null | undefined): string {
  if (!cents) return '';
  return (cents / 100).toFixed(2).replace('.', ',');
}

function reaisToCents(value: string): number | undefined {
  const n = parseFloat(value.replace(',', '.'));
  return isNaN(n) ? undefined : Math.round(n * 100);
}

export function ArticleForm({ mode, articleId, initial }: ArticleFormProps) {
  const router  = useRouter();
  const create  = api.articles.create.useMutation();
  const update  = api.articles.update.useMutation();

  const [form, setForm] = useState({
    sku:             initial?.sku             ?? '',
    name:            initial?.name            ?? '',
    description:     initial?.description     ?? '',
    unit:            initial?.unit            ?? 'un',
    barcode:         initial?.barcode         ?? '',
    costPrice:       centsToReais(initial?.costPriceCents),
    salePrice:       centsToReais(initial?.salePriceCents),
    minStock:        initial?.minStock        ?? '0',
    reorderPoint:    initial?.reorderPoint    ?? '0',
    refrigerantType: initial?.refrigerantType ?? '',
  });

  const [loading, setLoading] = useState(false);

  const set = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        sku:             form.sku,
        name:            form.name,
        description:     form.description || undefined,
        unit:            form.unit as typeof UNITS[number]['value'],
        barcode:         form.barcode || undefined,
        costPriceCents:  reaisToCents(form.costPrice),
        salePriceCents:  reaisToCents(form.salePrice),
        minStock:        form.minStock || '0',
        reorderPoint:    form.reorderPoint || '0',
        refrigerantType: form.refrigerantType || undefined,
        idempotencyKey:  uuidv4(),
      };

      if (mode === 'create') {
        await create.mutateAsync(payload);
        toast.success('Artigo criado com sucesso');
      } else {
        await update.mutateAsync({ id: articleId!, ...payload });
        toast.success('Artigo atualizado com sucesso');
      }
      router.push('/articles');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar artigo';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const field = (label: string, children: React.ReactNode, required = false) => (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-text-primary">
        {label} {required && <span className="text-status-critical">*</span>}
      </label>
      {children}
    </div>
  );

  const input = (name: keyof typeof form, placeholder = '', type = 'text') => (
    <input
      type={type}
      value={form[name]}
      onChange={set(name)}
      placeholder={placeholder}
      className="w-full rounded-btn border border-surface-border px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-500 focus:outline-none"
    />
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        {field('SKU', input('sku', 'SKU-0001'), true)}
        {field('Código de barras', input('barcode', 'EAN, QR, etc.'))}
      </div>

      {field('Nome do artigo', input('name', 'Ex: Gás R-410A'), true)}

      {field('Descrição', (
        <textarea
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          placeholder="Descrição opcional"
          rows={2}
          className="w-full rounded-btn border border-surface-border px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-500 focus:outline-none resize-none"
        />
      ))}

      <div className="grid grid-cols-2 gap-4">
        {field('Unidade de medida', (
          <select
            value={form.unit}
            onChange={set('unit')}
            className="w-full rounded-btn border border-surface-border px-3 py-2.5 text-sm text-text-primary focus:border-brand-500 focus:outline-none bg-white"
          >
            {UNITS.map((u) => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </select>
        ), true)}
        {field('Tipo de gás', input('refrigerantType', 'R-410A, R-32...'))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {field('Preço de custo (R$)', input('costPrice', '0,00'))}
        {field('Preço de venda (R$)', input('salePrice', '0,00'))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {field('Estoque mínimo', input('minStock', '0'), true)}
        {field('Ponto de reposição', input('reorderPoint', '0'), true)}
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-surface-border pt-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-btn border border-surface-border px-4 py-2 text-sm text-text-secondary hover:bg-surface transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-btn bg-brand-500 px-5 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors disabled:opacity-50"
        >
          {loading ? 'Salvando...' : mode === 'create' ? 'Criar artigo' : 'Salvar alterações'}
        </button>
      </div>
    </form>
  );
}
app/(admin)/articles/new/page.tsx
typescriptimport { AdminTopbar }  from '@/components/admin/layout/topbar';
import { ArticleForm }  from '@/components/admin/articles/article-form';

export default function NewArticlePage() {
  return (
    <>
      <AdminTopbar title="Novo artigo" subtitle="Cadastro de item no estoque" />
      <main className="flex-1 overflow-auto p-5">
        <div className="mx-auto max-w-2xl rounded-card border border-surface-border bg-white p-6">
          <ArticleForm mode="create" />
        </div>
      </main>
    </>
  );
}
app/(admin)/articles/[id]/edit/page.tsx
typescriptimport { AdminTopbar }        from '@/components/admin/layout/topbar';
import { ArticleForm }        from '@/components/admin/articles/article-form';
import { createServerClient } from '@/lib/trpc/server';
import { notFound }           from 'next/navigation';

export default async function EditArticlePage({ params }: { params: { id: string } }) {
  const api     = await createServerClient();
  const article = await api.articles.getById({ id: params.id });
  if (!article) notFound();

  return (
    <>
      <AdminTopbar title={`Editar — ${article.name}`} subtitle={article.sku} />
      <main className="flex-1 overflow-auto p-5">
        <div className="mx-auto max-w-2xl rounded-card border border-surface-border bg-white p-6">
          <ArticleForm
            mode="edit"
            articleId={article.id}
            initial={article}
          />
        </div>
      </main>
    </>
  );
}

Passo 7 — Tabela de artigos com checkboxes e impressão
Substitui components/admin/articles/articles-table.tsx:
typescript'use client';

import { useState } from 'react';
import Link from 'next/link';
import { IconPlus, IconQrcode, IconSearch, IconEdit, IconPrinter } from '@tabler/icons-react';
import { generateQRLabelsPDF } from '@/lib/qr-pdf';
import { toast } from 'sonner';

type Article = {
  id: string; sku: string; name: string; unit: string;
  barcode: string | null; active: boolean;
  minStock: string; reorderPoint: string;
  refrigerantType: string | null;
};

export function ArticlesTable({ initialData }: { initialData: { items: Article[] } }) {
  const [search,   setSearch]   = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [printing, setPrinting] = useState(false);

  const filtered = initialData.items.filter((a) =>
    !search ||
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.sku.toLowerCase().includes(search.toLowerCase()),
  );

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((a) => a.id)));
    }
  };

  const handlePrint = async () => {
    const toPrint = filtered.filter((a) => selected.has(a.id));
    if (toPrint.length === 0) return;

    setPrinting(true);
    try {
      await generateQRLabelsPDF(
        toPrint.map((a) => ({ sku: a.sku, name: a.name })),
        window.location.origin,
      );
      toast.success(`PDF gerado com ${toPrint.length} etiqueta(s)`);
    } catch {
      toast.error('Erro ao gerar PDF');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <IconSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar artigo ou SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-btn border border-surface-border py-2 pl-8 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-500 focus:outline-none"
          />
        </div>

        {selected.size > 0 && (
          <button
            onClick={handlePrint}
            disabled={printing}
            className="flex items-center gap-1.5 rounded-btn bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors disabled:opacity-50"
          >
            <IconPrinter size={15} />
            {printing ? 'Gerando...' : `Imprimir etiquetas (${selected.size})`}
          </button>
        )}

        <Link
          href="/articles/new"
          className="flex items-center gap-1.5 rounded-btn border border-surface-border bg-white px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface transition-colors"
        >
          <IconPlus size={15} />
          Novo artigo
        </Link>
      </div>

      {/* Tabela */}
      <div className="rounded-card border border-surface-border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface">
              <th className="w-10 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={selected.size === filtered.length && filtered.length > 0}
                  onChange={toggleAll}
                  className="rounded"
                />
              </th>
              {['SKU', 'Nome', 'Unidade', 'Mín.', 'Reposição', 'Tipo gás', ''].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-text-muted uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {filtered.map((a) => (
              <tr key={a.id} className={`hover:bg-surface transition-colors ${selected.has(a.id) ? 'bg-brand-50' : ''}`}>
                <td className="px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={selected.has(a.id)}
                    onChange={() => toggleSelect(a.id)}
                    className="rounded"
                  />
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-text-secondary">{a.sku}</td>
                <td className="px-4 py-2.5 font-medium text-text-primary">{a.name}</td>
                <td className="px-4 py-2.5">
                  <span className="rounded px-1.5 py-0.5 text-xs bg-surface text-text-secondary">{a.unit}</span>
                </td>
                <td className="px-4 py-2.5 text-text-secondary">{parseFloat(a.minStock).toFixed(3)}</td>
                <td className="px-4 py-2.5 text-text-secondary">{parseFloat(a.reorderPoint).toFixed(3)}</td>
                <td className="px-4 py-2.5 text-text-secondary">{a.refrigerantType ?? '—'}</td>
                <td className="px-4 py-2.5">
                  <Link
                    href={`/articles/${a.id}/edit`}
                    className="flex items-center gap-1 rounded px-2 py-1 text-xs text-text-secondary hover:bg-surface transition-colors"
                  >
                    <IconEdit size={13} />
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-text-muted">
                  Nenhum artigo encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

Passo 8 — Tela de gestão de usuários
app/(admin)/users/page.tsx
typescriptimport { AdminTopbar }        from '@/components/admin/layout/topbar';
import { UsersTable }         from '@/components/admin/users/users-table';
import { createServerClient } from '@/lib/trpc/server';

export default async function UsersPage() {
  const api   = await createServerClient();
  const users = await api.users.list();

  return (
    <>
      <AdminTopbar title="Usuários" subtitle="Gestão de motoristas e administradores" />
      <main className="flex-1 overflow-auto p-5">
        <UsersTable initialData={users} />
      </main>
    </>
  );
}
components/admin/users/users-table.tsx
typescript'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { IconPlus, IconKey } from '@tabler/icons-react';

type User = {
  id: string; name: string; email: string | null;
  phone: string | null; role: string; active: boolean;
};

const ROLE_LABEL = {
  admin:   'Administrador',
  manager: 'Gerente',
  driver:  'Motorista',
} as const;

const ROLE_COLOR = {
  admin:   'bg-violet-50 text-violet-700',
  manager: 'bg-blue-50 text-blue-700',
  driver:  'bg-green-50 text-green-700',
} as const;

export function UsersTable({ initialData }: { initialData: User[] }) {
  const [showForm,  setShowForm]  = useState(false);
  const [pinModal,  setPinModal]  = useState<string | null>(null);
  const [pin,       setPin]       = useState('');
  const [form,      setForm]      = useState({
    name: '', email: '', phone: '',
    role: 'driver' as 'admin' | 'manager' | 'driver',
  });

  const createUser = api.users.create.useMutation();
  const setPin_m   = api.users.setPin.useMutation();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createUser.mutateAsync({ ...form, idempotencyKey: uuidv4() });
      toast.success('Usuário criado com sucesso');
      setShowForm(false);
      setForm({ name: '', email: '', phone: '', role: 'driver' });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar usuário');
    }
  };

  const handleSetPin = async () => {
    if (!pinModal || pin.length !== 4) return;
    try {
      await setPin_m.mutateAsync({ userId: pinModal, pin, idempotencyKey: uuidv4() });
      toast.success('PIN definido com sucesso');
      setPinModal(null);
      setPin('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao definir PIN');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 rounded-btn bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
        >
          <IconPlus size={15} />
          Novo usuário
        </button>
      </div>

      {/* Formulário de criação */}
      {showForm && (
        <div className="rounded-card border border-surface-border bg-white p-5">
          <h3 className="mb-4 text-sm font-medium text-text-primary">Novo usuário</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Nome *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full rounded-btn border border-surface-border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">E-mail</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="w-full rounded-btn border border-surface-border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Telefone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                className="w-full rounded-btn border border-surface-border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-secondary">Role *</label>
              <select
                value={form.role}
                onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as typeof form.role }))}
                className="w-full rounded-btn border border-surface-border px-3 py-2 text-sm bg-white focus:border-brand-500 focus:outline-none"
              >
                <option value="driver">Motorista</option>
                <option value="manager">Gerente</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div className="col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)}
                className="rounded-btn border border-surface-border px-4 py-2 text-sm text-text-secondary hover:bg-surface">
                Cancelar
              </button>
              <button type="submit"
                className="rounded-btn bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
                Criar usuário
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabela */}
      <div className="rounded-card border border-surface-border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface">
              {['Nome', 'E-mail', 'Telefone', 'Role', ''].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-text-muted uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {initialData.map((u) => (
              <tr key={u.id} className="hover:bg-surface transition-colors">
                <td className="px-4 py-2.5 font-medium text-text-primary">{u.name}</td>
                <td className="px-4 py-2.5 text-text-secondary">{u.email ?? '—'}</td>
                <td className="px-4 py-2.5 text-text-secondary">{u.phone ?? '—'}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLOR[u.role as keyof typeof ROLE_COLOR]}`}>
                    {ROLE_LABEL[u.role as keyof typeof ROLE_LABEL]}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  {u.role === 'driver' && (
                    <button
                      onClick={() => { setPinModal(u.id); setPin(''); }}
                      className="flex items-center gap-1 rounded px-2 py-1 text-xs text-text-secondary hover:bg-surface transition-colors"
                    >
                      <IconKey size={13} />
                      Definir PIN
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de PIN */}
      {pinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-80 rounded-card border border-surface-border bg-white p-6 shadow-xl">
            <h3 className="mb-1 text-sm font-medium text-text-primary">Definir PIN do motorista</h3>
            <p className="mb-4 text-xs text-text-secondary">PIN de 4 dígitos para confirmar operações no PWA</p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="0000"
              className="mb-4 w-full rounded-btn border border-surface-border px-3 py-2.5 text-center text-2xl tracking-widest focus:border-brand-500 focus:outline-none"
            />
            <div className="flex gap-2">
              <button onClick={() => setPinModal(null)}
                className="flex-1 rounded-btn border border-surface-border py-2 text-sm text-text-secondary hover:bg-surface">
                Cancelar
              </button>
              <button
                onClick={handleSetPin}
                disabled={pin.length !== 4}
                className="flex-1 rounded-btn bg-brand-500 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-40">
                Salvar PIN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

Passo 9 — Gestão de caminhões
Estende o locationsRouter com atribuição de motorista.
Adiciona em server/routers/locations.ts:
typescript// No final do router, adiciona:
assignDriver: adminProcedure
  .input(z.object({
    locationId: z.string().uuid(),
    userId:     z.string().uuid().nullable(),
  }).merge(idempotencySchema))
  .mutation(async ({ ctx, input }) => {
    const [loc] = await ctx.db
      .update(locations)
      .set({ assignedUserId: input.userId, updatedAt: new Date() })
      .where(eq(locations.id, input.locationId))
      .returning({ id: locations.id, name: locations.name });
    if (!loc) throw new TRPCError({ code: 'NOT_FOUND' });
    return loc;
  }),
app/(admin)/trucks/page.tsx
typescriptimport { AdminTopbar }        from '@/components/admin/layout/topbar';
import { TrucksManager }      from '@/components/admin/trucks/trucks-manager';
import { createServerClient } from '@/lib/trpc/server';

export default async function TrucksPage() {
  const api     = await createServerClient();
  const [trucks, drivers] = await Promise.all([
    api.locations.list({ type: 'truck', active: true }),
    api.drivers.list(),
  ]);

  return (
    <>
      <AdminTopbar title="Caminhões" subtitle="Atribuição de motoristas" />
      <main className="flex-1 overflow-auto p-5">
        <TrucksManager trucks={trucks} drivers={drivers} />
      </main>
    </>
  );
}
components/admin/trucks/trucks-manager.tsx
typescript'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { IconTruck } from '@tabler/icons-react';

type Truck = {
  id: string; code: string; name: string;
  plate: string | null;
  assignedUser: { id: string; name: string } | null;
};
type Driver = { id: string; name: string; };

export function TrucksManager({
  trucks, drivers,
}: { trucks: Truck[]; drivers: Driver[] }) {
  const [saving, setSaving] = useState<string | null>(null);
  const assignDriver = api.locations.assignDriver.useMutation();

  const handleAssign = async (locationId: string, userId: string | null) => {
    setSaving(locationId);
    try {
      await assignDriver.mutateAsync({ locationId, userId, idempotencyKey: uuidv4() });
      toast.success('Motorista atribuído com sucesso');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atribuir motorista');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="rounded-card border border-surface-border bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-border bg-surface">
            {['Caminhão', 'Código', 'Placa', 'Motorista atribuído', ''].map((h) => (
              <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-text-muted uppercase tracking-wide">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-border">
          {trucks.map((t) => (
            <tr key={t.id} className="hover:bg-surface transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50">
                    <IconTruck size={15} className="text-brand-500" />
                  </div>
                  <span className="font-medium text-text-primary">{t.name}</span>
                </div>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-text-secondary">{t.code}</td>
              <td className="px-4 py-3 text-text-secondary">{t.plate ?? '—'}</td>
              <td className="px-4 py-3">
                <select
                  defaultValue={t.assignedUser?.id ?? ''}
                  onChange={(e) => handleAssign(t.id, e.target.value || null)}
                  disabled={saving === t.id}
                  className="rounded-btn border border-surface-border px-2 py-1.5 text-sm bg-white focus:border-brand-500 focus:outline-none disabled:opacity-50"
                >
                  <option value="">Sem motorista</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3 text-xs text-text-muted">
                {saving === t.id ? 'Salvando...' : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

Passo 10 — PIN modal no PWA
Substitui components/driver/withdraw-return-form.tsx adicionando o PIN modal antes do submit:
typescript'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconPackage, IconArrowDown, IconArrowUp, IconMinus, IconPlus, IconCheck, IconLock } from '@tabler/icons-react';
import { api } from '@/lib/trpc/client';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';

type Article = { id: string; name: string; sku: string; unit: string; };
type Location = { id: string; name: string; code: string; };
type Action   = 'withdraw' | 'return';

export function WithdrawReturnForm({
  article, warehouse, truck, userName,
}: {
  article:   Article;
  warehouse: Location;
  truck:     Location;
  userName:  string;
}) {
  const router   = useRouter();
  const [action,   setAction]   = useState<Action>('withdraw');
  const [qty,      setQty]      = useState(1);
  const [loading,  setLoading]  = useState(false);
  const [showPin,  setShowPin]  = useState(false);
  const [pin,      setPin]      = useState('');
  const [pinError, setPinError] = useState('');

  const withdraw   = api.movements.withdraw.useMutation();
  const returnItem = api.movements.return.useMutation();
  const verifyPin  = api.users.verifyPin.useMutation();

  const handleConfirm = () => {
    if (qty <= 0) return;
    setPin('');
    setPinError('');
    setShowPin(true);
  };

  const handlePinSubmit = async () => {
    if (pin.length !== 4) return;
    setLoading(true);
    setPinError('');

    try {
      // 1. Verifica PIN
      await verifyPin.mutateAsync({ pin });

      // 2. Executa operação
      const key = uuidv4();
      if (action === 'withdraw') {
        await withdraw.mutateAsync({
          articleId:      article.id,
          quantity:       qty,
          fromLocationId: warehouse.id,
          toLocationId:   truck.id,
          idempotencyKey: key,
        });
        toast.success(`${qty} ${article.unit} retirado(s) com sucesso`);
      } else {
        await returnItem.mutateAsync({
          articleId:      article.id,
          quantity:       qty,
          fromLocationId: truck.id,
          toLocationId:   warehouse.id,
          idempotencyKey: key,
        });
        toast.success(`${qty} ${article.unit} devolvido(s) com sucesso`);
      }

      setShowPin(false);
      router.push('/driver');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro';
      if (msg.includes('PIN incorreto') || msg.includes('PIN')) {
        setPinError(msg);
        setPin('');
      } else {
        toast.error(msg);
        setShowPin(false);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <div className="bg-brand-500 px-4 pb-6 pt-10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
            <IconPackage size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-medium text-white">{article.name}</h1>
            <p className="text-xs text-white/75">SKU: {article.sku}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Selecionar ação */}
        <div className="grid grid-cols-2 gap-3">
          {(['withdraw', 'return'] as Action[]).map((a) => (
            <button
              key={a}
              onClick={() => setAction(a)}
              className={`flex flex-col items-center gap-2 rounded-card border-2 p-4 transition-colors ${
                action === a
                  ? a === 'withdraw' ? 'border-brand-500 bg-brand-50' : 'border-status-ok bg-green-50'
                  : 'border-surface-border bg-white'
              }`}
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                action === a
                  ? a === 'withdraw' ? 'bg-brand-500' : 'bg-status-ok'
                  : 'bg-surface'
              }`}>
                {a === 'withdraw'
                  ? <IconArrowDown size={20} className={action === a ? 'text-white' : 'text-text-secondary'} />
                  : <IconArrowUp   size={20} className={action === a ? 'text-white' : 'text-text-secondary'} />
                }
              </div>
              <span className={`text-sm font-medium ${
                action === a
                  ? a === 'withdraw' ? 'text-brand-500' : 'text-status-ok'
                  : 'text-text-secondary'
              }`}>
                {a === 'withdraw' ? 'Retirada' : 'Devolução'}
              </span>
              <span className="text-center text-xs text-text-muted">
                {a === 'withdraw' ? 'Depósito → Caminhão' : 'Caminhão → Depósito'}
              </span>
            </button>
          ))}
        </div>

        {/* Quantidade */}
        <div className="rounded-card border border-surface-border bg-white p-5">
          <p className="mb-4 text-center text-sm font-medium text-text-primary">
            Quantidade ({article.unit})
          </p>
          <div className="flex items-center justify-center gap-6">
            <button
              onClick={() => setQty((q) => Math.max(0.5, parseFloat((q - 0.5).toFixed(3))))}
              className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-surface-border bg-surface hover:bg-brand-50 hover:border-brand-500 transition-colors"
            >
              <IconMinus size={20} className="text-text-secondary" />
            </button>
            <div className="text-center">
              <p className="text-4xl font-medium text-text-primary">{qty.toFixed(1)}</p>
              <p className="text-sm text-text-muted">{article.unit}</p>
            </div>
            <button
              onClick={() => setQty((q) => parseFloat((q + 0.5).toFixed(3)))}
              className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-surface-border bg-surface hover:bg-brand-50 hover:border-brand-500 transition-colors"
            >
              <IconPlus size={20} className="text-text-secondary" />
            </button>
          </div>
          <input
            type="number"
            step="0.5"
            min="0.5"
            value={qty}
            onChange={(e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v) && v > 0) setQty(v); }}
            className="mt-4 w-full rounded-btn border border-surface-border px-3 py-2 text-center text-sm text-text-primary focus:border-brand-500 focus:outline-none"
          />
        </div>

        <div className="rounded-btn bg-surface px-4 py-3 text-xs text-text-secondary">
          {action === 'withdraw'
            ? <p><strong>{warehouse.name}</strong> → <strong>{truck.name}</strong></p>
            : <p><strong>{truck.name}</strong> → <strong>{warehouse.name}</strong></p>
          }
          <p className="mt-0.5">Operador: {userName}</p>
        </div>
      </div>

      {/* Botão confirmar */}
      <div className="border-t border-surface-border bg-white p-4">
        <button
          onClick={handleConfirm}
          disabled={qty <= 0}
          className={`flex w-full items-center justify-center gap-2 rounded-btn py-4 text-base font-medium text-white transition-colors disabled:opacity-40 ${
            action === 'withdraw' ? 'bg-brand-500 hover:bg-brand-600' : 'bg-status-ok hover:bg-green-700'
          }`}
        >
          <IconCheck size={20} />
          Confirmar {action === 'withdraw' ? 'Retirada' : 'Devolução'}
        </button>
      </div>

      {/* Modal PIN */}
      {showPin && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40">
          <div className="w-full rounded-t-2xl bg-white p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50">
                <IconLock size={20} className="text-brand-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">Confirme com seu PIN</p>
                <p className="text-xs text-text-secondary">4 dígitos para autorizar a operação</p>
              </div>
            </div>

            <div className="flex justify-center gap-3 mb-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-3 w-3 rounded-full transition-colors ${
                    i < pin.length ? 'bg-brand-500' : 'bg-surface-border'
                  }`}
                />
              ))}
            </div>

            {pinError && (
              <p className="mb-3 text-center text-xs text-status-critical">{pinError}</p>
            )}

            {/* Teclado numérico */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((k, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (k === '⌫') setPin((p) => p.slice(0, -1));
                    else if (k !== '' && pin.length < 4) setPin((p) => p + String(k));
                  }}
                  className={`rounded-btn py-3.5 text-xl font-medium transition-colors ${
                    k === '' ? 'invisible' :
                    k === '⌫' ? 'bg-surface text-text-secondary hover:bg-surface-border' :
                    'bg-surface text-text-primary hover:bg-brand-50'
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowPin(false)}
                className="flex-1 rounded-btn border border-surface-border py-3 text-sm text-text-secondary hover:bg-surface"
              >
                Cancelar
              </button>
              <button
                onClick={handlePinSubmit}
                disabled={pin.length !== 4 || loading}
                className="flex-1 rounded-btn bg-brand-500 py-3 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-40"
              >
                {loading ? 'Verificando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

Passo 11 — Sanity check
bashpnpm typecheck
pnpm check
pnpm test
pnpm dev
Verifica no browser:

/articles → tabela com checkboxes ✅
/articles/new → formulário de criação ✅
Seleciona artigos → botão "Imprimir etiquetas" aparece ✅
/users → lista + formulário + modal de PIN ✅
/trucks → atribuição de motorista ✅
/driver/scan/{sku} → modal de PIN antes de confirmar ✅

Checklist:

 lib/rate-limit.ts existe
 lib/qr-pdf.ts existe
 server/routers/users.ts existe com create, setPin, verifyPin
 _app.ts exporta users
 app/(admin)/articles/new/page.tsx existe
 app/(admin)/articles/[id]/edit/page.tsx existe
 app/(admin)/users/page.tsx existe
 app/(admin)/trucks/page.tsx existe
 components/driver/withdraw-return-form.tsx tem modal de PIN