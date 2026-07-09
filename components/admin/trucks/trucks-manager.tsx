'use client';

import { IconPlus, IconTruck, IconTruckOff } from '@tabler/icons-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { api } from '@/lib/trpc/client';
import { EmptyState } from '@/components/admin/shared/empty-state';
import { MiniBar } from '@/components/admin/shared/mini-bar';
import { SbAvatar } from '@/components/admin/shared/sb-avatar';
import { StateBadge } from '@/components/admin/shared/state-badge';

type Truck = {
  id: string;
  code: string;
  name: string;
  plate: string | null;
  assignedUser: { id: string; name: string } | null;
};

type Driver = {
  id: string;
  name: string;
};

const MAX_ITEMS = 20;

export function TrucksManager({ trucks, drivers }: { trucks: Truck[]; drivers: Driver[] }) {
  const [saving, setSaving]           = useState<string | null>(null);
  const [localAssign, setLocalAssign] = useState<Record<string, string | null>>({});

  const assignDriver = api.locations.assignDriver.useMutation();

  const getAssignedId = (t: Truck): string | null =>
    t.id in localAssign ? (localAssign[t.id] ?? null) : t.assignedUser?.id ?? null;

  const getAssignedName = (t: Truck): string | null => {
    const aid = getAssignedId(t);
    if (!aid) return null;
    return drivers.find((d) => d.id === aid)?.name ?? t.assignedUser?.name ?? null;
  };

  const handleAssign = async (locationId: string, userId: string | null) => {
    setSaving(locationId);
    // Optimistic update
    setLocalAssign((prev) => ({ ...prev, [locationId]: userId }));
    try {
      await assignDriver.mutateAsync({ locationId, userId, idempotencyKey: uuidv4() });
      toast.success('Motorista atribuído com sucesso');
    } catch (err: unknown) {
      // Revert optimistic
      setLocalAssign((prev) => {
        const next = { ...prev };
        delete next[locationId];
        return next;
      });
      toast.error(err instanceof Error ? err.message : 'Erro ao atribuir motorista');
    } finally {
      setSaving(null);
    }
  };

  if (trucks.length === 0) {
    return (
      <div className="card">
        <EmptyState
          icon={IconTruck}
          title="Nenhum caminhão cadastrado"
          sub="Adicione caminhões para gerir motoristas e estoque a bordo."
          action={
            <Link href="/trucks/new" className="btn btn-primary btn-sm">
              <IconPlus size={14} /> Novo caminhão
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Link href="/trucks/new" className="btn btn-primary btn-sm">
          <IconPlus size={14} /> Novo caminhão
        </Link>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}
      >
      {trucks.map((t) => {
        const driverName = getAssignedName(t);
        const hasDriver  = !!driverName;
        const isSaving   = saving === t.id;

        return (
          <div
            key={t.id}
            className="card card-hover"
            style={{ padding: 'var(--card-pad)' }}
          >
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 13,
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  background: hasDriver ? 'var(--primary-soft)' : 'var(--warn-bg)',
                  color:      hasDriver ? 'var(--primary-strong)' : 'var(--warn-ink)',
                }}
              >
                {hasDriver ? <IconTruck size={21} /> : <IconTruckOff size={21} />}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 14.5 }}>{t.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 8 }}>
                  <span className="mono">{t.code}</span>
                  {t.plate && <span>Placa {t.plate}</span>}
                </div>
              </div>
              {hasDriver
                ? <StateBadge kind="success" dot>Ativo</StateBadge>
                : <StateBadge kind="warn" dot>Sem motorista</StateBadge>}
            </div>

            {/* Items bar — TODO: wire totalItems from getTrucksSummary when available on this page */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                margin: '16px 0 6px',
                fontSize: 12.5,
                color: 'var(--muted)',
                fontWeight: 700,
              }}
            >
              <span>Itens a bordo</span>
              <Link
                href={`/trucks/${t.id}`}
                style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 800, textDecoration: 'none' }}
              >
                Ver estoque →
              </Link>
            </div>
            <MiniBar value={0} max={MAX_ITEMS} color="var(--faint)" />

            {/* Driver select */}
            <div style={{ marginTop: 16 }}>
              <label
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  color: 'var(--faint)',
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                Motorista atribuído
              </label>
              <div className="field" style={{ height: 38 }}>
                <SbAvatar name={driverName ?? '—'} size={22} />
                <select
                  value={getAssignedId(t) ?? ''}
                  onChange={(e) => handleAssign(t.id, e.target.value || null)}
                  disabled={isSaving}
                  style={{ opacity: isSaving ? 0.6 : 1 }}
                >
                  <option value="">Sem motorista</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              {isSaving && (
                <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--muted)' }}>
                  A salvar…
                </p>
              )}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
