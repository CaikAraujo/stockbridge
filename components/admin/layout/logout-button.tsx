'use client';

import { IconLogout } from '@tabler/icons-react';
import { signOut } from 'next-auth/react';

export function LogoutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="flex w-full items-center text-red-600"
    >
      <IconLogout size={14} className="mr-2" />
      Sair
    </button>
  );
}
