import { auditLog } from '@/db/schema';
import { middleware } from '@/server/trpc';

const SENSITIVE = /password|pin|token|secret|apikey|totpsecret|magic|authorization|cookie/i;

function sanitize(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sanitize);
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, val]) => [
        k,
        SENSITIVE.test(k) ? '[REDACTED]' : sanitize(val),
      ]),
    );
  }
  return v;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractEntity(input: Record<string, unknown> | undefined): {
  uuid: string | null;
  key: string | null;
} {
  if (!input) return { uuid: null, key: null };
  const id = input.id;
  if (typeof id === 'string' && UUID_RE.test(id)) {
    return { uuid: id, key: null };
  }
  return { uuid: null, key: typeof id === 'string' ? id : null };
}

export const withAudit = middleware(async ({ ctx, next, path, type, input }) => {
  const result = await next();

  if (type === 'mutation' && ctx.session?.user?.id) {
    const [entityType] = path.split('.');
    const typedInput =
      input && typeof input === 'object' ? (input as Record<string, unknown>) : undefined;

    try {
      const { uuid, key } = extractEntity(typedInput);
      await ctx.db.insert(auditLog).values({
        userId: ctx.session.user.id,
        action: path,
        entityType: entityType ?? path,
        entityUuid: uuid,
        entityKey: key,
        payload: sanitize(input) as Record<string, unknown>,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
    } catch (err) {
      console.error('[audit] failed to write audit log:', err);
    }
  }

  return result;
});
