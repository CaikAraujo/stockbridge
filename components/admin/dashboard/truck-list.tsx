import Link from 'next/link';
import { MiniBar } from '@/components/admin/shared/mini-bar';
import { StateBadge } from '@/components/admin/shared/state-badge';

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

const MAX_ITEMS = 20;

export function TruckList({ trucks }: Props) {
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">Saldo por caminhão</div>
          <div className="card-sub">Itens a bordo agora</div>
        </div>
        <Link
          href="/trucks"
          style={{
            background: 'transparent',
            color: 'var(--primary)',
            fontWeight: 800,
            fontSize: 13,
            textDecoration: 'none',
          }}
        >
          Ver todos →
        </Link>
      </div>

      <div style={{ padding: 'calc(var(--card-pad) - 8px) var(--card-pad) var(--card-pad)' }}>
        {trucks.map((t, i) => {
          const hasDriver = !!t.assignedUser;
          const isLast = i === trucks.length - 1;
          return (
            <Link
              key={t.id}
              href={`/trucks/${t.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '9px 0',
                borderBottom: isLast ? 'none' : '1px solid var(--border-soft)',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 99,
                  flexShrink: 0,
                  background: hasDriver ? 'var(--success)' : 'var(--faint)',
                  boxShadow: hasDriver ? '0 0 0 3px var(--success-bg)' : 'none',
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{t.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                  {t.assignedUser?.name ?? 'Sem motorista'} ·{' '}
                  <span className="mono">{t.code}</span>
                </div>
              </div>
              <div
                style={{
                  width: 90,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  alignItems: 'flex-end',
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: t.lowCount > 0 ? 'var(--danger-ink)' : 'var(--ink)',
                  }}
                >
                  {t.totalItems} {t.totalItems === 1 ? 'item' : 'itens'}
                </span>
                <div style={{ width: '100%' }}>
                  <MiniBar
                    value={t.totalItems}
                    max={MAX_ITEMS}
                    color={t.lowCount > 0 ? 'var(--danger)' : 'var(--primary)'}
                  />
                </div>
              </div>
            </Link>
          );
        })}

        {trucks.length === 0 && (
          <p
            style={{
              padding: '24px 0',
              textAlign: 'center',
              fontSize: 13,
              color: 'var(--muted)',
            }}
          >
            Nenhum caminhão cadastrado.
          </p>
        )}
      </div>

      {trucks.some((t) => t.lowCount > 0) && (
        <div
          style={{
            padding: '10px var(--card-pad)',
            borderTop: '1px solid var(--border-soft)',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <StateBadge kind="danger" dot>
            {trucks.filter((t) => t.lowCount > 0).length} caminhão(ões) com estoque baixo
          </StateBadge>
        </div>
      )}
    </div>
  );
}
