'use client';

import { IconPackage, IconShieldLock } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/trpc/client';

const KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, '⌫'] as const;
type Key = (typeof KEYS)[number];

export default function TotpVerifyPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
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

  const handleKey = (k: Key) => {
    if (k === '⌫') {
      setCode((prev) => prev.slice(0, -1));
    } else if (k !== null && code.length < 6) {
      setCode((prev) => prev + String(k));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500">
            <IconPackage size={22} className="text-white" />
          </div>
          <h1 className="text-base font-medium text-text-primary">Verificação em dois fatores</h1>
          <p className="mt-1 text-sm text-text-secondary">Digite o código do seu autenticador</p>
        </div>

        <div className="rounded-card border border-surface-border bg-white p-6 space-y-4">
          {/* Ícone */}
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
              <IconShieldLock size={24} className="text-brand-500" />
            </div>
          </div>

          {/* Display do código */}
          <div className="flex justify-center gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: posição fixa
                key={i}
                className="flex h-11 w-9 items-center justify-center rounded-btn border border-surface-border text-lg font-medium text-text-primary"
              >
                {code[i] ? '•' : ''}
              </div>
            ))}
          </div>

          {/* Teclado numérico visual */}
          <div className="grid grid-cols-3 gap-2">
            {KEYS.map((k, i) => (
              <button
                // biome-ignore lint/suspicious/noArrayIndexKey: grade fixa
                key={i}
                type="button"
                onClick={() => handleKey(k)}
                disabled={k === null}
                className={[
                  'rounded-btn py-3 text-xl font-medium transition-colors',
                  k === null
                    ? 'invisible'
                    : k === '⌫'
                      ? 'bg-surface text-text-secondary hover:bg-surface-border'
                      : 'bg-surface text-text-primary hover:bg-brand-50',
                ].join(' ')}
              >
                {k}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleVerify}
            disabled={code.length !== 6 || loading}
            className="w-full rounded-btn bg-brand-500 py-3 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Verificando...' : 'Verificar'}
          </button>

          <p className="text-center text-xs text-text-muted">
            Abra o Google Authenticator ou Authy e copie o código de 6 dígitos do StockBridge
          </p>

          <Link
            href="/login"
            className="block text-center text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            Voltar ao login
          </Link>
        </div>
      </div>
    </div>
  );
}
