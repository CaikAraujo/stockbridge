// Rate limiter em memória — adequado para single-tenant em VPS único
// Para multi-instância futura: substituir por Redis

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Limpa entradas expiradas a cada 5 minutos
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now > entry.resetAt) store.delete(key);
    }
  },
  5 * 60 * 1000,
);

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export function checkRateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1, resetAt: new Date(now + windowMs) };
  }

  if (entry.count >= max) {
    return { allowed: false, remaining: 0, resetAt: new Date(entry.resetAt) };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: max - entry.count,
    resetAt: new Date(entry.resetAt),
  };
}
