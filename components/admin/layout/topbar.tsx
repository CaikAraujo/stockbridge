import Link from 'next/link';
import { auth } from '@/lib/auth/config';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogoutButton } from './logout-button';
import { HamburgerButton, RailToggleButton } from './hamburger-btn';
import { NotifBell } from './notif-bell';

interface AdminTopbarProps {
  title?: string;
  subtitle?: string;
}

function Avatar({ initials, hue }: { initials: string; hue: number }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 30, height: 30, borderRadius: '32%', flexShrink: 0,
        display: 'grid', placeItems: 'center',
        background: `oklch(0.93 0.04 ${hue})`, color: `oklch(0.45 0.13 ${hue})`,
        fontSize: 11, fontWeight: 800, letterSpacing: '0.02em',
      }}
    >
      {initials}
    </div>
  );
}

const HUES = [256, 200, 155, 75, 295, 25];

export async function AdminTopbar({ title, subtitle }: AdminTopbarProps) {
  const session = await auth();
  const user = session?.user;
  const name = user?.name ?? 'Admin';
  const role = (user?.role ?? '') as string;
  const initials = name.split(' ').map((n) => n[0] ?? '').slice(0, 2).join('').toUpperCase() || 'AD';
  const hue = HUES[(name.charCodeAt(0) ?? 0) % HUES.length] ?? 256;

  return (
    <header className="topbar">
      {/* Mobile: hamburger */}
      <HamburgerButton />
      {/* Desktop: rail toggle */}
      <RailToggleButton />

      {/* Page title (mantido para compatibilidade com páginas existentes) */}
      {title && (
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', lineHeight: 1.2 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{subtitle}</div>}
        </div>
      )}

      {/* Search — visual placeholder, escondido ≤860px via CSS */}
      <div className="field tb-search" aria-hidden="true">
        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" />
        </svg>
        <input readOnly tabIndex={-1} placeholder="Buscar artigo, SKU, caminhão…" style={{ pointerEvents: 'none' }} />
        <kbd className="mono" style={{ color: 'var(--faint)', fontSize: 11, border: '1px solid var(--border)', borderRadius: 6, padding: '1px 6px', whiteSpace: 'nowrap' }}>⌘K</kbd>
      </div>

      <div style={{ flex: 1 }} />

      {/* Notificações — popover com live data */}
      <NotifBell />

      {/* Usuário */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="tb-user">
            <Avatar initials={initials} hue={hue} />
            <div style={{ textAlign: 'left', lineHeight: 1.15 }}>
              <div style={{ fontWeight: 800, fontSize: 12.5, color: 'var(--ink)' }}>{name}</div>
              <div style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 600, textTransform: 'capitalize' }}>{role}</div>
            </div>
            <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" style={{ color: 'var(--faint)' }} aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem asChild>
            <Link href="/admin?tab=seguranca">
              <svg viewBox="0 0 24 24" width={14} height={14} fill="none"
                stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"
                style={{ marginRight: 8 }} aria-hidden="true">
                <path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z"/>
                <path d="M8.8 12l2.2 2.2 4.2-4.2"/>
              </svg>
              Segurança
            </Link>
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
