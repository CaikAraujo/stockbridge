import { TRPCError } from '@trpc/server';
import { and, eq, gt } from 'drizzle-orm';
import { idempotencyKeys } from '@/db/schema';
import { middleware } from '@/server/trpc';

type MiddlewareNextResult = Awaited<
  ReturnType<Parameters<Parameters<typeof middleware>[0]>[0]['next']>
>;

export const withIdempotency = middleware(async ({ ctx, next, path, input }) => {
  const typedInput =
    input && typeof input === 'object' ? (input as Record<string, unknown>) : undefined;
  const rawKey = typedInput?.idempotencyKey;
  const key = typeof rawKey === 'string' ? rawKey : undefined;

  if (!key || !ctx.session?.user?.id) return next();

  const userId = ctx.session.user.id;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const reserved = await ctx.db
    .insert(idempotencyKeys)
    .values({
      key,
      userId,
      endpoint: path,
      expiresAt,
      response: null,
      statusCode: null,
    })
    .onConflictDoNothing()
    .returning({ key: idempotencyKeys.key });

  if (reserved.length === 0) {
    const cached = await ctx.db
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

    if (cached[0]?.response) {
      return cached[0].response as unknown as MiddlewareNextResult;
    }

    throw new TRPCError({
      code: 'CONFLICT',
      message: 'Operation in progress, try again shortly',
    });
  }

  const result = await next();

  await ctx.db
    .update(idempotencyKeys)
    .set({ response: result as unknown as Record<string, unknown>, statusCode: 200 })
    .where(
      and(
        eq(idempotencyKeys.userId, userId),
        eq(idempotencyKeys.endpoint, path),
        eq(idempotencyKeys.key, key),
      ),
    );

  return result;
});
