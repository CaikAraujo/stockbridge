'use client';

import { cn } from '@/lib/utils';
import { ShellProvider, useShell } from './shell-context';

function ShellInner({ children }: { children: React.ReactNode }) {
  const { rail, drawerOpen, closeDrawer } = useShell();
  return (
    <>
      <div className={cn('app', rail && 'rail', drawerOpen && 'drawer-open')}>
        {children}
      </div>
      {drawerOpen && (
        <button
          type="button"
          className="scrim"
          onClick={closeDrawer}
          aria-label="Fechar menu"
        />
      )}
    </>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <ShellProvider>
      <ShellInner>{children}</ShellInner>
    </ShellProvider>
  );
}
