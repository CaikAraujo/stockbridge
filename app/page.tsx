import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';

export default async function RootPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role === 'driver') redirect('/driver');
  redirect('/dashboard');
}
