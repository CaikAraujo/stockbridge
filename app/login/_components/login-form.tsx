'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TRPCClientError } from '@trpc/client';
import { api } from '@/lib/trpc/client';
import type { sendMagicLinkAction } from '../actions';

type Step = 'email' | 'password';

interface LoginFormProps {
  sendMagicLink: typeof sendMagicLinkAction;
  initialError?: string;
  callbackUrl?: string;
}

export function LoginForm({ sendMagicLink, initialError, callbackUrl }: LoginFormProps) {
  const router = useRouter();
  const utils = api.useUtils();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [driverName, setDriverName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

  const verifyPasswordMutation = api.users.verifyDriverPassword.useMutation();

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const result = await utils.users.checkDriverEmail.fetch({ email: email.trim() });

      if (result.isDriver) {
        if (!result.hasPassword) {
          setError('Senha não configurada. Contacte o administrador.');
          return;
        }
        setDriverName(result.name);
        setStep('password');
      } else {
        const res = await sendMagicLink(email.trim(), callbackUrl);
        if (res?.error === 'RateLimit') {
          setError('Muitas tentativas. Aguarde 10 minutos.');
        }
      }
    } catch {
      setError('Erro ao verificar e-mail. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError(null);

    try {
      const result = await verifyPasswordMutation.mutateAsync({
        email: email.trim(),
        password,
      });

      const isHttps = window.location.protocol === 'https:';
      const maxAge = 30 * 24 * 3600;
      if (isHttps) {
        document.cookie = `__Secure-authjs.session-token=${result.sessionToken}; path=/; max-age=${maxAge}; SameSite=Lax; Secure`;
      } else {
        document.cookie = `authjs.session-token=${result.sessionToken}; path=/; max-age=${maxAge}; SameSite=Lax`;
      }

      router.push('/driver');
    } catch (err) {
      if (err instanceof TRPCClientError) {
        if (err.data?.code === 'TOO_MANY_REQUESTS') {
          setError(err.message);
        } else if (err.data?.code === 'UNAUTHORIZED') {
          setError('Senha incorreta.');
          setPassword('');
        } else {
          setError(err.message);
        }
      } else {
        setError('Erro inesperado. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  }

  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div className="login-card screen-enter">
      {step === 'email' && (
        <>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Acesso ao sistema</h2>
          <p style={{ color: 'var(--muted)', fontSize: 13.5, margin: '6px 0 24px' }}>
            Informe seu e-mail para continuar.
          </p>

          {error && (
            <div
              style={{
                marginBottom: 16,
                padding: '12px 14px',
                borderRadius: 10,
                background: 'var(--danger-bg)',
                color: 'var(--danger-ink)',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleEmailSubmit}>
            <label
              htmlFor="login-email"
              style={{ fontSize: 12.5, fontWeight: 800, display: 'block', marginBottom: 7 }}
            >
              E-mail
            </label>

            <div className="field" style={{ height: 46, borderRadius: 12, marginBottom: 14 }}>
              <svg
                viewBox="0 0 24 24"
                width={17}
                height={17}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="5" width="18" height="14" rx="2.5" />
                <path d="M3.5 7l8.5 6 8.5-6" />
              </svg>
              <input
                id="login-email"
                type="email"
                name="email"
                required
                autoFocus
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  border: 0,
                  outline: 0,
                  background: 'transparent',
                  flex: 1,
                  minWidth: 0,
                  fontSize: 13.5,
                  color: 'var(--ink)',
                  height: '100%',
                }}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', height: 46, borderRadius: 12, fontSize: 14.5 }}
            >
              {loading ? 'A verificar…' : 'Continuar'}
            </button>
          </form>

          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              marginTop: 18,
              padding: '12px 14px',
              borderRadius: 12,
              background: 'var(--info-bg)',
              color: 'var(--info-ink)',
              fontSize: 12.5,
              fontWeight: 600,
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width={15}
              height={15}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginTop: 1, flexShrink: 0 }}
              aria-hidden="true"
            >
              <rect x="5" y="11" width="14" height="9.5" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            Admins e gestores recebem um link seguro por e-mail. Motoristas entram com senha.
          </div>
        </>
      )}

      {step === 'password' && (
        <div
          style={{
            animation: prefersReducedMotion ? 'none' : 'slideInRight 0.25s ease-out',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setStep('email');
              setPassword('');
              setError(null);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'none',
              border: 'none',
              padding: '0 0 18px',
              cursor: 'pointer',
              color: 'var(--muted)',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width={14}
              height={14}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Voltar
          </button>

          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Olá, {driverName}</h2>
          <p style={{ color: 'var(--muted)', fontSize: 13.5, margin: '6px 0 24px' }}>
            Introduza a sua senha para continuar.
          </p>

          {error && (
            <div
              style={{
                marginBottom: 16,
                padding: '12px 14px',
                borderRadius: 10,
                background: 'var(--danger-bg)',
                color: 'var(--danger-ink)',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handlePasswordSubmit}>
            <label
              htmlFor="login-password"
              style={{ fontSize: 12.5, fontWeight: 800, display: 'block', marginBottom: 7 }}
            >
              Senha
            </label>

            <div className="field" style={{ height: 46, borderRadius: 12, marginBottom: 14 }}>
              <svg
                viewBox="0 0 24 24"
                width={17}
                height={17}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="5" y="11" width="14" height="9.5" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                required
                autoFocus
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  border: 0,
                  outline: 0,
                  background: 'transparent',
                  flex: 1,
                  minWidth: 0,
                  fontSize: 13.5,
                  color: 'var(--ink)',
                  height: '100%',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '0 2px',
                  cursor: 'pointer',
                  color: 'var(--muted)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showPassword ? (
                  <svg
                    viewBox="0 0 24 24"
                    width={16}
                    height={16}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    width={16}
                    height={16}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !password}
              style={{ width: '100%', height: 46, borderRadius: 12, fontSize: 14.5 }}
            >
              {loading ? 'A entrar…' : 'Entrar'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
