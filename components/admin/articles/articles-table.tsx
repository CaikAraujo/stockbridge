'use client';

import { IconEdit, IconPlus, IconQrcode, IconSearch } from '@tabler/icons-react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { useCallback, useState } from 'react';

type Article = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  barcode: string | null;
  active: boolean;
  minStock: string;
  reorderPoint: string;
  refrigerantType: string | null;
  costPriceCents: number | null;
};

type ArticlesListResult = {
  items: Article[];
  total: number;
};

async function downloadQR(sku: string, _name: string) {
  const url = `${window.location.origin}/scan/${sku}`;
  const dataUrl = await QRCode.toDataURL(url, { width: 300, margin: 2 });
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `qr-${sku}.png`;
  a.click();
}

const HEADERS = ['SKU', 'Nome', 'Unidade', 'Mín.', 'Reposição', 'Tipo gás', ''] as const;

export function ArticlesTable({ initialData }: { initialData: ArticlesListResult }) {
  const [search, setSearch] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);

  const filtered = initialData.items.filter(
    (a) =>
      !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.sku.toLowerCase().includes(search.toLowerCase()),
  );

  const handleQR = useCallback(async (sku: string, name: string) => {
    setDownloading(sku);
    try {
      await downloadQR(sku, name);
    } finally {
      setDownloading(null);
    }
  }, []);

  return (
    <div className="space-y-4">
      {/* Barra de ações */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative max-w-xs flex-1">
          <IconSearch
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="text"
            placeholder="Buscar por nome ou SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-btn border border-surface-border py-2 pl-8 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-500 focus:outline-none"
          />
        </div>

        <Link
          href="/articles/new"
          className="flex items-center gap-1.5 rounded-btn bg-brand-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
        >
          <IconPlus size={15} />
          Novo artigo
        </Link>
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-card border border-surface-border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface">
              {HEADERS.map((h) => (
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
            {filtered.map((a) => (
              <tr key={a.id} className="transition-colors hover:bg-surface">
                <td className="px-4 py-2.5 font-mono text-xs text-text-secondary">{a.sku}</td>
                <td className="px-4 py-2.5 font-medium text-text-primary">{a.name}</td>
                <td className="px-4 py-2.5">
                  <span className="rounded bg-surface px-1.5 py-0.5 text-xs text-text-secondary">
                    {a.unit}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-text-secondary">
                  {parseFloat(a.minStock).toFixed(3)}
                </td>
                <td className="px-4 py-2.5 text-text-secondary">
                  {parseFloat(a.reorderPoint).toFixed(3)}
                </td>
                <td className="px-4 py-2.5 text-text-secondary">{a.refrigerantType ?? '—'}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleQR(a.sku, a.name)}
                      disabled={downloading === a.sku}
                      className="flex items-center gap-1 rounded px-2 py-1 text-xs text-brand-500 transition-colors hover:bg-brand-50 disabled:opacity-50"
                      title="Baixar QR code"
                    >
                      <IconQrcode size={14} />
                      {downloading === a.sku ? '…' : 'QR'}
                    </button>
                    <Link
                      href={`/articles/${a.id}/edit`}
                      className="flex items-center gap-1 rounded px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-surface"
                    >
                      <IconEdit size={14} />
                      Editar
                    </Link>
                  </div>
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-text-muted">
                  {search
                    ? 'Nenhum artigo encontrado para esta busca.'
                    : 'Nenhum artigo cadastrado.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-text-muted">
        {filtered.length} de {initialData.total} artigos
      </p>
    </div>
  );
}
