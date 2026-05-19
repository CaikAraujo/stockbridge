import Link from 'next/link';

interface Truck {
  id: string;
  code: string;
  name: string;
  plate: string | null;
  assignedUser: { id: string; name: string } | null;
  totalItems: number;
  distinctSkus: number;
  lowCount: number;
}

interface Props {
  trucks: Truck[];
}

export function TruckList({ trucks }: Props) {
  return (
    <div className="rounded-card border border-surface-border bg-white">
      <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
        <h2 className="text-sm font-medium text-text-primary">Saldo por caminhão</h2>
        <Link href="/trucks" className="text-xs font-medium text-brand-500 hover:underline">
          Ver todos →
        </Link>
      </div>

      <div className="divide-y divide-surface-border">
        {trucks.map((t) => (
          <Link
            key={t.id}
            href={`/trucks/${t.id}`}
            className="flex items-center justify-between px-4 py-2.5 hover:bg-surface transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`h-2 w-2 rounded-full flex-shrink-0 ${
                  t.lowCount > 0 ? 'bg-status-low' : 'bg-status-ok'
                }`}
              />
              <div>
                <p className="text-sm font-medium text-text-primary">{t.name}</p>
                <p className="text-xs text-text-secondary">
                  {t.assignedUser?.name ?? '—'} · {t.code}
                </p>
              </div>
            </div>

            <div className="text-right">
              <p
                className={`text-sm font-medium ${
                  t.lowCount > 0 ? 'text-status-low' : 'text-text-primary'
                }`}
              >
                {t.totalItems} itens
              </p>
              {t.lowCount > 0 && (
                <p className="text-2xs text-status-low">{t.lowCount} abaixo do mínimo</p>
              )}
            </div>
          </Link>
        ))}

        {trucks.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-text-muted">
            Nenhum caminhão cadastrado.
          </p>
        )}
      </div>
    </div>
  );
}
