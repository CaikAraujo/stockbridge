'use client';

import { IconAlertTriangle, IconCheck, IconUpload, IconX } from '@tabler/icons-react';
import { useRef, useState } from 'react';
import { api } from '@/lib/trpc/client';

type CsvRow = { nome: string; quantidade: number; unidade: string };

type ParseResult = { rows: CsvRow[]; errors: string[] };

function parseCsv(text: string): ParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return { rows: [], errors: ['Ficheiro vazio.'] };

  // Detecta e ignora cabeçalho
  const firstLine = lines[0] ?? '';
  const hasHeader =
    /nome/i.test(firstLine) ||
    isNaN(parseFloat(firstLine.split(',')[1] ?? ''));
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const rows: CsvRow[] = [];
  const errors: string[] = [];

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i];
    if (!line) continue;
    const parts = line.split(',').map((p) => p.trim());
    const [nome, quantStr, unidade] = parts;

    if (!nome || !quantStr || !unidade) {
      errors.push(`Linha ${i + 2}: formato inválido — esperado "nome,quantidade,unidade"`);
      continue;
    }

    const quantidade = parseFloat(quantStr);
    if (isNaN(quantidade) || quantidade <= 0) {
      errors.push(`Linha ${i + 2}: quantidade inválida ("${quantStr}")`);
      continue;
    }

    rows.push({ nome, quantidade, unidade });
  }

  return { rows, errors };
}

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

type Step = 'idle' | 'preview' | 'done';

interface CsvImportDialogProps {
  warehouseId: string;
  onSuccess: () => void;
}

export function CsvImportDialog({ warehouseId, onSuccess }: CsvImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('idle');
  const [parsed, setParsed] = useState<ParseResult>({ rows: [], errors: [] });
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<{ imported: number; notFound: string[] } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  const mutation = api.movements.importCsv.useMutation({
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
    if (parsed.rows.length === 0) return;
    mutation.mutate({
      warehouseId,
      rows: parsed.rows,
      idempotencyKey: generateUUID(),
    });
  }

  function handleClose() {
    setOpen(false);
    setStep('idle');
    setParsed({ rows: [], errors: [] });
    setFileName('');
    setResult(null);
    mutation.reset();
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-btn border border-surface-border bg-white px-3 py-1.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface"
      >
        <IconUpload size={14} />
        Importar CSV
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-card border border-surface-border bg-white shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-surface-border px-5 py-4">
              <h2 className="text-base font-semibold text-text-primary">Importar CSV — Depósito</h2>
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
                    Faça upload de um <code className="rounded bg-surface px-1 text-xs">.csv</code>{' '}
                    com as colunas <strong>nome, quantidade, unidade</strong> (uma linha por artigo).
                  </p>

                  <div className="rounded-card border-2 border-dashed border-surface-border p-8 text-center">
                    <IconUpload size={24} className="mx-auto mb-2 text-text-muted" />
                    <p className="mb-3 text-sm text-text-muted">Arraste um ficheiro ou clique para seleccionar</p>
                    <label className="cursor-pointer rounded-btn bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
                      Seleccionar ficheiro
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
{`nome,quantidade,unidade
Filtre déshydrateur 10gr,25,un
Huile POE 68 - 1L,12,un`}
                    </pre>
                  </div>
                </div>
              )}

              {step === 'preview' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <span className="font-medium text-text-primary">{fileName}</span>
                    <span>—</span>
                    <span>{parsed.rows.length} artigo(s) reconhecidos</span>
                  </div>

                  {parsed.errors.length > 0 && (
                    <div className="rounded-card border border-amber-200 bg-amber-50 p-3">
                      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-amber-700">
                        <IconAlertTriangle size={13} />
                        {parsed.errors.length} linha(s) ignoradas por erro de formato:
                      </p>
                      <ul className="list-inside list-disc space-y-0.5 text-xs text-amber-700">
                        {parsed.errors.map((e, i) => (
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
                            {['#', 'Nome', 'Quantidade', 'Unidade'].map((h) => (
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
                            <tr key={i} className="hover:bg-surface">
                              <td className="px-3 py-2 text-xs text-text-muted">{i + 1}</td>
                              <td className="px-3 py-2 text-text-primary">{row.nome}</td>
                              <td className="px-3 py-2 font-medium text-text-primary">
                                {row.quantidade}
                              </td>
                              <td className="px-3 py-2 text-text-secondary">{row.unidade}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-text-muted">Nenhum artigo válido encontrado no ficheiro.</p>
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
                      {result.imported} artigo(s) importados com sucesso.
                    </p>
                  </div>

                  {result.notFound.length > 0 && (
                    <div className="rounded-card border border-amber-200 bg-amber-50 p-3">
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-amber-700">
                        <IconAlertTriangle size={13} />
                        {result.notFound.length} artigo(s) não encontrado(s) no catálogo:
                      </p>
                      <ul className="list-inside list-disc space-y-0.5 text-xs text-amber-700">
                        {result.notFound.map((name) => (
                          <li key={name}>{name}</li>
                        ))}
                      </ul>
                      <p className="mt-2 text-xs text-amber-600">
                        Crie esses artigos no catálogo antes de importar novamente.
                      </p>
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
                      setParsed({ rows: [], errors: [] });
                      setFileName('');
                      if (fileRef.current) fileRef.current.value = '';
                    }}
                    className="rounded-btn px-4 py-1.5 text-sm text-text-secondary hover:bg-surface"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={parsed.rows.length === 0 || mutation.isPending}
                    className="rounded-btn bg-brand-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {mutation.isPending
                      ? 'A importar…'
                      : `Confirmar ${parsed.rows.length} artigo(s)`}
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
