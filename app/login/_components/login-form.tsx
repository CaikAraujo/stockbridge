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

  const inputStyle: React.CSSProperties = {
    height: 52,
    border: '1.5px solid #E3E9F2',
    borderRadius: 14,
    padding: '0 16px',
    font: '500 15px var(--font-driver)',
    color: '#12203A',
    background: '#FFFFFF',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    font: '600 12px var(--font-driver)',
    color: '#7A879C',
    display: 'block',
    marginBottom: 6,
  };

  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: 22,
        padding: '24px 20px',
        boxShadow: '0 10px 30px rgba(17,42,94,.1)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {step === 'email' && (
        <>
          <div style={{ font: '700 17px var(--font-driver)', color: '#12203A', letterSpacing: '-.01em' }}>
            Entrar na sua conta
          </div>

          {error && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                background: 'var(--danger-bg)',
                color: 'var(--danger-ink)',
                font: '600 13px var(--font-driver)',
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor="login-email" style={labelStyle}>E-mail</label>
            <input
              id="login-email"
              type="email"
              name="email"
              required
              autoFocus
              placeholder="voce@vffroid.ch"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                height: 56,
                border: 'none',
                borderRadius: 100,
                background: '#1D5FE0',
                color: '#FFFFFF',
                font: '700 16px var(--font-driver)',
                cursor: 'pointer',
                boxShadow: '0 8px 22px rgba(29,95,224,.35)',
                marginTop: 4,
                opacity: loading ? 0.7 : 1,
                transition: 'opacity .15s',
              }}
            >
              {loading ? 'A verificar…' : 'Continuar'}
            </button>
          </form>

          {/* Nota informativa */}
          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              padding: '12px 14px',
              borderRadius: 12,
              background: 'var(--info-bg)',
              color: 'var(--info-ink)',
              font: '600 12.5px var(--font-driver)',
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
            Admins e gestores recebem link seguro. Motoristas entram com senha.
          </div>
        </>
      )}

      {step === 'password' && (
        <div>
          {/* Botão voltar */}
          <button
            type="button"
            onClick={() => { setStep('email'); setPassword(''); setError(null); }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'none',
              border: 'none',
              padding: '0 0 16px',
              cursor: 'pointer',
              color: '#7A879C',
              font: '600 13px var(--font-driver)',
            }}
          >
            <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Voltar
          </button>

          <div style={{ font: '700 17px var(--font-driver)', color: '#12203A', letterSpacing: '-.01em' }}>
            Olá, {driverName}
          </div>
          <div style={{ font: '500 13px var(--font-driver)', color: '#7A879C', marginTop: 4, marginBottom: 16 }}>
            Introduza a sua senha para continuar.
          </div>

          {error && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                background: 'var(--danger-bg)',
                color: 'var(--danger-ink)',
                font: '600 13px var(--font-driver)',
                marginBottom: 12,
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor="login-password" style={labelStyle}>Senha</label>

            {/* Wrapper do campo de senha com toggle */}
            <div
              style={{
                height: 52,
                border: '1.5px solid #E3E9F2',
                borderRadius: 14,
                padding: '0 12px 0 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: '#FFFFFF',
              }}
            >
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
                  border: 0, outline: 0, background: 'transparent',
                  flex: 1, minWidth: 0,
                  font: '500 15px var(--font-driver)',
                  color: '#12203A',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                style={{ background: 'none', border: 'none', padding: '0 2px', cursor: 'pointer', color: '#A6B1C2', display: 'flex', alignItems: 'center' }}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading || !password}
              style={{
                height: 56,
                border: 'none',
                borderRadius: 100,
                background: '#1D5FE0',
                color: '#FFFFFF',
                font: '700 16px var(--font-driver)',
                cursor: 'pointer',
                boxShadow: '0 8px 22px rgba(29,95,224,.35)',
                marginTop: 4,
                opacity: loading || !password ? 0.4 : 1,
                transition: 'opacity .15s',
              }}
            >
              {loading ? 'A entrar…' : 'Entrar'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
