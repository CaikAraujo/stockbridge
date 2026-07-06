import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminSidebar } from '@/components/admin/layout/sidebar';
import { AdminShell } from '@/components/admin/layout/shell';
import { db } from '@/db/client';
import { auth } from '@/lib/auth/config';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role === 'driver') redirect('/driver');

  const headersList = await headers();
  const pathname = headersList.get('x-pathname') ?? '';

  const isOnboardingPage = pathname.includes('/onboarding');

  // Onboarding guard: se não houver empresa configurada, redireciona para /onboarding
  if (!isOnboardingPage) {
    const company = await db.query.companySettings.findFirst({
      columns: { onboardingCompletedAt: true },
    });

    if (!company?.onboardingCompletedAt) {
      redirect('/onboarding');
    }
  }

  // Página de onboarding é standalone (sem sidebar)
  if (isOnboardingPage) {
    return <>{children}</>;
  }

  return (
    <AdminShell>
      <AdminSidebar />
      <div className="main">{children}</div>
    </AdminShell>
  );
}
