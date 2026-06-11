'use client';

import {
  IconAlertTriangle,
  IconCheck,
  IconClipboardList,
  IconRefresh,
  IconTruck,
  IconX,
} from '@tabler/icons-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { api } from '@/lib/trpc/client';
import { EmptyState } from '@/components/admin/shared/empty-state';
import { SbTable } from '@/components/admin/shared/sb-table';
import { StateBadge } from '@/components/admin/shared/state-badge';

// ─── Types ────────────────────────────────────────────────────────────────────

type ArticleRef = { id: string; name: string; sku: string; unit: string } | null;

type Item = {
  id: string;
  description: string;
  supplierCode: string | null;
  quantity: string;
  unit: string;
  status: string;
  article: ArticleRef;
};

type LocationRef = { id: string; name: string; code: string } | null;

type Rapport = {
  id: string;
  interfastReference: string | null;
  interfastInterventionId: string;
  technicienName: string | null;
  clientName: string | null;
  interventionDate: string | null;
  status: string;
  locationId: string | null;
  location: LocationRef;
  items: Item[];
};

type Truck = { id: string; name: string; code: string };

type ItemRow = Record<string, unknown> & Item;

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEM_STATUS_CONFIG: Record<
  string,
  { label: string; kind: 'success' | 'danger' | 'neutral' | 'warn' }
> = {
  matched:   { label: 'Reconhecido', kind: 'success' },
  unmatched: { label: 'Sem match',   kind: 'danger'  },
  ignored:   { label: 'Ignorado',    kind: 'neutral' },
  confirmed: { label: 'Confirmado',  kind: 'success' },
};

// ─── RapportCard ──────────────────────────────────────────────────────────────

function RapportCard({
  rapport,
  trucks,
  onConfirm,
  onReject,
  onIgnoreItem,
  onSetLocation,
}: {
  rapport: Rapport;
  trucks: Truck[];
  onConfirm: (id: string, locationId: string | null) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onIgnoreItem: (itemId: string, rapportId: string) => Promise<void>;
  onSetLocation: (rapportId: string, locationId: string) => Promise<void>;
}) {
  const unmatchedCount = rapport.items.filter((i) => i.status === 'unmatched').length;

  return (
    <div className="card card-hover" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          padding: 'var(--card-pad)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 14,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <span className="mono" style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>
              {rapport.interfastReference ?? rapport.interfastInterventionId}
            </span>
            {unmatchedCount > 0 && (
              <StateBadge kind="warn">
                <IconAlertTriangle size={11} /> {unmatchedCount} sem match
              </StateBadge>
            )}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>
            {[rapport.clientName, rapport.technicienName, rapport.interventionDate]
              .filter(Boolean)
              .join(' · ')}
          </div>
          {/* Truck select */}
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconTruck size={14} style={{ color: 'var(--faint)', flexShrink: 0 }} />
            <div className="field" style={{ height: 36, minWidth: 200 }}>
              <select
                value={rapport.locationId ?? ''}
                onChange={(e) => {
                  if (e.target.value) onSetLocation(rapport.id, e.target.value);
                }}
              >
                <option value="">Seleciona o caminhão</option>
                {trucks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            flexWrap: 'wrap',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => onReject(rapport.id)}
          >
            <IconX size={13} /> Rejeitar
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onConfirm(rapport.id, rapport.locationId)}
            disabled={!rapport.locationId}
          >
            <IconCheck size={13} /> Confirmar
          </button>
        </div>
      </div>

      {/* Items table */}
      <div
        style={{
          borderTop: '1px solid var(--border-soft)',
          background: 'var(--surface-2)',
        }}
      >
        <SbTable<ItemRow>
          columns={[
            { key: 'artigo', label: 'Artigo', width: '1.6fr', wide: true },
            { key: 'qtd',    label: 'Qtd',    width: '0.8fr'            },
            { key: 'match',  label: 'Match',  width: '1fr'              },
            { key: 'estado', label: 'Estado', width: '0.9fr'            },
            { key: 'acao',   label: '',       width: '80px', align: 'right' },
          ]}
          rows={rapport.items as ItemRow[]}
          rowKey={(r) => r.id}
          renderCell={(r, k) => {
            if (k === 'artigo')
              return (
                <div>
                  <span
                    style={{
                      fontWeight: 700,
                      opacity: r.status === 'ignored' ? 0.4 : 1,
                    }}
                  >
                    {r.description}
                  </span>
                  {r.supplierCode && (
                    <div>
                      <span className="mono" style={{ color: 'var(--muted)' }}>
                        {r.supplierCode}
                      </span>
                    </div>
                  )}
                </div>
              );
            if (k === 'qtd')
              return (
                <span className="mono" style={{ color: 'var(--ink-2)' }}>
                  {parseFloat(r.quantity).toFixed(3)} {r.unit}
                </span>
              );
            if (k === 'match')
              return r.article ? (
                <span style={{ fontSize: 12.5, color: 'var(--success-ink)', fontWeight: 700 }}>
                  {r.article.name}
                </span>
              ) : (
                <span style={{ fontSize: 12.5, color: 'var(--danger-ink)', fontWeight: 700 }}>
                  Não encontrado
                </span>
              );
            if (k === 'estado') {
              const cfg = ITEM_STATUS_CONFIG[r.status] ?? { label: r.status, kind: 'neutral' as const };
              return <StateBadge kind={cfg.kind}>{cfg.label}</StateBadge>;
            }
            if (k === 'acao' && r.status === 'unmatched')
              return (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => onIgnoreItem(r.id, rapport.id)}
                >
                  Ignorar
                </button>
              );
            return null;
          }}
        />
      </div>
    </div>
  );
}

