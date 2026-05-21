import { TRPCError } from '@trpc/server';
import { and, eq, gt } from 'drizzle-orm';
import { idempotencyKeys } from '@/db/schema';
import { middleware } from '@/server/trpc';

type MiddlewareNextResult = Awaited<
  ReturnType<Parameters<Parameters<typeof middleware>[0]>[0]['next']>
>;

const STALE_TIMEOUT_MS = 30_000; // 30 segundos

export const withIdempotency = middleware(async ({ ctx, next, path, input }) => {
  const typedInput =
    input && typeof input === 'object' ? (input as Record<string, unknown>) : undefined;
  const rawKey = typedInput?.idempotencyKey;
  const key = typeof rawKey === 'string' ? rawKey : undefined;

  if (!key || !ctx.session?.user?.id) return next();

  const userId = ctx.session.user.id;
  const now = new Date();

  // Tenta reservar a chave
  const reserved = await ctx.db
    .insert(idempotencyKeys)
    .values({
      key,
      userId,
      endpoint: path,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      response: null,
      statusCode: null,
    })
    .onConflictDoNothing()
    .returning({ key: idempotencyKeys.key });

  if (reserved.length === 0) {
    // Chave já existe — busca o cache
    const [cached] = await ctx.db
      .select()
      .from(idempotencyKeys)
      .where(
        and(
          eq(idempotencyKeys.userId, userId),
          eq(idempotencyKeys.endpoint, path),
          eq(idempotencyKeys.key, key),
          gt(idempotencyKeys.expiresAt, now),
        ),
      )
      .limit(1);

    if (cached?.response) {
      // Resposta cacheada — retorna sem executar
      return cached.response as unknown as MiddlewareNextResult;
    }

    // Reserva órfã — verifica se é stale (crash anterior)
    const staleThreshold = new Date(now.getTime() - STALE_TIMEOUT_MS);
    const isStale = cached && cached.createdAt < staleThreshold;

    if (isStale) {
      // Remove reserva abandonada e permite retry
      await ctx.db
        .delete(idempotencyKeys)
        .where(
          and(
            eq(idempotencyKeys.userId, userId),
            eq(idempotencyKeys.endpoint, path),
            eq(idempotencyKeys.key, key),
          ),
        );
      // Retry recursivo não é possível aqui — instrui o cliente
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Operação anterior falhou. Gere um novo idempotencyKey e tente novamente.',
      });
    }

    throw new TRPCError({
      code: 'CONFLICT',
      message: 'Operação em andamento. Aguarde e tente novamente.',
    });
  }

  const result = await next();

  // Salva resposta no cache
  await ctx.db
    .update(idempotencyKeys)
    .set({
      response: result as unknown as Record<string, unknown>,
      statusCode: 200,
    })
    .where(
      and(
        eq(idempotencyKeys.userId, userId),
        eq(idempotencyKeys.endpoint, path),
        eq(idempotencyKeys.key, key),
      ),
    );

  return result;
});
