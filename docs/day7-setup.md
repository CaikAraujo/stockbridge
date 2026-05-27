Passo 1 — Migration: totp_verified na sessão
O sistema precisa saber se o admin já passou pelo TOTP nesta sessão. A forma mais limpa é adicionar um campo na tabela sessions.
db/migrations/0004_totp_session.sql
sqlALTER TABLE "sessions"
  ADD COLUMN IF NOT EXISTS "totp_verified" boolean NOT NULL DEFAULT false;
Registra no journal e roda:
bashpnpm db:migrate

Passo 2 — Router TOTP
server/routers/totp.ts
typescriptimport { authenticator } from 'otplib';
import { eq }            from 'drizzle-orm';
import { TRPCError }     from '@trpc/server';
import * as argon2       from 'argon2';
import QRCode            from 'qrcode';
import { router }        from '@/server/trpc';
import {
  protectedProcedure,
  adminProcedure,
}                        from '@/server/procedures';
import { users, sessions } from '@/db/schema';
import { z }             from 'zod';

const APP_NAME = 'StockBridge';

export const totpRouter = router({

  // Gera secret + QR code para o admin escanear
  setupGenerate: adminProcedure
    .mutation(async ({ ctx }) => {
      const secret  = authenticator.generateSecret();
      const otpauth = authenticator.keyuri(
        ctx.user.email ?? ctx.user.id,
        APP_NAME,
        secret,
      );
      const qrDataUrl = await QRCode.toDataURL(otpauth);

      // Salva secret temporariamente (ainda não ativado)
      await ctx.db
        .update(users)
        .set({ totpSecret: secret })
        .where(eq(users.id, ctx.user.id));

      return { qrDataUrl, secret };
    }),

  // Admin escaneia o QR e digita o primeiro código
  // para confirmar que funcionou — ativa o TOTP
  setupActivate: adminProcedure
    .input(z.object({ code: z.string().length(6).regex(/^\d{6}$/) }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.query.users.findFirst({
        where: (u, { eq: eqFn }) => eqFn(u.id, ctx.user.id),
        columns: { totpSecret: true },
      });

      if (!user?.totpSecret) {
        throw new TRPCError({
          code:    'BAD_REQUEST',
          message: 'Gere o QR code primeiro.',
        });
      }

      const valid = authenticator.verify({
        token:  input.code,
        secret: user.totpSecret,
      });

      if (!valid) {
        throw new TRPCError({
          code:    'BAD_REQUEST',
          message: 'Código inválido. Tente novamente.',
        });
      }

      // Marca sessão atual como TOTP verificada
      await ctx.db
        .update(sessions)
        .set({ totpVerified: true })
        .where(eq(sessions.userId, ctx.user.id));

      return { activated: true };
    }),

  // Verifica código TOTP no fluxo de login (step-up)
  verify: protectedProcedure
    .input(z.object({ code: z.string().length(6).regex(/^\d{6}$/) }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.query.users.findFirst({
        where: (u, { eq: eqFn }) => eqFn(u.id, ctx.user.id),
        columns: { totpSecret: true, role: true },
      });

      if (!user?.totpSecret) {
        throw new TRPCError({
          code:    'BAD_REQUEST',
          message: 'TOTP não configurado.',
        });
      }

      const valid = authenticator.verify({
        token:  input.code,
        secret: user.totpSecret,
      });

      if (!valid) {
        throw new TRPCError({
          code:    'UNAUTHORIZED',
          message: 'Código inválido.',
        });
      }

      // Marca sessão como TOTP verificada
      await ctx.db
        .update(sessions)
        .set({ totpVerified: true })
        .where(eq(sessions.userId, ctx.user.id));

      return { verified: true };
    }),

  // Desativa TOTP (admin pode desativar o próprio)
  disable: adminProcedure
    .input(z.object({ code: z.string().length(6).regex(/^\d{6}$/) }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.query.users.findFirst({
        where: (u, { eq: eqFn }) => eqFn(u.id, ctx.user.id),
        columns: { totpSecret: true },
      });

      if (!user?.totpSecret) {
        throw new TRPCError({
          code:    'BAD_REQUEST',
          message: 'TOTP não está ativo.',
        });
      }

      const valid = authenticator.verify({
        token:  input.code,
        secret: user.totpSecret,
      });

      if (!valid) {
        throw new TRPCError({
          code:    'UNAUTHORIZED',
          message: 'Código inválido. TOTP não desativado.',
        });
      }

      await ctx.db
        .update(users)
        .set({ totpSecret: null })
        .where(eq(users.id, ctx.user.id));

      return { disabled: true };
    }),

  // Retorna se o admin atual tem TOTP ativo
  status: protectedProcedure
    .query(async ({ ctx }) => {
      const user = await ctx.db.query.users.findFirst({
        where: (u, { eq: eqFn }) => eqFn(u.id, ctx.user.id),
        columns: { totpSecret: true },
      });
      return { enabled: !!user?.totpSecret };
    }),
});
Atualiza server/routers/_app.ts:
typescriptimport { totpRouter } from './totp';

