'use client';

export interface CsvColumn<T> {
  key: keyof T | ((row: T) => string | number | null | undefined);
  label: string;
}

export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  columns: CsvColumn<T>[],
): void {
  const csvEscape = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };

  const headers = columns.map((c) => c.label).join(',');
  const rows = data.map((row) =>
    columns
      .map((c) => {
        const val = typeof c.key === 'function' ? c.key(row) : row[c.key];
        return csvEscape(val);
      })
      .join(','),
  );

  // BOM (\ufeff) garante que Excel reconheça UTF-8 corretamente
  const csv = `\ufeff${[headers, ...rows].join('\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
