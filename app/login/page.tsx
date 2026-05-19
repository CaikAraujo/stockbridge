import { IconMail, IconPackage } from '@tabler/icons-react';
import { redirect } from 'next/navigation';
import { AuthError } from 'next-auth';
import { signIn } from '@/lib/auth/config';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const { error, callbackUrl } = await searchParams;

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
          {error && (
            <div className="mb-4 rounded-btn bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">
              {error === 'Verification'
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
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-text-primary">
              E-mail
            </label>
            <input
              id="email"
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
