import { IconArrowLeft, IconMailCheck, IconPackage } from '@tabler/icons-react';
import Link from 'next/link';

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
          <h2 className="mb-2 text-sm font-medium text-text-primary">Verifique seu e-mail</h2>
          <p className="mb-6 text-sm text-text-secondary leading-relaxed">
            Enviamos um link de acesso. Clique no link para entrar no sistema. O link expira em{' '}
            <strong>10 minutos</strong>.
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
