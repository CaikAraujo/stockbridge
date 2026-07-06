'use client';

import { IconPackage, IconSearch, IconTruck } from '@tabler/icons-react';
import { useState } from 'react';
import { api } from '@/lib/trpc/client';

export function WarehouseAvailability() {
  const { data, isLoading } = api.drivers.warehouseAvailability.useQuery();
  const [search, setSearch] = useState('');

  const filtered = (data ?? []).filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.sku.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div style={{ flex: 1, overflow: 'auto', paddingBottom: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Campo de busca — pill */}
      <div style={{ background: '#FFF', borderRadius: 100, height: 50, display: 'flex', alignItems: 'center', gap: 10, padding: '0 18px', boxShadow: '0 4px 14px rgba(17,42,94,.06)' }}>
        <IconSearch size={18} color="#7A879C" style={{ flexShrink: 0 }} />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar artigo ou SKU…"
          style={{ border: 'none', outline: 'none', flex: 1, font: '500 14px var(--font-driver)', color: '#12203A', background: 'transparent' }}
        />
      </div>

      {/* Skeleton de carregamento */}
      {isLoading && (
        <>
          {[1, 2, 3].map((n) => (
            <div key={n} style={{ background: '#FFF', borderRadius: 18, padding: 18, boxShadow: '0 4px 14px rgba(17,42,94,.06)' }}>
              <div style={{ height: 14, width: '60%', borderRadius: 8, background: '#E3E9F2', marginBottom: 8, animation: 'pulse 1.5s infinite' }} />
              <div style={{ height: 11, width: '30%', borderRadius: 8, background: '#E3E9F2', marginBottom: 12 }} />
              <div style={{ height: 26, width: '40%', borderRadius: 8, background: '#E3E9F2' }} />
            </div>
          ))}
        </>
      )}

      {/* Estado vazio */}
      {!isLoading && filtered.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', gap: 8 }}>
          <IconPackage size={40} color="#A6B1C2" style={{ opacity: 0.4 }} />
          <p style={{ font: '500 13px var(--font-driver)', color: '#A6B1C2', margin: 0, textAlign: 'center' }}>
            {search ? 'Nenhum artigo encontrado para esta busca' : 'Nenhum artigo disponível no depósito'}
          </p>
        </div>
      )}

      {/* Lista de artigos */}
      {!isLoading && filtered.map((item) => (
        <ArticleCard key={item.articleId} item={item} />
      ))}
    </div>
  );
}

type ArticleItem = {
  articleId: string;
  name: string;
  sku: string;
  unit: string;
  warehouseQty: number;
  driversWithItem: Array<{ driverName: string; truckName: string; quantity: number }>;
};

function ArticleCard({ item }: { item: ArticleItem }) {
  const [expanded, setExpanded] = useState(false);
  const hasTrucks = item.driversWithItem.length > 0;

  return (
    <div style={{ background: '#FFF', borderRadius: 18, boxShadow: '0 4px 14px rgba(17,42,94,.06)', overflow: 'hidden' }}>
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <div style={{ font: '700 15px var(--font-driver)', color: '#12203A' }}>{item.name}</div>
          <div style={{ fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 12, color: '#A6B1C2', marginTop: 2, letterSpacing: '.04em' }}>{item.sku}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ font: '800 26px var(--font-driver)', color: '#12905B', letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums' }}>
            {item.warehouseQty.toFixed(3)}
          </span>
          <span style={{ font: '700 13px var(--font-driver)', color: '#12905B' }}>{item.unit}</span>
          <span style={{ font: '500 12px var(--font-driver)', color: '#7A879C' }}>no depósito</span>
        </div>
      </div>

      {/* Expandir caminhões */}
      {hasTrucks && (
        <>
          <button type="button" onClick={() => setExpanded((p) => !p)}
            style={{ borderTop: '1px solid #EDF1F7', borderLeft: 'none', borderRight: 'none', borderBottom: 'none', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: '#FAFBFD', width: '100%' }}>
            <IconTruck size={16} color="#7A879C" style={{ flexShrink: 0 }} />
            <span style={{ font: '600 13px var(--font-driver)', color: '#7A879C', flex: 1, textAlign: 'left' }}>
              Também em caminhões ({item.driversWithItem.length})
            </span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7A879C" strokeWidth="2.2"
              style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s', flexShrink: 0 }}>
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
          {expanded && (
            <div style={{ borderTop: '1px solid #EDF1F7', padding: '6px 18px 12px', background: '#FAFBFD', display: 'flex', flexDirection: 'column' }}>
              {item.driversWithItem.map((driver, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1D5FE0', flexShrink: 0, display: 'inline-block' }} />
                  <span style={{ font: '600 13px var(--font-driver)', color: '#12203A', flex: 1 }}>{driver.driverName}</span>
                  <span style={{ font: '700 13px var(--font-driver)', color: '#12203A', fontVariantNumeric: 'tabular-nums' }}>
                    {driver.quantity.toFixed(3)} {item.unit}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
