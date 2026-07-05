'use client';

import { IconAlertTriangle, IconHistory, IconPackage, IconQrcode } from '@tabler/icons-react';
import Link from 'next/link';
import type React from 'react';
import { useState } from 'react';
import { WarehouseAvailability } from '@/components/driver/warehouse-availability';

type Item = {
  articleId: string;
  name: string;
  unit: string;
  quantity: string;
  reorderPoint: string;
};

type Truck = { name: string; code: string };

type Props = {
  data: { truck: Truck | null; items: Item[] };
  userName: string;
};

type QuickAction = {
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconBg: string;
  iconColor: string;
  title: string;
  sub: string;
  cardHover: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    href: '/driver/scan',
    icon: IconQrcode,
    iconBg: 'bg-brand-500',
    iconColor: 'text-white',
    title: 'Escanear QR',
    sub: 'Retirada ou devolução',
    cardHover: 'hover:bg-brand-50',
  },
  {
    href: '/driver/history',
    icon: IconHistory,
    iconBg: 'bg-surface',
    iconColor: 'text-text-secondary',
    title: 'Histórico',
    sub: 'Minhas operações',
    cardHover: 'hover:bg-surface',
  },
];

type Tab = 'truck' | 'warehouse';

export function DriverHome({ data, userName }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('truck');
  const lowItems = data.items.filter((i) => parseFloat(i.quantity) <= parseFloat(i.reorderPoint));

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-brand-500 px-4 pb-5 pt-10">
        <p className="text-sm text-white/75">Olá,</p>
        <h1 className="text-xl font-medium text-white">{userName}</h1>
        <p className="mt-0.5 text-sm text-white/75">
          {data.truck?.name ?? 'Sem caminhão atribuído'}
        </p>
      </div>

      {/* Ações rápidas */}
      <div className="grid grid-cols-2 gap-3 px-4 pt-4">
        {QUICK_ACTIONS.map(({ href, icon: Icon, iconBg, iconColor, title, sub, cardHover }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-2 rounded-card border border-surface-border bg-white px-4 py-5 transition-colors ${cardHover}`}
          >
            <div className={`flex h-12 w-12 items-center justify-center rounded-full ${iconBg}`}>
              <Icon size={24} className={iconColor} />
            </div>
            <span className="text-sm font-medium text-text-primary">{title}</span>
            <span className="text-center text-xs text-text-secondary">{sub}</span>
          </Link>
        ))}
      </div>

      {/* Alerta de estoque baixo */}
      {activeTab === 'truck' && lowItems.length > 0 && (
        <div className="mx-4 mt-4 flex items-start gap-2 rounded-btn border border-amber-200 bg-amber-50 p-3">
          <IconAlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-status-low" />
          <p className="text-xs text-amber-800">
            <strong>
              {lowItems.length} {lowItems.length === 1 ? 'item abaixo' : 'itens abaixo'}
            </strong>{' '}
            do ponto de reposição no seu caminhão.
          </p>
        </div>
      )}

      {/* Abas */}
      <div className="px-4 pt-4">
        <div className="tabs">
          <button
            type="button"
            className={`tab${activeTab === 'truck' ? ' active' : ''}`}
            onClick={() => setActiveTab('truck')}
          >
            Meu caminhão
          </button>
          <button
            type="button"
            className={`tab${activeTab === 'warehouse' ? ' active' : ''}`}
            onClick={() => setActiveTab('warehouse')}
          >
            Depósito
          </button>
        </div>
      </div>

      {/* Conteúdo da aba: Meu caminhão */}
      {activeTab === 'truck' && (
        <div className="flex-1 overflow-auto px-4 pt-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium text-text-primary">
              Seu estoque — {data.items.length} {data.items.length === 1 ? 'item' : 'itens'}
            </h2>
          </div>

          <div className="divide-y divide-surface-border rounded-card border border-surface-border bg-white">
            {data.items.map((item) => {
              const qty = parseFloat(item.quantity);
              const reorder = parseFloat(item.reorderPoint);
              const isLow = qty <= reorder;

              return (
                <div key={item.articleId} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`h-2 w-2 rounded-full ${isLow ? 'bg-status-low' : 'bg-status-ok'}`}
                    />
                    <p className="text-sm text-text-primary">{item.name}</p>
                  </div>
                  <span
                    className={`text-sm font-medium ${isLow ? 'text-status-low' : 'text-text-primary'}`}
                  >
                    {qty.toFixed(3)} {item.unit}
                  </span>
                </div>
              );
            })}

            {data.items.length === 0 && (
              <div className="flex flex-col items-center py-8 text-text-muted">
                <IconPackage size={32} className="mb-2 opacity-30" />
                <p className="text-sm">Caminhão vazio</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Conteúdo da aba: Depósito */}
      {activeTab === 'warehouse' && <WarehouseAvailability />}
    </div>
  );
}
