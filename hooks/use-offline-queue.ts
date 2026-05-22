'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { getQueue, removeFromQueue } from '@/lib/offline-queue';
import { api } from '@/lib/trpc/client';

export function useOfflineQueue() {
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  const withdraw = api.movements.withdraw.useMutation();
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
        const { articleId, quantity, fromLocationId, toLocationId, idempotencyKey } = op.payload;
        const input = {
          articleId,
          quantity,
          fromLocationId,
          toLocationId,
          idempotencyKey,
        };
        if (op.type === 'withdraw') {
          await withdraw.mutateAsync(input);
        } else {
          await returnItem.mutateAsync(input);
        }
        removeFromQueue(op.id);
        processed++;
        updateCount();
      } catch {
        break;
      }
    }

    if (processed > 0) {
      toast.success(`${processed} operação(ões) sincronizada(s) com sucesso`);
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
