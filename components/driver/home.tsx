'use client';

import { IconAlertTriangle, IconHistory, IconPackage, IconQrcode, IconTruck } from '@tabler/icons-react';
import Link from 'next/link';
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

type Tab = 'truck' | 'warehouse';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export function DriverHome({ data, userName }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('truck');
  const lowItems = data.items.filter((i) => parseFloat(i.quantity) <= parseFloat(i.reorderPoint));
  const initials = getInitials(userName);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
      {/* Header — gradiente azul */}
      <div style={{
        background: 'linear-gradient(160deg,#1D5FE0,#1148B8)',
        padding: '22px 22px 58px',
        borderRadius: '0 0 28px 28px',
        flexShrink: 0,
        width: '100%',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ font: '800 15px var(--font-driver)', color: '#FFF', letterSpacing: '-.01em' }}>
            vf·stock
          </span>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(255,255,255,.2)',
            display: 'grid', placeItems: 'center',
            color: '#FFF', font: '700 13px var(--font-driver)',
          }}>
            {initials}
          </div>
        </div>
        <div style={{ font: '500 14px var(--font-driver)', color: 'rgba(255,255,255,.72)' }}>
          {getGreeting()},
        </div>
        <div style={{ font: '800 24px var(--font-driver)', color: '#FFF', letterSpacing: '-.02em' }}>
          {userName}
        </div>
        {data.truck && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            background: 'rgba(255,255,255,.16)',
            borderRadius: 100, padding: '6px 14px', marginTop: 10,
          }}>
            <IconTruck size={14} color="#fff" />
            <span style={{ font: '600 13px var(--font-driver)', color: '#FFF' }}>
              {data.truck.name}
            </span>
          </div>
        )}
      </div>

      {/* Conteúdo sobrepondo o header */}
      <div style={{
        padding: '0 18px 88px',
        marginTop: -36,
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        {/* Ações rápidas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Link href="/driver/scan" style={{
            background: '#FFF', borderRadius: 20, padding: '18px 16px',
            boxShadow: '0 6px 20px rgba(17,42,94,.08)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            textAlign: 'center', textDecoration: 'none',
          }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#1D5FE0', display: 'grid', placeItems: 'center' }}>
              <IconQrcode size={22} color="#fff" />
            </div>
            <div>
              <div style={{ font: '700 15px var(--font-driver)', color: '#12203A' }}>Escanear QR</div>
              <div style={{ font: '500 12px var(--font-driver)', color: '#7A879C', marginTop: 2 }}>Retirada ou devolução</div>
            </div>
          </Link>
          <Link href="/driver/history" style={{
            background: '#FFF', borderRadius: 20, padding: '18px 16px',
            boxShadow: '0 6px 20px rgba(17,42,94,.08)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            textAlign: 'center', textDecoration: 'none',
          }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#EAF0FB', display: 'grid', placeItems: 'center' }}>
              <IconHistory size={22} color="#1D5FE0" />
            </div>
            <div>
              <div style={{ font: '700 15px var(--font-driver)', color: '#12203A' }}>Histórico</div>
              <div style={{ font: '500 12px var(--font-driver)', color: '#7A879C', marginTop: 2 }}>Minhas operações</div>
            </div>
          </Link>
        </div>

        {/* Alerta de estoque baixo */}
        {activeTab === 'truck' && lowItems.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            borderRadius: 14, border: '1px solid #FDE68A',
            background: '#FFFBEB', padding: 12,
          }}>
            <IconAlertTriangle size={15} style={{ marginTop: 1, flexShrink: 0 }} color="#D97706" />
            <p style={{ font: '500 12px var(--font-driver)', color: '#92400E', margin: 0 }}>
              <strong>{lowItems.length} {lowItems.length === 1 ? 'item abaixo' : 'itens abaixo'}</strong>{' '}
              do ponto de reposição no seu caminhão.
            </p>
          </div>
        )}

        {/* Abas */}
        <div style={{ background: '#E7ECF4', borderRadius: 100, padding: 5, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {(['truck', 'warehouse'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={{
                background: activeTab === tab ? '#FFF' : 'transparent',
                borderRadius: 100, padding: 10, textAlign: 'center', border: 'none', cursor: 'pointer',
                boxShadow: activeTab === tab ? '0 2px 8px rgba(17,42,94,.1)' : 'none',
                font: `${activeTab === tab ? 700 : 600} 14px var(--font-driver)`,
                color: activeTab === tab ? '#1D5FE0' : '#7A879C',
                transition: 'all .15s ease',
              }}
            >
              {tab === 'truck' ? 'Meu caminhão' : 'Depósito'}
            </button>
          ))}
        </div>

        {/* Conteúdo: Meu caminhão */}
        {activeTab === 'truck' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 4px' }}>
              <span style={{ font: '700 15px var(--font-driver)', color: '#12203A' }}>Seu estoque</span>
              <span style={{ font: '600 12px var(--font-driver)', color: '#1D5FE0' }}>
                {data.items.length} {data.items.length === 1 ? 'item' : 'itens'}
              </span>
            </div>
            {data.items.map((item) => {
              const qty = parseFloat(item.quantity);
              const reorder = parseFloat(item.reorderPoint);
              const isLow = qty <= reorder;
              return (
                <Link key={item.articleId} href="/driver/scan" style={{
                  background: '#FFF', borderRadius: 18, padding: '16px 18px',
                  boxShadow: '0 4px 14px rgba(17,42,94,.06)',
                  display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none',
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 14,
                    background: isLow ? '#FEF3C7' : '#EAF7F0',
                    display: 'grid', placeItems: 'center', flexShrink: 0,
                  }}>
                    <IconPackage size={20} color={isLow ? '#D97706' : '#12905B'} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: '700 15px var(--font-driver)', color: '#12203A' }}>{item.name}</div>
                    <div style={{ font: '500 12px var(--font-driver)', color: '#7A879C', marginTop: 1 }}>No caminhão</div>
                  </div>
                  <div style={{
                    background: '#F2F5F9', borderRadius: 100, padding: '7px 14px', whiteSpace: 'nowrap',
                    font: '700 14px var(--font-driver)', color: '#12203A', fontVariantNumeric: 'tabular-nums',
                  }}>
                    {qty.toLocaleString('pt-BR')} {item.unit}
                  </div>
                </Link>
              );
            })}
            {data.items.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px 0', font: '500 13px var(--font-driver)', color: '#A6B1C2' }}>
                Caminhão vazio
              </div>
            )}
          </div>
        )}

        {/* Conteúdo: Depósito */}
        {activeTab === 'warehouse' && <WarehouseAvailability />}
      </div>
    </div>
  );
}
