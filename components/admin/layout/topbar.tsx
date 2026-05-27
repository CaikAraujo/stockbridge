import { IconChevronDown, IconUser } from '@tabler/icons-react';
import { LogoutButton } from '@/components/admin/layout/logout-button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { auth } from '@/lib/auth/config';

interface AdminTopbarProps {
  title: string;
  subtitle?: string;
}

export async function AdminTopbar({ title, subtitle }: AdminTopbarProps) {
  const session = await auth();
  const user = session?.user;
  const initials =
    user?.name
      ?.split(' ')
      .map((n) => n[0] ?? '')
      .slice(0, 2)
      .join('') ?? 'AD';

  return (
    <header className="flex h-[52px] flex-shrink-0 items-center justify-between border-b border-surface-border bg-white px-5">
      <div>
        <h1 className="text-sm font-medium text-text-primary">{title}</h1>
        {subtitle && <p className="text-xs text-text-secondary">{subtitle}</p>}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-surface transition-colors"
          >
            <div className="flex flex-col text-right">
              <span className="text-xs font-medium text-text-primary">{user?.name ?? 'Admin'}</span>
              <span className="text-2xs text-text-secondary capitalize">{user?.role}</span>
            </div>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-white text-2xs font-medium">
              {initials}
            </div>
            <IconChevronDown size={14} className="text-text-muted" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem>
            <IconUser size={14} className="mr-2" />
            Meu perfil
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild className="text-red-600 focus:text-red-600">
            <LogoutButton />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
