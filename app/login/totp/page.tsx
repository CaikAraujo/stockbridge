'use client';

import { IconPackage, IconShieldLock } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/trpc/client';

const KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, '⌫'] as const;
type Key = (typeof KEYS)[number];

export default function TotpVerifyPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const verify = api.totp.verify.useMutation();

  // Foca o input invisível ao montar para capturar teclado imediatamente
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleVerify = async (codeToVerify: string) => {
    if (codeToVerify.length !== 6 || loading) return;
    setLoading(true);
    try {
      await verify.mutateAsync({ code: codeToVerify });
      toast.success('Verificado com sucesso');
      router.push('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Código inválido');
      setCode('');
      // Volta o foco após erro para nova tentativa imediata
      setTimeout(() => inputRef.current?.focus(), 0);
    } finally {
      setLoading(false);
    }
  };

  // Captura digitação do teclado físico
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (digits.length === 6) {
      handleVerify(digits);
    }
  };

  // Teclado numérico visual (mobile)
  const handleKey = (k: Key) => {
    if (loading) return;
    setCode((prev) => {
      let next: string;
      if (k === '⌫') {
        next = prev.slice(0, -1);
      } else if (k !== null && prev.length < 6) {
        next = prev + String(k);
      } else {
        next = prev;
      }
      if (next.length === 6) {
        // Auto-submit via setTimeout para garantir que setCode aplicou
        setTimeout(() => handleVerify(next), 0);
      }
      return next;
    });
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

          {/*
            Display das 6 células + input invisível sobrepostos.
            O input captura teclado físico; as células mostram o estado visual.
            Clicar em qualquer célula redireciona o foco para o input.
          */}
          <div className="relative flex justify-center gap-2 cursor-text">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: posição fixa
                key={i}
                className={[
                  'flex h-11 w-9 items-center justify-center rounded-btn border text-lg font-medium text-text-primary transition-colors',
                  i === code.length && !loading
                    ? 'border-brand-500 ring-1 ring-brand-500'
                    : 'border-surface-border',
                ].join(' ')}
              >
                {code[i] ? '•' : ''}
              </div>
            ))}

            {/* Input real: transparente, sobrepostas às células, captura teclado */}
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              value={code}
              onChange={handleInputChange}
              disabled={loading}
              aria-label="Código de verificação TOTP"
              className="absolute inset-0 opacity-0 cursor-text"
              maxLength={6}
            />
          </div>

          {/* Teclado numérico visual (alternativa mobile) */}
          <div className="grid grid-cols-3 gap-2">
            {KEYS.map((k, i) => (
              <button
                // biome-ignore lint/suspicious/noArrayIndexKey: grade fixa
                key={i}
                type="button"
                onClick={() => handleKey(k)}
                disabled={k === null || loading}
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
            onClick={() => handleVerify(code)}
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