export const appRouter = router({
  // ... routers existentes
  totp: totpRouter,
});

Passo 3 — Schema do banco (totp_verified)
Adiciona em db/schema.ts na tabela sessions:
typescript// Na tabela sessions, adiciona após expires:
totpVerified: boolean('totp_verified').notNull().default(false),

Passo 4 — Tela de setup TOTP
app/(admin)/settings/totp/page.tsx
typescriptimport { AdminTopbar } from '@/components/admin/layout/topbar';
import { TotpSetup }   from '@/components/admin/settings/totp-setup';
import { auth }        from '@/lib/auth/config';
import { redirect }    from 'next/navigation';
import { db }          from '@/db/client';
import { users }       from '@/db/schema';
import { eq }          from 'drizzle-orm';

export default async function TotpSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'admin') redirect('/dashboard');

  const user = await db.query.users.findFirst({
    where: (u, { eq: eqFn }) => eqFn(u.id, session.user.id),
    columns: { totpSecret: true },
  });

  return (
    <>
      <AdminTopbar
        title="Autenticação em dois fatores"
        subtitle="TOTP — Google Authenticator / Authy"
      />
      <main className="flex-1 overflow-auto p-5">
        <div className="mx-auto max-w-lg">
          <TotpSetup totpEnabled={!!user?.totpSecret} />
        </div>
      </main>
    </>
  );
}
components/admin/settings/totp-setup.tsx
typescript'use client';

import { useState } from 'react';
import Image        from 'next/image';
import { api }      from '@/lib/trpc/client';
import { toast }    from 'sonner';
import {
  IconShieldCheck,
  IconShieldOff,
  IconQrcode,
} from '@tabler/icons-react';

