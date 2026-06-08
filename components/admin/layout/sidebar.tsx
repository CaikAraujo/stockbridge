'use client';

import {
  IconArrowLeftRight,
  IconBox,
  IconBriefcase,
  IconClipboardList,
  IconFileText,
  IconLayoutDashboard,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarRightCollapse,
  IconPackage,
  IconSettings,
  IconShield,
  IconShieldLock,
  IconTransfer,
  IconTruck,
  IconUsers,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const NAV_GROUPS = [
  {
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: IconLayoutDashboard },
      { href: '/trucks', label: 'Caminhões', icon: IconTruck },
      { href: '/movements', label: 'Movimentações', icon: IconArrowLeftRight },
      { href: '/transfers', label: 'Transferências', icon: IconTransfer },
    ],
  },
  {
    items: [
      { href: '/articles', label: 'Artigos', icon: IconBox },
      { href: '/rapports', label: 'Rapports', icon: IconFileText },
      { href: '/jobs', label: 'Ordens de serviço', icon: IconBriefcase },
      { href: '/inventory', label: 'Inventário', icon: IconClipboardList },
    ],
  },
  {
    items: [
      { href: '/users', label: 'Usuários', icon: IconUsers },
      { href: '/audit', label: 'Auditoria', icon: IconShieldLock },
      { href: '/settings/totp', label: 'Segurança', icon: IconShield },
      { href: '/settings', label: 'Configurações', icon: IconSettings },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Persiste preferência
  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    if (stored) setCollapsed(stored === 'true');
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      localStorage.setItem('sidebar-collapsed', String(!prev));
      return !prev;
    });
  };

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          'flex h-screen flex-col bg-brand-500 transition-all duration-200',
          collapsed ? 'w-14' : 'w-[220px]',
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            'flex items-center gap-2.5 border-b border-white/10 px-4 py-5',
            collapsed && 'justify-center px-0',
          )}
        >
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-white/20">
            <IconPackage size={16} className="text-white" />
          </div>
          {!collapsed && <span className="text-sm font-medium text-white">StockBridge</span>}
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.items[0]?.href ?? gi}>
              {gi > 0 && <div className="my-1.5 h-px bg-white/10" />}
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                const item = (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors',
                      'text-white/85 hover:bg-white/12 hover:text-white',
                      active && 'bg-white/18 font-medium text-white',
                      collapsed && 'justify-center px-0',
                    )}
                  >
                    <Icon size={18} className="flex-shrink-0" />
                    {!collapsed && <span className="truncate">{label}</span>}
                  </Link>
                );

                if (collapsed) {
                  return (
                    <Tooltip key={href}>
                      <TooltipTrigger asChild>{item}</TooltipTrigger>
                      <TooltipContent side="right">{label}</TooltipContent>
                    </Tooltip>
                  );
                }
                return item;
              })}
            </div>
          ))}
        </nav>

        {/* Collapse button */}
        <button
          type="button"
          onClick={toggle}
          className={cn(
            'flex items-center gap-2.5 border-t border-white/10 px-4 py-3',
            'text-xs text-white/75 hover:text-white transition-colors',
            collapsed && 'justify-center px-0',
          )}
        >
          {collapsed ? (
            <IconLayoutSidebarRightCollapse size={18} />
          ) : (
            <>
              <IconLayoutSidebarLeftCollapse size={18} />
              <span>Minimizar</span>
            </>
          )}
        </button>
      </aside>
    </TooltipProvider>
  );
}
