'use client';

export interface PendingOperation {
  id: string;
  type: 'withdraw' | 'return';
  payload: {
    articleId: string;
    quantity: number;
    fromLocationId: string;
    toLocationId: string;
    idempotencyKey: string;
    articleName: string;
    unit: string;
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
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    throw new Error('Armazenamento local cheio. Conecte ao WiFi e sincronize antes de continuar.');
  }
}

export function removeFromQueue(id: string): void {
  const queue = getQueue().filter((op) => op.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function clearQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}