// ─── RapportsList ─────────────────────────────────────────────────────────────

export function RapportsList({ initialData, trucks }: { initialData: Rapport[]; trucks: Truck[] }) {
  const [rapports,   setRapports]   = useState(initialData);
  const [processing, setProcessing] = useState(false);

  const confirm    = api.rapports.confirm.useMutation();
  const reject     = api.rapports.reject.useMutation();
  const ignoreItem = api.rapports.ignoreItem.useMutation();
  const setLocation = api.rapports.setLocation.useMutation();
  const processNow  = api.rapports.processNow.useMutation();

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleProcessNow = async () => {
    setProcessing(true);
    try {
      const result = await processNow.mutateAsync({ idempotencyKey: uuidv4() });
      toast.success(`${result.processed} rapport(s) importado(s)`);
      window.location.reload();
    } catch {
      toast.error('Erro ao processar');
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirm = async (rapportId: string, locationId: string | null) => {
    if (!locationId) {
      toast.error('Seleciona o caminhão antes de confirmar');
      return;
    }
    try {
      const result = await confirm.mutateAsync({ idempotencyKey: uuidv4(), rapportId });
      toast.success(`${result.confirmed} consumo(s) registado(s)`);
      setRapports((prev) => prev.filter((r) => r.id !== rapportId));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao confirmar');
    }
  };

  const handleReject = async (rapportId: string) => {
    try {
      await reject.mutateAsync({ idempotencyKey: uuidv4(), rapportId });
      toast.success('Rapport rejeitado');
      setRapports((prev) => prev.filter((r) => r.id !== rapportId));
    } catch {
      toast.error('Erro ao rejeitar');
    }
  };

  const handleIgnoreItem = async (itemId: string, rapportId: string) => {
    try {
      await ignoreItem.mutateAsync({ idempotencyKey: uuidv4(), itemId });
      setRapports((prev) =>
        prev.map((r) =>
          r.id === rapportId
            ? { ...r, items: r.items.map((i) => (i.id === itemId ? { ...i, status: 'ignored' } : i)) }
            : r,
        ),
      );
    } catch {
      toast.error('Erro ao ignorar item');
    }
  };

  const handleSetLocation = async (rapportId: string, locationId: string) => {
    try {
      await setLocation.mutateAsync({ idempotencyKey: uuidv4(), rapportId, locationId });
      setRapports((prev) =>
        prev.map((r) =>
          r.id === rapportId
            ? {
                ...r,
                locationId,
                location: trucks.find((t) => t.id === locationId) ?? null,
              }
            : r,
        ),
      );
    } catch {
      toast.error('Erro ao definir caminhão');
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>
            {rapports.length} rapport(s) pendente(s)
          </span>
          {rapports.length > 0 && (
            <StateBadge kind="warn" dot>
              {rapports.length} pendentes
            </StateBadge>
          )}
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={handleProcessNow}
          disabled={processing}
        >
          <IconRefresh size={14} style={{ animation: processing ? 'spin 1s linear infinite' : 'none' }} />
          {processing ? 'Processando…' : 'Verificar InterFast agora'}
        </button>
      </div>

      {/* Empty state */}
      {rapports.length === 0 && (
        <div className="card">
          <EmptyState
            icon={IconClipboardList}
            title="Nenhum rapport pendente"
            sub="Todos os consumos foram processados. Verifique o InterFast para novos relatórios."
          />
        </div>
      )}

      {/* Rapport cards */}
      {rapports.map((rapport) => (
        <RapportCard
          key={rapport.id}
          rapport={rapport}
          trucks={trucks}
          onConfirm={handleConfirm}
          onReject={handleReject}
          onIgnoreItem={handleIgnoreItem}
          onSetLocation={handleSetLocation}
        />
      ))}
    </div>
  );
}