export function TotpSetup({ totpEnabled }: { totpEnabled: boolean }) {
  const [step,       setStep]       = useState<'idle' | 'scan' | 'confirm' | 'done'>('idle');
  const [qrDataUrl,  setQrDataUrl]  = useState('');
  const [code,       setCode]       = useState('');
  const [disableCode,setDisableCode]= useState('');
  const [showDisable,setShowDisable]= useState(false);

  const generate = api.totp.setupGenerate.useMutation();
  const activate = api.totp.setupActivate.useMutation();
  const disable  = api.totp.disable.useMutation();

  const handleGenerate = async () => {
    try {
      const res = await generate.mutateAsync();
      setQrDataUrl(res.qrDataUrl);
      setStep('scan');
    } catch {
      toast.error('Erro ao gerar QR code');
    }
  };

  const handleActivate = async () => {
    if (code.length !== 6) return;
    try {
      await activate.mutateAsync({ code });
      setStep('done');
      toast.success('TOTP ativado com sucesso');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Código inválido');
      setCode('');
    }
  };

  const handleDisable = async () => {
    if (disableCode.length !== 6) return;
    try {
      await disable.mutateAsync({ code: disableCode });
      toast.success('TOTP desativado');
      setShowDisable(false);
      setDisableCode('');
      // Recarrega página para refletir estado
      window.location.reload();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Código inválido');
    }
  };

  // TOTP já ativo
  if (totpEnabled && step !== 'done') {
    return (
      <div className="rounded-card border border-surface-border bg-white p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50">
            <IconShieldCheck size={20} className="text-status-ok" />
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">TOTP ativo</p>
            <p className="text-xs text-text-secondary">
              Sua conta está protegida com autenticação em dois fatores
            </p>
          </div>
        </div>

        {!showDisable ? (
          <button
            onClick={() => setShowDisable(true)}
            className="flex items-center gap-1.5 text-sm text-status-critical hover:underline"
          >
            <IconShieldOff size={14} />
            Desativar TOTP
          </button>
        ) : (
          <div className="space-y-3 border-t border-surface-border pt-4">
            <p className="text-xs text-text-secondary">
              Digite o código do autenticador para confirmar:
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full rounded-btn border border-surface-border px-3 py-2.5 text-center text-2xl tracking-widest focus:border-brand-500 focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowDisable(false); setDisableCode(''); }}
                className="flex-1 rounded-btn border border-surface-border py-2 text-sm text-text-secondary hover:bg-surface"
              >
                Cancelar
              </button>
              <button
                onClick={handleDisable}
                disabled={disableCode.length !== 6}
                className="flex-1 rounded-btn bg-status-critical py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                Desativar
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Setup flow
  return (
    <div className="rounded-card border border-surface-border bg-white p-6 space-y-5">
      {step === 'idle' && (
        <>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface">
              <IconShieldOff size={20} className="text-text-secondary" />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">TOTP não configurado</p>
              <p className="text-xs text-text-secondary">
                Adicione uma camada extra de segurança à sua conta
              </p>
            </div>
          </div>

          <div className="rounded-btn bg-brand-50 p-4 space-y-2">
            <p className="text-xs font-medium text-brand-700">Como funciona:</p>
            <ol className="text-xs text-brand-600 space-y-1 list-decimal list-inside">
              <li>Instale o Google Authenticator ou Authy no celular</li>
              <li>Escaneie o QR code que vamos gerar</li>
              <li>Digite o código de 6 dígitos para confirmar</li>
              <li>No próximo login, o sistema vai pedir esse código</li>
            </ol>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generate.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-btn bg-brand-500 py-3 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            <IconQrcode size={16} />
            {generate.isPending ? 'Gerando...' : 'Configurar TOTP'}
          </button>
        </>
      )}

      {step === 'scan' && (
        <>
          <p className="text-sm font-medium text-text-primary">
            1. Escaneie o QR code com o seu autenticador
          </p>
          <div className="flex justify-center">
            {qrDataUrl && (
              <Image
                src={qrDataUrl}
                alt="QR Code TOTP"
                width={200}
                height={200}
                className="rounded-lg border border-surface-border"
              />
            )}
          </div>
          <button
            onClick={() => setStep('confirm')}
            className="w-full rounded-btn bg-brand-500 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
          >
            Já escaniei → Continuar
          </button>
        </>
      )}

      {step === 'confirm' && (
        <>
          <p className="text-sm font-medium text-text-primary">
            2. Digite o código do autenticador para confirmar
          </p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            autoFocus
            className="w-full rounded-btn border border-surface-border px-3 py-2.5 text-center text-3xl tracking-widest focus:border-brand-500 focus:outline-none"
          />
          <button
            onClick={handleActivate}
            disabled={code.length !== 6 || activate.isPending}
            className="w-full rounded-btn bg-brand-500 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-40"
          >
            {activate.isPending ? 'Verificando...' : 'Ativar TOTP'}
          </button>
        </>
      )}

      {step === 'done' && (
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
              <IconShieldCheck size={28} className="text-status-ok" />
            </div>
          </div>
          <p className="text-sm font-medium text-text-primary">TOTP ativado com sucesso!</p>
          <p className="text-xs text-text-secondary">
            No próximo login, o sistema vai pedir o código do autenticador.
          </p>
        </div>
      )}
    </div>
  );
}

Passo 5 — Tela de verificação TOTP no login
Substitui app/login/totp/page.tsx:
typescript'use client';

import { useState }    from 'react';
import { useRouter }   from 'next/navigation';
import { api }         from '@/lib/trpc/client';
import { toast }       from 'sonner';
import { IconPackage } from '@tabler/icons-react';

export default function TotpVerifyPage() {
  const router         = useRouter();
  const [code, setCode]= useState('');
  const [loading, setLoading] = useState(false);
  const verify = api.totp.verify.useMutation();

  const handleVerify = async () => {
    if (code.length !== 6 || loading) return;
    setLoading(true);
    try {
      await verify.mutateAsync({ code });
      toast.success('Verificado com sucesso');
      router.push('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Código inválido');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500">
            <IconPackage size={22} className="text-white" />
          </div>
          <h1 className="text-base font-medium text-text-primary">Verificação em dois fatores</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Digite o código do seu autenticador
          </p>
        </div>

        <div className="rounded-card border border-surface-border bg-white p-6 space-y-4">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            autoFocus
            className="w-full rounded-btn border border-surface-border px-3 py-2.5 text-center text-3xl tracking-widest focus:border-brand-500 focus:outline-none"
          />

          {/* Teclado numérico visual */}
          <div className="grid grid-cols-3 gap-2">
            {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((k, i) => (
              <button
                key={i}
                onClick={() => {
                  if (k === '⌫') setCode((p) => p.slice(0, -1));
                  else if (k !== '' && code.length < 6) setCode((p) => p + String(k));
                }}
                className={`rounded-btn py-3 text-xl font-medium transition-colors ${
                  k === '' ? 'invisible' :
                  k === '⌫' ? 'bg-surface text-text-secondary hover:bg-surface-border' :
                  'bg-surface text-text-primary hover:bg-brand-50'
                }`}
              >
                {k}
              </button>
            ))}
          </div>

          <button
            onClick={handleVerify}
            disabled={code.length !== 6 || loading}
            className="w-full rounded-btn bg-brand-500 py-3 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-40"
          >
            {loading ? 'Verificando...' : 'Verificar'}
          </button>

          <p className="text-center text-xs text-text-muted">
            Abra o Google Authenticator ou Authy e 
            copie o código de 6 dígitos do StockBridge
          </p>
        </div>
      </div>
    </div>
  );
}

Passo 6 — Atualizar proxy.ts (step-up para admins)
Substitui proxy.ts:
typescriptimport { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS  = ['/login', '/login/verify', '/login/error', '/login/totp'];
const DRIVER_PATHS  = ['/driver'];
const TOTP_PATH     = '/login/totp';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  const sessionToken =
    request.cookies.get('authjs.session-token') ??
    request.cookies.get('__Secure-authjs.session-token');
  const isLoggedIn = !!sessionToken;

  // Não logado → login
  if (!isPublic && !isLoggedIn) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Logado + página pública → dashboard
  if (isPublic && isLoggedIn && !pathname.startsWith(TOTP_PATH)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon\\.ico|icons).*)'],
};
Nota: A verificação real de TOTP (se a sessão passou pelo step-up) acontece nos layouts dos server components — o proxy apenas protege rotas não autenticadas. O layout do admin verifica session.totpVerified.

Passo 7 — Verificação de TOTP no layout admin
Atualiza app/(admin)/layout.tsx:
typescriptimport { auth }     from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { db }       from '@/db/client';
import { users, sessions } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role === 'driver') redirect('/driver');

  // Verifica se admin tem TOTP ativo e se já verificou nesta sessão
  if (session.user.role === 'admin') {
    const user = await db.query.users.findFirst({
      where: (u, { eq: eqFn }) => eqFn(u.id, session.user.id),
      columns: { totpSecret: true },
    });

    if (user?.totpSecret) {
      // Busca sessão atual para verificar totpVerified
      const currentSession = await db.query.sessions.findFirst({
        where: (s, { eq: eqFn }) => eqFn(s.userId, session.user.id),
        columns: { totpVerified: true },
      });

      if (!currentSession?.totpVerified) {
        redirect('/login/totp');
      }
    }
  }

  return (
    // ... layout existente
  );
}

Passo 8 — Link no sidebar para configurações TOTP
Adiciona em components/admin/layout/sidebar.tsx:
typescript// No array de navigation items, adiciona:
{
  href:  '/settings/totp',
  icon:  IconShield,
  label: 'Segurança',
}

Passo 9 — Sanity check
bashpnpm typecheck
pnpm check
pnpm test
pnpm dev
Fluxo para testar manualmente:

Acessa /settings/totp
Clica "Configurar TOTP"
Escaneia QR code com Google Authenticator
Digita código → ativa
Faz logout
Faz login com magic link
Deve redirecionar para /login/totp
Digita código → entra no dashboard