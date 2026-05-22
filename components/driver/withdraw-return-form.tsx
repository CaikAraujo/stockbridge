'use client';

import {
  IconArrowDown,
  IconArrowLeft,
  IconArrowUp,
  IconCheck,
  IconLock,
  IconMinus,
  IconPackage,
  IconPlus,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { useOfflineQueue } from '@/hooks/use-offline-queue';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { addToQueue } from '@/lib/offline-queue';
import { api } from '@/lib/trpc/client';

type Article = { id: string; name: string; sku: string; unit: string };
type Location = { id: string; name: string; code: string };
type Action = 'withdraw' | 'return';

const STEP = 0.5;

// Teclado numérico 3×4 — '' é célula invisível, '⌫' é backspace
const PIN_KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'] as const;
type PinKey = (typeof PIN_KEYS)[number];

interface Props {
  article: Article;
  warehouse: Location;
  truck: Location;
  userName: string;
}

export function WithdrawReturnForm({ article, warehouse, truck, userName }: Props) {
  const router = useRouter();

  const [action, setAction] = useState<Action>('withdraw');
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');

  const isOnline = useOnlineStatus();
  const { updateCount } = useOfflineQueue();

  const withdrawMutation = api.movements.withdraw.useMutation();
  const returnMutation = api.movements.return.useMutation();
  const verifyPinMutation = api.users.verifyPin.useMutation();

  // Etapa 1 — abre o modal de PIN (não executa nada ainda)
  const handleConfirm = () => {
    if (qty <= 0) return;
    setPin('');
    setPinError('');
    setShowPin(true);
  };

  const handlePinKey = (key: PinKey) => {
    if (key === '⌫') {
      setPin((p) => p.slice(0, -1));
    } else if (key !== '' && pin.length < 4) {
      setPin((p) => p + String(key));
    }
  };

  const handlePinSubmit = async () => {
    if (pin.length !== 4) return;
    setLoading(true);
    setPinError('');

    try {
      const key = uuidv4();

      if (isOnline) {
        await verifyPinMutation.mutateAsync({ pin });

        if (action === 'withdraw') {
          await withdrawMutation.mutateAsync({
            articleId: article.id,
            quantity: qty,
            fromLocationId: warehouse.id,
            toLocationId: truck.id,
            idempotencyKey: key,
          });
        } else {
          await returnMutation.mutateAsync({
            articleId: article.id,
            quantity: qty,
            fromLocationId: truck.id,
            toLocationId: warehouse.id,
            idempotencyKey: key,
          });
        }
        toast.success(
          `${qty} ${article.unit} ${action === 'withdraw' ? 'retirado(s)' : 'devolvido(s)'} com sucesso`,
        );
      } else {
        addToQueue({
          id: key,
          type: action,
          payload: {
            articleId: article.id,
            quantity: qty,
            fromLocationId: action === 'withdraw' ? warehouse.id : truck.id,
            toLocationId: action === 'withdraw' ? truck.id : warehouse.id,
            idempotencyKey: key,
            articleName: article.name,
            unit: article.unit,
          },
          createdAt: new Date().toISOString(),
        });
        updateCount();
        toast.info('Sem conexão. Operação salva — será enviada quando voltar online.', {
          duration: 5000,
        });
      }

      setShowPin(false);
      router.push('/driver');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro';
      if (msg.includes('PIN')) {
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

  const decrease = () => setQty((q) => Math.max(STEP, parseFloat((q - STEP).toFixed(3))));
  const increase = () => setQty((q) => parseFloat((q + STEP).toFixed(3)));

  const isWithdraw = action === 'withdraw';

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <div className="bg-brand-500 px-4 pb-6 pt-10">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20"
            aria-label="Voltar"
          >
            <IconArrowLeft size={18} className="text-white" />
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
            <IconPackage size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-medium text-white">{article.name}</h1>
            <p className="text-xs text-white/75">SKU: {article.sku}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-auto p-4">
        {/* Seleção de ação */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setAction('withdraw')}
            className={`flex flex-col items-center gap-2 rounded-card border-2 p-4 transition-colors ${
              isWithdraw ? 'border-brand-500 bg-brand-50' : 'border-surface-border bg-white'
            }`}
          >
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full ${isWithdraw ? 'bg-brand-500' : 'bg-surface'}`}
            >
              <IconArrowDown
                size={20}
                className={isWithdraw ? 'text-white' : 'text-text-secondary'}
              />
            </div>
            <span
              className={`text-sm font-medium ${isWithdraw ? 'text-brand-500' : 'text-text-secondary'}`}
            >
              Retirada
            </span>
            <span className="text-center text-xs text-text-muted">Depósito → Caminhão</span>
          </button>

          <button
            type="button"
            onClick={() => setAction('return')}
            className={`flex flex-col items-center gap-2 rounded-card border-2 p-4 transition-colors ${
              !isWithdraw ? 'border-status-ok bg-green-50' : 'border-surface-border bg-white'
            }`}
          >
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full ${!isWithdraw ? 'bg-status-ok' : 'bg-surface'}`}
            >
              <IconArrowUp
                size={20}
                className={!isWithdraw ? 'text-white' : 'text-text-secondary'}
              />
            </div>
            <span
              className={`text-sm font-medium ${!isWithdraw ? 'text-status-ok' : 'text-text-secondary'}`}
            >
              Devolução
            </span>
            <span className="text-center text-xs text-text-muted">Caminhão → Depósito</span>
          </button>
        </div>

        {/* Seletor de quantidade */}
        <div className="rounded-card border border-surface-border bg-white p-5">
          <p className="mb-4 text-center text-sm font-medium text-text-primary">
            Quantidade ({article.unit})
          </p>
          <div className="flex items-center justify-center gap-6">
            <button
              type="button"
              onClick={decrease}
              aria-label="Diminuir"
              className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-surface-border bg-surface transition-colors hover:border-brand-500 hover:bg-brand-50"
            >
              <IconMinus size={20} className="text-text-secondary" />
            </button>
            <div className="text-center">
              <p className="text-4xl font-medium text-text-primary">{qty.toFixed(1)}</p>
              <p className="text-sm text-text-muted">{article.unit}</p>
            </div>
            <button
              type="button"
              onClick={increase}
              aria-label="Aumentar"
              className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-surface-border bg-surface transition-colors hover:border-brand-500 hover:bg-brand-50"
            >
              <IconPlus size={20} className="text-text-secondary" />
            </button>
          </div>
          <input
            type="number"
            step={STEP}
            min={STEP}
            value={qty}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!Number.isNaN(v) && v > 0) setQty(v);
            }}
            className="mt-4 w-full rounded-btn border border-surface-border px-3 py-2 text-center text-sm text-text-primary focus:border-brand-500 focus:outline-none"
          />
        </div>

        {/* Resumo da operação */}
        <div className="rounded-btn bg-surface px-4 py-3 text-xs text-text-secondary">
          {isWithdraw ? (
            <p>
              <strong>{warehouse.name}</strong> → <strong>{truck.name}</strong>
            </p>
          ) : (
            <p>
              <strong>{truck.name}</strong> → <strong>{warehouse.name}</strong>
            </p>
          )}
          <p className="mt-0.5">Operador: {userName}</p>
        </div>
      </div>

      {/* Botão principal — abre modal de PIN */}
      <div className="border-t border-surface-border bg-white p-4">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={qty <= 0}
          className={`flex w-full items-center justify-center gap-2 rounded-btn py-4 text-base font-medium text-white transition-colors disabled:opacity-40 ${
            isWithdraw ? 'bg-brand-500 hover:bg-brand-600' : 'bg-status-ok hover:bg-green-700'
          }`}
        >
          <IconCheck size={20} />
          Confirmar {isWithdraw ? 'Retirada' : 'Devolução'}
        </button>
      </div>

      {/* Modal PIN — bottom sheet */}
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

            {/* Dots de progresso */}
            <div className="mb-2 flex justify-center gap-3">
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

            {/* Teclado numérico 3×4 */}
            <div className="mb-4 grid grid-cols-3 gap-2">
              {PIN_KEYS.map((key) => (
                <button
                  key={String(key)}
                  type="button"
                  onClick={() => handlePinKey(key)}
                  disabled={loading}
                  className={`rounded-btn py-3.5 text-xl font-medium transition-colors disabled:opacity-50 ${
                    key === ''
                      ? 'invisible'
                      : key === '⌫'
                        ? 'bg-surface text-text-secondary hover:bg-surface-border'
                        : 'bg-surface text-text-primary hover:bg-brand-50'
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowPin(false)}
                disabled={loading}
                className="flex-1 rounded-btn border border-surface-border py-3 text-sm text-text-secondary hover:bg-surface disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handlePinSubmit}
                disabled={pin.length !== 4 || loading}
                className="flex-1 rounded-btn bg-brand-500 py-3 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-40"
              >
                {loading ? 'Verificando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
