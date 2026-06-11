import type { ReactNode } from 'react';

export interface SbColumn {
  key: string;
  label: string;
  width?: string;
  align?: 'left' | 'right' | 'center';
  wide?: boolean;
}

interface Props<T> {
  columns: SbColumn[];
  rows: T[];
  renderCell: (row: T, key: string) => ReactNode;
  rowKey?: (row: T) => string;
  empty?: ReactNode;
}

export function SbTable<T extends Record<string, unknown>>({
  columns,
  rows,
  renderCell,
  rowKey,
  empty,
}: Props<T>) {
  const cols = columns.map((c) => c.width ?? '1fr').join(' ');

  if (rows.length === 0 && empty) return <>{empty}</>;

  return (
    <div className="tbl" style={{ '--cols': cols } as React.CSSProperties}>
      <div className="tbl-head">
        {columns.map((c) => (
          <div key={c.key} style={{ textAlign: c.align ?? 'left' }}>
            {c.label}
          </div>
        ))}
      </div>
      {rows.map((row, i) => (
        <div className="tbl-row" key={rowKey ? rowKey(row) : i}>
          {columns.map((c) => (
            <div
              key={c.key}
              className={`tbl-cell${c.wide ? ' cell-wide' : ''}`}
              style={{ textAlign: c.align ?? 'left' }}
            >
              {c.label && <span className="cell-label">{c.label}</span>}
              {renderCell(row, c.key)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
