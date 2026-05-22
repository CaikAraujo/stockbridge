Passo 1 — PWA Manifest
app/manifest.ts
typescriptimport type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             'StockBridge',
    short_name:       'StockBridge',
    description:      'Gestão de estoque para refrigeração',
    start_url:        '/driver',
    display:          'standalone',
    background_color: '#f0f3f7',
    theme_color:      '#064875',
    orientation:      'portrait',
    icons: [
      {
        src:   '/icons/icon-192.png',
        sizes: '192x192',
        type:  'image/png',
      },
      {
        src:   '/icons/icon-512.png',
        sizes: '512x512',
        type:  'image/png',
      },
    ],
  };
}
Adiciona meta tag de tema no app/(driver)/layout.tsx:
typescriptimport type { Metadata } from 'next';

export const metadata: Metadata = {
  themeColor: '#064875',
  manifest:   '/manifest.webmanifest',
  appleWebApp: {
    capable:    true,
    title:      'StockBridge',
    statusBarStyle: 'black-translucent',
  },
};

Passo 2 — Ícones PWA
Cria o script scripts/generate-icons.mjs:
javascriptimport { createCanvas } from 'canvas';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// Instala canvas apenas para este script
// pnpm add -D canvas

const BRAND = '#064875';

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx    = canvas.getContext('2d');

  // Fundo
  ctx.fillStyle = BRAND;
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.2);
  ctx.fill();

  // "S" simples no centro
  ctx.fillStyle = '#ffffff';
  ctx.font      = `bold ${size * 0.55}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('S', size / 2, size / 2);

  return canvas.toBuffer('image/png');
}

mkdirSync(join('public', 'icons'), { recursive: true });

for (const size of [192, 512]) {
  writeFileSync(
    join('public', 'icons', `icon-${size}.png`),
    generateIcon(size),
  );
  console.log(`✓ icon-${size}.png gerado`);
}
Roda:
bashpnpm add -D canvas
node scripts/generate-icons.mjs
Confirma que public/icons/icon-192.png e icon-512.png existem.

Passo 3 — Hook useOnlineStatus
hooks/use-online-status.ts
typescript'use client';

import { useState, useEffect } from 'react';

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Valor inicial real do browser
    setIsOnline(navigator.onLine);

    const handleOnline  = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

Passo 4 — lib/offline-queue.ts
typescript'use client';

export interface PendingOperation {
  id:        string;
  type:      'withdraw' | 'return';
  payload: {
    articleId:      string;
    quantity:       number;
    fromLocationId: string;
    toLocationId:   string;
    idempotencyKey: string;
    articleName:    string;
    unit:           string;
  };
  createdAt: string;
}

const QUEUE_KEY = 'stockbridge:pending_ops';

export function getQueue(): PendingOperation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as PendingOperation[]) : [];
  } catch {
    return [];
  }
}

export function addToQueue(op: PendingOperation): void {
  const queue = getQueue();
  queue.push(op);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function removeFromQueue(id: string): void {
  const queue = getQueue().filter((op) => op.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function clearQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}

Passo 5 — Hook useOfflineQueue
hooks/use-offline-queue.ts
typescript'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/trpc/client';
import { getQueue, removeFromQueue } from '@/lib/offline-queue';
import { toast } from 'sonner';

export function useOfflineQueue() {
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing,      setSyncing]      = useState(false);
  const syncingRef = useRef(false);

  const withdraw   = api.movements.withdraw.useMutation();
  const returnItem = api.movements.return.useMutation();

  const updateCount = useCallback(() => {
    setPendingCount(getQueue().length);
  }, []);

  const processQueue = useCallback(async () => {
    if (syncingRef.current) return;
    const queue = getQueue();
    if (queue.length === 0) return;

    syncingRef.current = true;
    setSyncing(true);

    let processed = 0;
    for (const op of queue) {
      try {
        if (op.type === 'withdraw') {
          await withdraw.mutateAsync(op.payload);
        } else {
          await returnItem.mutateAsync(op.payload);
        }
        removeFromQueue(op.id);
        processed++;
        updateCount();
      } catch {
        // Mantém na fila e para — tenta na próxima reconexão
        break;
      }
    }

    if (processed > 0) {
      toast.success(
        `${processed} operação(ões) sincronizada(s) com sucesso`,
      );
    }

    syncingRef.current = false;
    setSyncing(false);
  }, [withdraw, returnItem, updateCount]);

  useEffect(() => {
    updateCount();

    const handleOnline = () => {
      updateCount();
      void processQueue();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [updateCount, processQueue]);

  return { pendingCount, syncing, processQueue, updateCount };
}

Passo 6 — Componente OfflineIndicator
components/driver/offline-indicator.tsx
typescript'use client';

import { IconWifi, IconWifiOff, IconRefresh } from '@tabler/icons-react';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { useOfflineQueue } from '@/hooks/use-offline-queue';

export function OfflineIndicator() {
  const isOnline              = useOnlineStatus();
  const { pendingCount, syncing, processQueue } = useOfflineQueue();

  // Online e sem fila → não mostra nada
  if (isOnline && pendingCount === 0 && !syncing) return null;

  return (
    <div
      className={`flex items-center justify-between gap-2 px-4 py-2 text-xs font-medium ${
        isOnline
          ? 'bg-amber-50 text-amber-800 border-b border-amber-100'
          : 'bg-red-50 text-red-700 border-b border-red-100'
      }`}
    >
      <div className="flex items-center gap-1.5">
        {isOnline
          ? <IconWifi size={13} />
          : <IconWifiOff size={13} />
        }
        {!isOnline && 'Sem conexão'}
        {isOnline && syncing && 'Sincronizando...'}
        {isOnline && !syncing && pendingCount > 0 && `${pendingCount} operação(ões) pendente(s)`}
        {!isOnline && pendingCount > 0 && ` · ${pendingCount} na fila`}
      </div>

      {isOnline && pendingCount > 0 && !syncing && (
        <button
          onClick={() => void processQueue()}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-amber-700 hover:bg-amber-100 transition-colors"
        >
          <IconRefresh size={11} />
          Sincronizar
        </button>
      )}
    </div>
  );
}

Passo 7 — Atualizar layout driver
Substitui app/(driver)/layout.tsx:
typescriptimport type { Metadata } from 'next';
import { auth }          from '@/lib/auth/config';
import { redirect }      from 'next/navigation';
import { Toaster }       from 'sonner';
import { OfflineIndicator } from '@/components/driver/offline-indicator';

export const metadata: Metadata = {
  themeColor:  '#064875',
  manifest:    '/manifest.webmanifest',
  appleWebApp: {
    capable:        true,
    title:          'StockBridge',
    statusBarStyle: 'black-translucent',
  },
};

export default async function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'driver' && session.user.role !== 'admin') {
    redirect('/dashboard');
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface mx-auto max-w-[430px]">
      <OfflineIndicator />
      <div className="flex flex-1 flex-col overflow-hidden">
        {children}
      </div>
      <Toaster position="top-center" richColors />
    </div>
  );
}

Passo 8 — Atualizar withdraw-return-form com suporte offline
Substitui apenas o método handlePinSubmit em components/driver/withdraw-return-form.tsx:
typescript// Adiciona imports no topo
import { addToQueue } from '@/lib/offline-queue';
import { useOfflineQueue } from '@/hooks/use-offline-queue';
import { useOnlineStatus } from '@/hooks/use-online-status';

// Dentro do componente, adiciona:
const isOnline              = useOnlineStatus();
const { updateCount }       = useOfflineQueue();

// Substitui handlePinSubmit por:
const handlePinSubmit = async () => {
  if (pin.length !== 4) return;
  setLoading(true);
  setPinError('');

  try {
    const key = uuidv4();

    if (isOnline) {
      // Online: verifica PIN e executa direto
      await verifyPin.mutateAsync({ pin });

      if (action === 'withdraw') {
        await withdraw.mutateAsync({
          articleId:      article.id,
          quantity:       qty,
          fromLocationId: warehouse.id,
          toLocationId:   truck.id,
          idempotencyKey: key,
        });
      } else {
        await returnItem.mutateAsync({
          articleId:      article.id,
          quantity:       qty,
          fromLocationId: truck.id,
          toLocationId:   warehouse.id,
          idempotencyKey: key,
        });
      }
      toast.success(
        `${qty} ${article.unit} ${action === 'withdraw' ? 'retirado(s)' : 'devolvido(s)'} com sucesso`,
      );
    } else {
      // Offline: salva na fila sem verificar PIN
      // (soft-PIN é antifraude social — dispensado em caso de desconexão)
      addToQueue({
        id:   key,
        type: action,
        payload: {
          articleId:      article.id,
          quantity:       qty,
          fromLocationId: action === 'withdraw' ? warehouse.id : truck.id,
          toLocationId:   action === 'withdraw' ? truck.id    : warehouse.id,
          idempotencyKey: key,
          articleName:    article.name,
          unit:           article.unit,
        },
        createdAt: new Date().toISOString(),
      });
      updateCount();
      toast.info(
        'Sem conexão. Operação salva — será enviada quando voltar online.',
        { duration: 5000 },
      );
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

Passo 9 — Sanity check
bashpnpm typecheck
pnpm check
pnpm test
pnpm dev
Teste manual do offline:

Abre http://localhost:3000/driver no browser
No DevTools → Network → coloca em Offline
Confirma que aparece o banner vermelho "Sem conexão"
Faz uma retirada — deve salvar na fila e redirecionar
Volta para Network → Online
Banner deve mostrar "1 operação pendente"
Aguarda auto-sync ou clica "Sincronizar"
Confirma toast de sucesso

Checklist:

 app/manifest.ts existe
 public/icons/icon-192.png existe
 public/icons/icon-512.png existe
 hooks/use-online-status.ts existe
 lib/offline-queue.ts existe
 hooks/use-offline-queue.ts existe
 components/driver/offline-indicator.tsx existe
 Banner offline aparece quando sem conexão
 Operação vai para fila quando offline
 Auto-sync quando volta online
 PWA instalável no celular (ícone aparece no browser mobile)