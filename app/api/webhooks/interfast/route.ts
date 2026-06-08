import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { processRecentInterventions } from '@/lib/rapport-processor';
import { checkRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

function verifyToken(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rl = checkRateLimit(`interfast-webhook:${ip}`, 10, 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }

  const auth = req.headers.get('x-webhook-secret');
  const secret = process.env.INTERFAST_WEBHOOK_SECRET ?? '';

  if (!secret || !verifyToken(auth ?? '', secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await processRecentInterventions(2);

    return NextResponse.json({
      ok: true,
      processed: result.processed,
      skipped: result.skipped,
      errors: result.errors,
    });
  } catch (err) {
    console.error('[interfast-webhook]', err);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
