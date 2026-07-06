'use client';

import {
  IconArrowLeft,
  IconCheck,
  IconLock,
  IconMinus,
  IconPlus,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
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
  const submittingRef = useRef(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');

  const isOnline = useOnlineStatus();
  const { updateCount } = useOfflineQueue();
  const withdrawMutation = api.movements.withdraw.useMutation();
  const returnMutation = api.movements.return.useMutation();
  const verifyPinMutation = api.users.verifyPin.useMutation();

  const handleConfirm = () => {
    if (qty <= 0) return;
    setPin(''); setPinError(''); setShowPin(true);
  };

  const handlePinKey = (key: PinKey) => {
    if (key === '⌫') { setPin((p) => p.slice(0, -1)); }
    else if (key !== '' && pin.length < 4) { setPin((p) => p + String(key)); }
  };

  const handlePinSubmit = async () => {
    if (pin.length !== 4 || submittingRef.current) return;
    submittingRef.current = true; setLoading(true); setPinError('');
    try {
      const key = uuidv4();
      if (isOnline) {
        await verifyPinMutation.mutateAsync({ pin });
        if (action === 'withdraw') {
          await withdrawMutation.mutateAsync({ articleId: article.id, quantity: qty, fromLocationId: warehouse.id, toLocationId: truck.id, idempotencyKey: key });
        } else {
          await returnMutation.mutateAsync({ articleId: article.id, quantity: qty, fromLocationId: truck.id, toLocationId: warehouse.id, idempotencyKey: key });
        }
        toast.success(`${qty} ${article.unit} ${action === 'withdraw' ? 'retirado(s)' : 'devolvido(s)'} com sucesso`);
      } else {
        addToQueue({ id: key, type: action, payload: { articleId: article.id, quantity: qty, fromLocationId: action === 'withdraw' ? warehouse.id : truck.id, toLocationId: action === 'withdraw' ? truck.id : warehouse.id, idempotencyKey: key, articleName: article.name, unit: article.unit }, createdAt: new Date().toISOString() });
        updateCount();
        toast.info('Sem conexão. Operação salva — será enviada quando voltar online.', { duration: 5000 });
      }
      setShowPin(false); router.push('/driver');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro';
      if (msg.includes('PIN')) { setPinError(msg); setPin(''); }
      else { toast.error(msg); setShowPin(false); }
    } finally { submittingRef.current = false; setLoading(false); }
  };

  const decrease = () => setQty((q) => Math.max(STEP, parseFloat((q - STEP).toFixed(3))));
  const increase = () => setQty((q) => parseFloat((q + STEP).toFixed(3)));
  const isWithdraw = action === 'withdraw';

  const confirmBg = isWithdraw ? '#1D5FE0' : '#12905B';
  const confirmShadow = isWithdraw ? '0 8px 22px rgba(29,95,224,.35)' : '0 8px 22px rgba(18,144,91,.35)';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: '#FFF', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 2px 10px rgba(17,42,94,.05)', flexShrink: 0 }}>
        <button type="button" onClick={() => router.back()} aria-label="Voltar"
          style={{ width: 38, height: 38, borderRadius: '50%', background: '#F2F5F9', display: 'grid', placeItems: 'center', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
          <IconArrowLeft size={17} color="#12203A" />
        </button>
        <div style={{ minWidth: 0 }}>
          <div style={{ font: '700 16px var(--font-driver)', color: '#12203A', letterSpacing: '-.01em' }}>{article.name}</div>
          <div style={{ font: '500 12px var(--font-driver)', color: '#7A879C' }}>SKU {article.sku}</div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, padding: 18, overflow: 'auto' }}>
        {/* Seletor de modo */}
        <div style={{ background: '#E7ECF4', borderRadius: 100, padding: 5, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {(['withdraw', 'return'] as const).map((a) => {
            const active = action === a;
            const activeColor = a === 'withdraw' ? '#1D5FE0' : '#12905B';
            return (
              <button key={a} type="button" onClick={() => setAction(a)} style={{
                background: active ? '#FFF' : 'transparent', borderRadius: 100, padding: 12,
                textAlign: 'center', border: 'none', cursor: 'pointer',
                boxShadow: active ? '0 2px 8px rgba(17,42,94,.1)' : 'none',
                font: `${active ? 700 : 600} 14px var(--font-driver)`,
                color: active ? activeColor : '#7A879C', transition: 'all .15s',
              }}>
                {a === 'withdraw' ? '↓ Retirada' : '↑ Devolução'}
              </button>
            );
          })}
        </div>

        {/* Card de quantidade */}
        <div style={{ background: '#FFF', borderRadius: 22, padding: '24px 20px', boxShadow: '0 6px 20px rgba(17,42,94,.07)', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
          <span style={{ font: '600 13px var(--font-driver)', color: '#7A879C' }}>
            Quantidade em {article.unit}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <button type="button" onClick={decrease} aria-label="Diminuir"
              style={{ width: 56, height: 56, borderRadius: '50%', border: 'none', background: '#F2F5F9', font: '500 26px var(--font-driver)', color: '#12203A', cursor: 'pointer' }}>
              <IconMinus size={22} color="#12203A" />
            </button>
            <span style={{ font: '800 52px var(--font-driver)', color: '#12203A', minWidth: 110, textAlign: 'center', letterSpacing: '-.03em', fontVariantNumeric: 'tabular-nums' }}>
              {qty.toFixed(1)}
            </span>
            <button type="button" onClick={increase} aria-label="Aumentar"
              style={{ width: 56, height: 56, borderRadius: '50%', border: 'none', background: '#1D5FE0', font: '500 26px var(--font-driver)', color: '#FFF', cursor: 'pointer', boxShadow: '0 4px 12px rgba(29,95,224,.35)' }}>
              <IconPlus size={22} color="#fff" />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[5, 10, 50].map((n) => (
              <button key={n} type="button" onClick={() => setQty((q) => parseFloat((q + n).toFixed(3)))}
                style={{ padding: '9px 18px', background: '#F2F5F9', border: 'none', borderRadius: 100, font: '700 13px var(--font-driver)', color: '#12203A', cursor: 'pointer' }}>
                +{n}
              </button>
            ))}
          </div>
        </div>

        {/* Info de rota */}
        <div style={{ background: '#FFF', borderRadius: 18, padding: '14px 18px', boxShadow: '0 4px 14px rgba(17,42,94,.05)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ font: '700 13px var(--font-driver)', color: '#12203A' }}>
              {isWithdraw ? warehouse.name : truck.name}
            </span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1D5FE0" strokeWidth="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            <span style={{ font: '700 13px var(--font-driver)', color: '#12203A' }}>
              {isWithdraw ? truck.name : warehouse.name}
            </span>
          </div>
          <span style={{ font: '500 12px var(--font-driver)', color: '#7A879C' }}>Operador · {userName}</span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Botão confirmar */}
        <button type="button" onClick={handleConfirm} disabled={qty <= 0}
          style={{ height: 58, border: 'none', borderRadius: 100, background: confirmBg, color: '#FFF', font: '700 16px var(--font-driver)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: confirmShadow, width: '100%', opacity: qty <= 0 ? 0.4 : 1 }}>
          <IconCheck size={18} color="#fff" strokeWidth={2.4} />
          Confirmar {isWithdraw ? 'retirada' : 'devolução'} · {qty.toFixed(1)} {article.unit}
        </button>
      </div>

      {/* Modal PIN — bottom sheet */}
      {showPin && (
        <div className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(10,25,48,.45)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowPin(false); }}>
          <div style={{ width: '100%', borderRadius: '26px 26px 0 0', background: '#FFF', padding: '14px 20px 32px', boxShadow: '0 -12px 40px rgba(10,25,48,.25)' }}>
            <div style={{ width: 40, height: 4, borderRadius: 100, background: '#E3E9F2', margin: '0 auto 16px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#EAF0FB', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <IconLock size={18} color="#1D5FE0" />
              </div>
              <div>
                <p style={{ font: '700 14px var(--font-driver)', color: '#12203A', margin: 0 }}>Confirme com seu PIN</p>
                <p style={{ font: '500 12px var(--font-driver)', color: '#7A879C', margin: 0 }}>4 dígitos para autorizar</p>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 8 }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: i < pin.length ? '#1D5FE0' : '#E3E9F2', transition: 'background .15s' }} />
              ))}
            </div>
            {pinError && <p style={{ textAlign: 'center', font: '500 12px var(--font-driver)', color: '#D93636', marginBottom: 8 }}>{pinError}</p>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
              {PIN_KEYS.map((key) => (
                <button key={String(key)} type="button" onClick={() => handlePinKey(key)} disabled={loading}
                  style={{ borderRadius: 14, padding: '14px 0', font: '600 20px var(--font-driver)', border: 'none', cursor: key === '' ? 'default' : 'pointer', background: key === '' ? 'transparent' : '#F2F5F9', color: '#12203A', visibility: key === '' ? 'hidden' : 'visible', opacity: loading ? 0.5 : 1 }}>
                  {key}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setShowPin(false)} disabled={loading}
                style={{ flex: 1, borderRadius: 100, border: '1.5px solid #E3E9F2', padding: '14px 0', font: '600 14px var(--font-driver)', color: '#7A879C', background: '#FFF', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button type="button" onClick={() => void handlePinSubmit()} disabled={pin.length !== 4 || loading}
                style={{ flex: 1, borderRadius: 100, border: 'none', padding: '14px 0', font: '700 14px var(--font-driver)', color: '#FFF', background: '#1D5FE0', cursor: 'pointer', opacity: pin.length !== 4 || loading ? 0.4 : 1, boxShadow: '0 4px 12px rgba(29,95,224,.35)' }}>
                {loading ? 'Verificando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
