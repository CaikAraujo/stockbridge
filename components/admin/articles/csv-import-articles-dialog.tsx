'use client';

import { IconAlertTriangle, IconCheck, IconUpload, IconX } from '@tabler/icons-react';
import { useRef, useState } from 'react';
import { ARTICLE_UNITS } from '@/lib/schemas/articles';
import { api } from '@/lib/trpc/client';

type ArticleUnit = (typeof ARTICLE_UNITS)[number];

type CsvRow = {
  nome: string;
  sku: string;
  unidade: string;
  minStock: number;
  reorderPoint: number;
};

type ValidatedRow = CsvRow & { valid: boolean; errors: string[] };

type ParseResult = { rows: ValidatedRow[]; parseErrors: string[] };

function isValidUnit(v: string): v is ArticleUnit {
  return (ARTICLE_UNITS as readonly string[]).includes(v);
}

function parseCsv(text: string): ParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return { rows: [], parseErrors: ['Ficheiro vazio.'] };

  const firstLine = lines[0] ?? '';
  const hasHeader = /nome/i.test(firstLine);
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const rows: ValidatedRow[] = [];
  const parseErrors: string[] = [];

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i];
    if (!line) continue;
    const parts = line.split(',').map((p) => p.trim());
    const [nome = '', sku = '', unidade = '', minStr = '0', repStr = '0'] = parts;

    if (parts.length < 3) {
      parseErrors.push(`Linha ${i + 2}: colunas insuficientes — esperado "nome,sku,unidade[,minStock,reorderPoint]"`);
      continue;
    }

    const rowErrors: string[] = [];
    if (!nome) rowErrors.push('nome obrigatório');
    if (!sku) rowErrors.push('sku obrigatório');
    if (!unidade) rowErrors.push('unidade obrigatória');
    else if (!isValidUnit(unidade))
      rowErrors.push(`unidade inválida "${unidade}" — use: ${ARTICLE_UNITS.join(', ')}`);

    const minStock = minStr === '' || minStr === undefined ? 0 : parseFloat(minStr);
    const reorderPoint = repStr === '' || repStr === undefined ? 0 : parseFloat(repStr);

    if (!Number.isNaN(minStock) && minStock < 0) rowErrors.push('minStock deve ser ≥ 0');
    if (!Number.isNaN(reorderPoint) && reorderPoint < 0) rowErrors.push('reorderPoint deve ser ≥ 0');

    rows.push({
      nome,
      sku,
      unidade,
      minStock: Number.isNaN(minStock) ? 0 : minStock,
      reorderPoint: Number.isNaN(reorderPoint) ? 0 : reorderPoint,
      valid: rowErrors.length === 0,
      errors: rowErrors,
    });
  }

  return { rows, parseErrors };
}

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

type Step = 'idle' | 'preview' | 'done';

interface CsvImportArticlesDialogProps {
  onSuccess: () => void;
}

