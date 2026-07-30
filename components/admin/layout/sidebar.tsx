'use client';

import {
  IconBell,
  IconBriefcase,
  IconBuildingWarehouse,
  IconFileText,
  IconLayoutDashboard,
  IconLogout,
  IconPackageImport,
  IconShield,
  IconShoppingCart,
  IconTransfer,
  IconTruck,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import type { ComponentType } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useShell } from './shell-context';

type NavItem = { href: string; label: string; icon: ComponentType<{ size?: number }> };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Operação',
    items: [
      { href: '/dashboard',   label: 'Dashboard',      icon: IconLayoutDashboard },
      { href: '/trucks',      label: 'Caminhões',       icon: IconTruck },
      { href: '/transfers',   label: 'Transferências',  icon: IconTransfer },
    ],
  },
  {
    label: 'Estoque',
    items: [
      { href: '/estoque',          label: 'Estoque',              icon: IconBuildingWarehouse },
      { href: '/restock',          label: 'Réapprovisionnement',  icon: IconPackageImport     },
      { href: '/purchase-orders',  label: 'Commandes',            icon: IconShoppingCart      },
    ],
  },
  {
    label: 'Serviços',
    items: [
      { href: '/rapports',    label: 'Rapports',        icon: IconFileText },
      { href: '/jobs',        label: 'Ordens de serviço', icon: IconBriefcase },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { href: '/admin',              label: 'Administração', icon: IconShield },
      { href: '/notifications',      label: 'Notificações',  icon: IconBell  },
    ],
  },
];

function SbLogo() {
  return (
    <svg width={34} height={34} viewBox="0 0 40 40" aria-hidden="true" style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id="sbGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="oklch(0.62 0.17 245)" />
          <stop offset="1" stopColor="oklch(0.46 0.19 262)" />
        </linearGradient>
        <linearGradient id="sbFace" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(255,255,255,0.95)" />
          <stop offset="1" stopColor="rgba(255,255,255,0.75)" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="11" fill="url(#sbGrad)" />
      <g transform="translate(20 21)">
        <path d="M0-9.5L8.2-4.75v9.5L0 9.5l-8.2-4.75v-9.5z" fill="none" stroke="url(#sbFace)" strokeWidth="2" strokeLinejoin="round" />
        <path d="M-8.2-4.75L0 0l8.2-4.75M0 0v9.5" fill="none" stroke="url(#sbFace)" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="0" cy="0" r="1.6" fill="#fff" />
      </g>
    </svg>
  );
}

export function AdminSidebar() {
  const pathname = usePathname();
  const { rail, closeDrawer } = useShell();

  return (
    <TooltipProvider delayDuration={200}>
      <aside className="sidebar">
        {/* Brand */}
        <div className="sb-brand">
          <SbLogo />
          <div className="sb-word" style={{ fontFamily: 'var(--font-disp)', fontWeight: 700, fontSize: 17.5, letterSpacing: '-0.02em', color: '#fff' }}>
            Stock<span style={{ color: 'var(--accent)' }}>Bridge</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="sb-nav">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="sb-group-label">{group.label}</div>
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
                const link = (
                  <Link
                    key={href}
                    href={href}
                    onClick={closeDrawer}
                    className={cn('nav-item', active && 'active')}
                  >
                    <Icon size={19} />
                    <span className="sb-label">{label}</span>
                  </Link>
                );
                return rail ? (
                  <Tooltip key={href}>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">{label}</TooltipContent>
                  </Tooltip>
                ) : link;
              })}
            </div>
          ))}
        </nav>

        {/* Footer — logout */}
        <div className="sb-foot">
          {rail ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="nav-item"
                  onClick={() => signOut({ callbackUrl: '/login' })}
                >
                  <IconLogout size={19} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Sair</TooltipContent>
            </Tooltip>
          ) : (
            <button
              type="button"
              className="nav-item"
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              <IconLogout size={19} />
              <span className="sb-label">Sair</span>
            </button>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
