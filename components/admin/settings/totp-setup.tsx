'use client';

import { IconQrcode, IconShieldCheck, IconShieldOff } from '@tabler/icons-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/trpc/client';

type Step = 'idle' | 'scan' | 'confirm' | 'done';

export function TotpSetup({ totpEnabled }: { totpEnabled: boolean }) {
  const [step, setStep] = useState<Step>('idle');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [code, setCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [showDisable, setShowDisable] = useState(false);

  const generate = api.totp.setupGenerate.useMutation();
  const activate = api.totp.setupActivate.useMutation();
  const disable = api.totp.disable.useMutation();

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
            type="button"
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
                type="button"
                onClick={() => {
                  setShowDisable(false);
                  setDisableCode('');
                }}
                className="flex-1 rounded-btn border border-surface-border py-2 text-sm text-text-secondary hover:bg-surface"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDisable}
                disabled={disableCode.length !== 6 || disable.isPending}
                className="flex-1 rounded-btn bg-status-critical py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                {disable.isPending ? 'Desativando...' : 'Desativar'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

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
            type="button"
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
              // biome-ignore lint/performance/noImgElement: data URL — next/image não suporta
              <img
                src={qrDataUrl}
                alt="QR Code TOTP"
                width={200}
                height={200}
                className="rounded-lg border border-surface-border"
              />
            )}
          </div>
          <button
            type="button"
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
            className="w-full rounded-btn border border-surface-border px-3 py-2.5 text-center text-3xl tracking-widest focus:border-brand-500 focus:outline-none"
          />
          <button
            type="button"
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