export function CsvImportArticlesDialog({ onSuccess }: CsvImportArticlesDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('idle');
  const [parsed, setParsed] = useState<ParseResult>({ rows: [], parseErrors: [] });
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<{ imported: number; skipped: string[] } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  const mutation = api.articles.importCsv.useMutation({
    onSuccess(data) {
      setResult(data);
      setStep('done');
      if (data.imported > 0) onSuccess();
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result;
      if (typeof text !== 'string') return;
      setParsed(parseCsv(text));
      setStep('preview');
    };
    reader.readAsText(file, 'UTF-8');
  }

  function handleConfirm() {
    const validRows = parsed.rows.filter((r) => r.valid);
    if (validRows.length === 0) return;
    mutation.mutate({
      idempotencyKey: generateUUID(),
      rows: validRows.map((r) => ({
        nome: r.nome,
        sku: r.sku,
        unidade: r.unidade as ArticleUnit,
        minStock: r.minStock,
        reorderPoint: r.reorderPoint,
      })),
    });
  }

  function handleClose() {
    setOpen(false);
    setStep('idle');
    setParsed({ rows: [], parseErrors: [] });
    setFileName('');
    setResult(null);
    mutation.reset();
    if (fileRef.current) fileRef.current.value = '';
  }

  const validCount = parsed.rows.filter((r) => r.valid).length;
  const invalidCount = parsed.rows.filter((r) => !r.valid).length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-soft btn-sm"
        style={{ gap: 6 }}
      >
        <IconUpload size={14} />
        Importar CSV
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-card border border-surface-border bg-white shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-surface-border px-5 py-4">
              <h2 className="text-base font-semibold text-text-primary">
                Importar artigos via CSV
              </h2>
              <button
                onClick={handleClose}
                className="rounded p-1 text-text-muted hover:bg-surface hover:text-text-primary"
              >
                <IconX size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4">
              {step === 'idle' && (
                <div className="space-y-4">
                  <p className="text-sm text-text-secondary">
                    Faça upload de um{' '}
                    <code className="rounded bg-surface px-1 text-xs">.csv</code> com as colunas{' '}
                    <strong>nome, sku, unidade</strong> (obrigatórias) e{' '}
                    <strong>minStock, reorderPoint</strong> (opcionais, padrão 0).
                  </p>

                  <div className="rounded-card border-2 border-dashed border-surface-border p-8 text-center">
                    <IconUpload size={24} className="mx-auto mb-2 text-text-muted" />
                    <p className="mb-3 text-sm text-text-muted">
                      Arraste um ficheiro ou clique para selecionar
                    </p>
                    <label className="cursor-pointer rounded-btn bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
                      Selecionar ficheiro
                      <input
                        ref={fileRef}
                        type="file"
                        accept=".csv,text/csv"
                        className="sr-only"
                        onChange={handleFileChange}
                      />
                    </label>
                  </div>

                  <div className="rounded-card bg-surface p-3">
                    <p className="mb-1 text-xs font-medium text-text-muted">Exemplo de formato:</p>
                    <pre className="text-xs text-text-secondary">
{`nome,sku,unidade,minStock,reorderPoint
Regulateur XR20,VF-001,cx,5,2
Schrader,VF0001,pc,5,2
Deshydrateur DML 162,VF-002,un,5,2`}
                    </pre>
                    <p className="mt-2 text-xs text-text-muted">
                      Unidades válidas:{' '}
                      <span className="font-mono">{ARTICLE_UNITS.join(', ')}</span>
                    </p>
                  </div>
                </div>
              )}

              {step === 'preview' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <span className="font-medium text-text-primary">{fileName}</span>
                    <span>—</span>
                    <span className="text-green-700">{validCount} válido(s)</span>
                    {invalidCount > 0 && (
                      <>
                        <span>/</span>
                        <span className="text-red-600">{invalidCount} inválido(s)</span>
                      </>
                    )}
                  </div>

                  {parsed.parseErrors.length > 0 && (
                    <div className="rounded-card border border-amber-200 bg-amber-50 p-3">
                      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-amber-700">
                        <IconAlertTriangle size={13} />
                        {parsed.parseErrors.length} linha(s) ignoradas por erro de formato:
                      </p>
                      <ul className="list-inside list-disc space-y-0.5 text-xs text-amber-700">
                        {parsed.parseErrors.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {parsed.rows.length > 0 ? (
                    <div className="max-h-64 overflow-auto rounded-card border border-surface-border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-surface-border bg-surface">
                            {['#', 'Nome', 'SKU', 'Unidade', 'Min.', 'Rep.'].map((h) => (
                              <th
                                key={h}
                                className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-text-muted"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-border">
                          {parsed.rows.map((row, i) => (
                            <tr
                              key={i}
                              className={row.valid ? 'hover:bg-surface' : 'bg-red-50 hover:bg-red-100'}
                            >
                              <td className="px-3 py-2 text-xs text-text-muted">{i + 1}</td>
                              <td className="px-3 py-2">
                                <span className={row.valid ? 'text-text-primary' : 'text-red-700'}>
                                  {row.nome || <em className="text-red-500">vazio</em>}
                                </span>
                                {!row.valid && row.errors.length > 0 && (
                                  <p className="text-xs text-red-500">{row.errors.join('; ')}</p>
                                )}
                              </td>
                              <td className="px-3 py-2 font-mono text-xs text-text-primary">
                                {row.sku || <em className="text-red-500">vazio</em>}
                              </td>
                              <td className="px-3 py-2 text-text-secondary">{row.unidade}</td>
                              <td className="px-3 py-2 text-text-secondary">{row.minStock}</td>
                              <td className="px-3 py-2 text-text-secondary">{row.reorderPoint}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-text-muted">
                      Nenhuma linha válida encontrada no ficheiro.
                    </p>
                  )}

                  {mutation.error && (
                    <div className="rounded-card border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                      {mutation.error.message}
                    </div>
                  )}
                </div>
              )}

              {step === 'done' && result && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 rounded-card border border-green-200 bg-green-50 p-4">
                    <IconCheck size={20} className="text-green-600" />
                    <p className="text-sm font-medium text-green-700">
                      {result.imported} artigo(s) importado(s) com sucesso.
                    </p>
                  </div>

                  {result.skipped.length > 0 && (
                    <div className="rounded-card border border-amber-200 bg-amber-50 p-3">
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-amber-700">
                        <IconAlertTriangle size={13} />
                        {result.skipped.length} SKU(s) ignorado(s) — já existiam no catálogo:
                      </p>
                      <ul className="list-inside list-disc space-y-0.5 text-xs text-amber-700">
                        {result.skipped.map((sku) => (
                          <li key={sku} className="font-mono">
                            {sku}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-surface-border px-5 py-3">
              {step === 'idle' && (
                <button
                  onClick={handleClose}
                  className="rounded-btn px-4 py-1.5 text-sm text-text-secondary hover:bg-surface"
                >
                  Cancelar
                </button>
              )}

              {step === 'preview' && (
                <>
                  <button
                    onClick={() => {
                      setStep('idle');
                      setParsed({ rows: [], parseErrors: [] });
                      setFileName('');
                      if (fileRef.current) fileRef.current.value = '';
                    }}
                    className="rounded-btn px-4 py-1.5 text-sm text-text-secondary hover:bg-surface"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={validCount === 0 || mutation.isPending}
                    className="rounded-btn bg-brand-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {mutation.isPending
                      ? 'A importar…'
                      : `Confirmar ${validCount} artigo(s)`}
                  </button>
                </>
              )}

              {step === 'done' && (
                <button
                  onClick={handleClose}
                  className="rounded-btn bg-brand-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-600"
                >
                  Fechar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
