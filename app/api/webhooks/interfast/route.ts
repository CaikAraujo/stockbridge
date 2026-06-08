import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { processRecentInterventions } from '@/lib/rapport-processor';

function verifyToken(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
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
