'use client';

import { useState, useCallback } from 'react';
import { IconAlertTriangle, IconShoppingCart } from '@tabler/icons-react';
import { OrderModal } from './order-modal';

type CriticalArticle = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  current_qty: string;
  min_stock: string;
  supplier_id: string | null;
  supplier_name: string | null;
};

type Template = {
  emailTemplateSubject: string;
  emailTemplateGreeting: string;
  emailTemplateBody: string;
  emailTemplateFooter: string;
  name: string;
} | null;

interface Props {
  articles: CriticalArticle[];
  template: Template;
}

export function CriticalArticlesTab({ articles, template }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const a of articles) {
      const diff = parseFloat(a.min_stock) - parseFloat(a.current_qty);
      init[a.id] = diff > 0 ? String(Math.ceil(diff * 1000) / 1000) : '1';
    }
    return init;
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSupplierId, setModalSupplierId] = useState<string | null>(null);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selected.size === articles.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(articles.map((a) => a.id)));
    }
  }, [selected.size, articles]);

  const selectedArticles = articles.filter((a) => selected.has(a.id));
  const withSupplier = selectedArticles.filter((a) => a.supplier_id !== null);
  const withoutSupplier = selectedArticles.filter((a) => a.supplier_id === null);

  // Group by supplier
  const supplierGroups = new Map<string, { name: string; articles: CriticalArticle[] }>();
  for (const a of withSupplier) {
    if (!a.supplier_id) continue;
    const g = supplierGroups.get(a.supplier_id) ?? { name: a.supplier_name ?? '', articles: [] };
    g.articles.push(a);
    supplierGroups.set(a.supplier_id, g);
  }

  const handleCommander = () => {
    if (withSupplier.length === 0) return;
    // If only one supplier, open directly
    if (supplierGroups.size === 1) {
      setModalSupplierId([...supplierGroups.keys()][0] ?? null);
      setModalOpen(true);
    } else {
      // Multiple suppliers — open with null (let modal handle supplier selection)
      setModalSupplierId(null);
      setModalOpen(true);
    }
  };

  if (articles.length === 0) {
    return (
      <div
        className="card"
        style={{
          padding: 'var(--card-pad)',
          textAlign: 'center',
          color: 'var(--muted)',
          fontSize: 14,
        }}
      >
        <IconAlertTriangle size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
        <div style={{ fontWeight: 600 }}>Aucun article critique</div>
        <div style={{ marginTop: 4, fontSize: 13 }}>
          Tous les stocks sont au-dessus du minimum.
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={toggleAll}
          style={{
            fontSize: 13,
            fontWeight: 600,
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 7,
            padding: '5px 12px',
            cursor: 'pointer',
            color: 'var(--ink)',
          }}
        >
          {selected.size === articles.length ? 'Désélectionner tout' : 'Sélectionner tout'}
        </button>

        {withoutSupplier.length > 0 && selected.size > 0 && (
          <span
            style={{
              fontSize: 12.5,
              color: 'var(--warning-ink, #b45309)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <IconAlertTriangle size={14} />
            {withoutSupplier.length} article(s) sans fournisseur
          </span>
        )}

        <div style={{ marginLeft: 'auto' }}>
          <button
            type="button"
            disabled={withSupplier.length === 0}
            onClick={handleCommander}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 16px',
              background: withSupplier.length > 0 ? 'var(--primary)' : 'var(--border)',
              color: withSupplier.length > 0 ? '#fff' : 'var(--muted)',
              border: 'none',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 13.5,
              cursor: withSupplier.length > 0 ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s',
            }}
          >
            <IconShoppingCart size={16} />
            Commander les articles sélectionnés
            {withSupplier.length > 0 && ` (${withSupplier.length})`}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2, var(--bg-2))' }}>
                <th style={{ padding: '10px 12px', width: 36, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={selected.size === articles.length && articles.length > 0}
                    onChange={toggleAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--muted)' }}>Référence</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--muted)' }}>Désignation</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--muted)' }}>Stock actuel</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--muted)' }}>Minimum</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--muted)' }}>Manque</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--muted)' }}>Qté à commander</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--muted)' }}>Fournisseur</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((a, idx) => {
                const current = parseFloat(a.current_qty);
                const min = parseFloat(a.min_stock);
                const gap = Math.max(0, min - current);
                const isSelected = selected.has(a.id);

                return (
                  <tr
                    key={a.id}
                    onClick={() => toggle(a.id)}
                    style={{
                      borderBottom: idx < articles.length - 1 ? '1px solid var(--border)' : 'none',
                      background: isSelected ? 'color-mix(in oklch, var(--primary) 6%, transparent)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background 0.1s',
                    }}
                  >
                    <td style={{ padding: '10px 12px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(a.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12.5, color: 'var(--muted)' }}>
                      {a.sku}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>{a.name}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--danger)' }}>
                      {current} {a.unit}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      {min} {a.unit}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--danger)', fontWeight: 700 }}>
                      {gap > 0 ? `-${gap}` : '0'} {a.unit}
                    </td>
                    <td
                      style={{ padding: '6px 12px', textAlign: 'right' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={quantities[a.id] ?? ''}
                        onChange={(e) => setQuantities((q) => ({ ...q, [a.id]: e.target.value }))}
                        style={{
                          width: 80,
                          textAlign: 'right',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          padding: '4px 8px',
                          fontSize: 13,
                          background: 'var(--bg)',
                          color: 'var(--ink)',
                        }}
                      />
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {a.supplier_name ? (
                        <span style={{ fontWeight: 600, color: 'var(--ink-2)' }}>{a.supplier_name}</span>
                      ) : (
                        <span
                          style={{
                            background: 'color-mix(in oklch, orange 15%, transparent)',
                            color: '#b45309',
                            padding: '2px 8px',
                            borderRadius: 99,
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          Sans fournisseur
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <OrderModal
          articles={articles}
          selectedIds={selected}
          quantities={quantities}
          template={template}
          initialSupplierId={modalSupplierId}
          supplierGroups={Object.fromEntries(supplierGroups)}
          onClose={() => setModalOpen(false)}
          onSuccess={() => {
            setModalOpen(false);
            setSelected(new Set());
          }}
        />
      )}
    </>
  );
}
