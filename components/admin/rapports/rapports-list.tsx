'use client';

import { IconAlertTriangle, IconCheck, IconRefresh, IconTruck, IconX } from '@tabler/icons-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { api } from '@/lib/trpc/client';

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

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  matched: 'text-status-ok',
  unmatched: 'text-status-critical',
  ignored: 'text-text-muted',
  confirmed: 'text-status-ok',
};

const STATUS_LABEL: Record<string, string> = {
  matched: 'Reconhecido',
  unmatched: 'Sem match',
  ignored: 'Ignorado',
  confirmed: 'Confirmado',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function RapportsList({ initialData, trucks }: { initialData: Rapport[]; trucks: Truck[] }) {
  const [rapports, setRapports] = useState(initialData);
  const [processing, setProcessing] = useState(false);

  const confirm = api.rapports.confirm.useMutation();
  const reject = api.rapports.reject.useMutation();
  const ignoreItem = api.rapports.ignoreItem.useMutation();
  const setLocation = api.rapports.setLocation.useMutation();
  const processNow = api.rapports.processNow.useMutation();

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
      const result = await confirm.mutateAsync({
        idempotencyKey: uuidv4(),
        rapportId,
      });
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
            ? {
                ...r,
                items: r.items.map((i) => (i.id === itemId ? { ...i, status: 'ignored' } : i)),
              }
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
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">{rapports.length} rapport(s) pendente(s)</p>
        <button
          type="button"
          onClick={handleProcessNow}
          disabled={processing}
          className="flex items-center gap-1.5 rounded-btn border border-surface-border bg-white px-3 py-2 text-sm text-text-secondary hover:bg-surface transition-colors disabled:opacity-50"
        >
          <IconRefresh size={14} className={processing ? 'animate-spin' : ''} />
          {processing ? 'Processando...' : 'Verificar InterFast agora'}
        </button>
      </div>

      {/* Empty state */}
      {rapports.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-text-muted">
          <IconCheck size={32} className="mb-3 text-status-ok" />
          <p className="text-sm font-medium">Nenhum rapport pendente</p>
          <p className="text-xs">Todos os consumos foram processados</p>
        </div>
      )}

      {/* Rapport cards */}
      {rapports.map((rapport) => {
        const unmatchedCount = rapport.items.filter((i) => i.status === 'unmatched').length;

        return (
          <div
            key={rapport.id}
            className="rounded-card border border-surface-border bg-white overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-surface-border bg-surface px-4 py-3 gap-4">
              <div className="flex-1 min-w-0">
                {/* Title + badge */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-text-primary">
                    {rapport.interfastReference ?? rapport.interfastInterventionId}
                  </span>
                  {unmatchedCount > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                      <IconAlertTriangle size={11} />
                      {unmatchedCount} sem match
                    </span>
                  )}
                </div>

                {/* Meta */}
                <p className="mt-0.5 text-xs text-text-secondary truncate">
                  {[rapport.clientName, rapport.technicienName, rapport.interventionDate]
                    .filter(Boolean)
                    .join(' · ')}
                </p>

                {/* Truck selector */}
                <div className="mt-2 flex items-center gap-2">
                  <IconTruck size={13} className="text-text-muted flex-shrink-0" />
                  <select
                    value={rapport.locationId ?? ''}
                    onChange={(e) => {
                      if (e.target.value) handleSetLocation(rapport.id, e.target.value);
                    }}
                    className="rounded-btn border border-surface-border bg-white px-2 py-1 text-xs focus:border-brand-500 focus:outline-none"
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

              {/* Actions */}
              <div className="flex gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleReject(rapport.id)}
                  className="flex items-center gap-1 rounded-btn border border-surface-border px-3 py-1.5 text-xs text-status-critical hover:bg-red-50 transition-colors"
                >
                  <IconX size={12} />
                  Rejeitar
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirm(rapport.id, rapport.locationId)}
                  disabled={!rapport.locationId}
                  className="flex items-center gap-1 rounded-btn bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 transition-colors disabled:opacity-40"
                >
                  <IconCheck size={12} />
                  Confirmar
                </button>
              </div>
            </div>

            {/* Items table */}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border">
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-muted">
                    Artigo
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-muted">Qtd</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-muted">Match</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-muted">
                    Estado
                  </th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {rapport.items.map((item) => (
                  <tr key={item.id} className={item.status === 'ignored' ? 'opacity-40' : ''}>
                    <td className="px-4 py-2.5">
                      <p className="text-text-primary">{item.description}</p>
                      {item.supplierCode && (
                        <p className="text-xs text-text-muted font-mono">{item.supplierCode}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-text-secondary whitespace-nowrap">
                      {parseFloat(item.quantity).toFixed(3)} {item.unit}
                    </td>
                    <td className="px-4 py-2.5">
                      {item.article ? (
                        <span className="text-xs text-status-ok">{item.article.name}</span>
                      ) : (
                        <span className="text-xs text-status-critical">Não encontrado</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs ${STATUS_COLOR[item.status] ?? 'text-text-muted'}`}>
                        {STATUS_LABEL[item.status] ?? item.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {item.status === 'unmatched' && (
                        <button
                          type="button"
                          onClick={() => handleIgnoreItem(item.id, rapport.id)}
                          className="text-xs text-text-muted hover:text-text-secondary transition-colors"
                        >
                          Ignorar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
