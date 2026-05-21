'use client';

import { IconTruck } from '@tabler/icons-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { api } from '@/lib/trpc/client';

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

export function TrucksManager({ trucks, drivers }: { trucks: Truck[]; drivers: Driver[] }) {
  const [saving, setSaving] = useState<string | null>(null);
  const assignDriver = api.locations.assignDriver.useMutation();

  const handleAssign = async (locationId: string, userId: string | null) => {
    setSaving(locationId);
    try {
      await assignDriver.mutateAsync({ locationId, userId, idempotencyKey: uuidv4() });
      toast.success('Motorista atribuído com sucesso');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atribuir motorista');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="overflow-hidden rounded-card border border-surface-border bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-border bg-surface">
            {['Caminhão', 'Código', 'Placa', 'Motorista atribuído', ''].map((h) => (
              <th
                key={h}
                className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-text-muted"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-border">
          {trucks.map((t) => (
            <tr key={t.id} className="transition-colors hover:bg-surface">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50">
                    <IconTruck size={15} className="text-brand-500" />
                  </div>
                  <span className="font-medium text-text-primary">{t.name}</span>
                </div>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-text-secondary">{t.code}</td>
              <td className="px-4 py-3 text-text-secondary">{t.plate ?? '—'}</td>
              <td className="px-4 py-3">
                <select
                  defaultValue={t.assignedUser?.id ?? ''}
                  onChange={(e) => handleAssign(t.id, e.target.value || null)}
                  disabled={saving === t.id}
                  className="rounded-btn border border-surface-border bg-white px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none disabled:opacity-50"
                >
                  <option value="">Sem motorista</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3 text-xs text-text-muted">
                {saving === t.id ? 'Salvando...' : ''}
              </td>
            </tr>
          ))}
          {trucks.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-sm text-text-muted">
                Nenhum caminhão cadastrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
