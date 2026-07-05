'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AuthError } from 'next-auth';
import { signIn } from '@/lib/auth/config';
import { checkRateLimit } from '@/lib/rate-limit';

export async function sendMagicLinkAction(
  email: string,
  callbackUrl?: string,
): Promise<{ error: string } | undefined> {
  const headersList = await headers();
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headersList.get('x-real-ip') ??
    'unknown';

  const rlKey = `login:${ip}:${email}`;
  const rl = checkRateLimit(rlKey, 5, 10 * 60 * 1000);
  if (!rl.allowed) {
    return { error: 'RateLimit' };
  }

  const safeCallbackUrl =
    callbackUrl?.startsWith('/') && !callbackUrl.startsWith('//') ? callbackUrl : '/dashboard';

  try {
    await signIn('resend', { email, redirectTo: safeCallbackUrl });
  } catch (err) {
    if (err instanceof AuthError) {
      redirect(`/login?error=${err.type}`);
    }
    throw err;
  }
}
