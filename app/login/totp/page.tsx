'use client';

import { IconPackage, IconShieldLock } from '@tabler/icons-react';
import Link from 'next/link';
import { useState } from 'react';

const DIGIT_IDS = ['d0', 'd1', 'd2', 'd3', 'd4', 'd5'] as const;

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
          <h2 className="mb-1 text-sm font-medium text-text-primary">Verificação em 2 etapas</h2>
          <p className="mb-6 text-xs text-text-secondary">
            Digite o código do seu app autenticador
          </p>

          <div className="mb-2 flex justify-center gap-2">
            {DIGIT_IDS.map((id, i) => (
              <input
                key={id}
                id={`digit-${i}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digits[i] ?? ''}
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
            type="button"
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
