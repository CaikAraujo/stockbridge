/**
 * Backfill: decodifica entidades HTML em linhas já gravadas na base de dados.
 *
 * Campos verificados:
 *   rapport_imports  → interfast_reference, technicien_name, client_name
 *   rapport_import_items → description, supplier_code
 *
 * Uso:
 *   pnpm tsx scripts/backfill-html-entities.ts --dry-run   (só mostra, não escreve)
 *   pnpm tsx scripts/backfill-html-entities.ts             (aplica alterações)
 */

import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { rapportImportItems, rapportImports } from '@/db/schema';
import { decodeHtmlEntities } from '@/lib/utils';

const isDryRun = process.argv.includes('--dry-run');

interface Change {
  table: string;
  id: string;
  field: string;
  before: string;
  after: string;
}

function decode(value: string | null | undefined): string | null {
  if (!value) return value ?? null;
  return decodeHtmlEntities(value);
}

function differs(original: string | null | undefined, decoded: string | null): boolean {
  const orig = original ?? null;
  return orig !== decoded;
}

async function backfillRapportImports(changes: Change[]): Promise<void> {
  const rows = await db.query.rapportImports.findMany({
    columns: {
      id: true,
      interfastReference: true,
      technicienName: true,
      clientName: true,
    },
  });

  for (const row of rows) {
    const fields: Array<{
      field: keyof typeof row;
      label: string;
    }> = [
      { field: 'interfastReference', label: 'interfast_reference' },
      { field: 'technicienName', label: 'technicien_name' },
      { field: 'clientName', label: 'client_name' },
    ];

    const updates: Partial<{
      interfastReference: string | null;
      technicienName: string | null;
      clientName: string | null;
    }> = {};

    let hasChange = false;

    for (const { field, label } of fields) {
      const original = row[field] as string | null;
      const decoded = decode(original);
      if (differs(original, decoded)) {
        changes.push({
          table: 'rapport_imports',
          id: row.id,
          field: label,
          before: original ?? '(null)',
          after: decoded ?? '(null)',
        });
        // biome-ignore lint/suspicious/noExplicitAny: dynamic field assignment
        (updates as any)[field] = decoded;
        hasChange = true;
      }
    }

    if (hasChange && !isDryRun) {
      await db
        .update(rapportImports)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(rapportImports.id, row.id));
    }
  }
}

async function backfillRapportImportItems(changes: Change[]): Promise<void> {
  const rows = await db.query.rapportImportItems.findMany({
    columns: {
      id: true,
      description: true,
      supplierCode: true,
    },
  });

  for (const row of rows) {
    const decodedDescription = decode(row.description);
    const decodedSupplierCode = decode(row.supplierCode);

    const updates: Partial<{
      description: string;
      supplierCode: string | null;
    }> = {};

    let hasChange = false;

    if (differs(row.description, decodedDescription)) {
      changes.push({
        table: 'rapport_import_items',
        id: row.id,
        field: 'description',
        before: row.description,
        after: decodedDescription ?? '',
      });
      if (decodedDescription !== null) {
        updates.description = decodedDescription;
      }
      hasChange = true;
    }

    if (differs(row.supplierCode, decodedSupplierCode)) {
      changes.push({
        table: 'rapport_import_items',
        id: row.id,
        field: 'supplier_code',
        before: row.supplierCode ?? '(null)',
        after: decodedSupplierCode ?? '(null)',
      });
      updates.supplierCode = decodedSupplierCode;
      hasChange = true;
    }

    if (hasChange && !isDryRun) {
      await db
        .update(rapportImportItems)
        .set(updates)
        .where(eq(rapportImportItems.id, row.id));
    }
  }
}

async function main(): Promise<void> {
  const mode = isDryRun ? 'DRY-RUN' : 'APPLY';
  console.log(`\n=== Backfill HTML entities [${mode}] ===\n`);

  const changes: Change[] = [];

  await backfillRapportImports(changes);
  await backfillRapportImportItems(changes);

  if (changes.length === 0) {
    console.log('Nenhuma linha necessita de actualização. Base de dados já está limpa.');
    process.exit(0);
  }

  const byTable: Record<string, Change[]> = {};
  for (const c of changes) {
    (byTable[c.table] ??= []).push(c);
  }

  for (const [table, rows] of Object.entries(byTable)) {
    console.log(`\n── ${table} (${rows.length} campo(s))`);
    for (const c of rows) {
      console.log(`   id=${c.id}  campo=${c.field}`);
      console.log(`     antes : ${c.before}`);
      console.log(`     depois: ${c.after}`);
    }
  }

  console.log(`\nTotal: ${changes.length} campo(s) em ${new Set(changes.map((c) => c.id)).size} linha(s).`);

  if (isDryRun) {
    console.log('\n[DRY-RUN] Nada foi escrito. Corra sem --dry-run para aplicar.\n');
  } else {
    console.log('\n[APPLY] Actualização concluída.\n');
  }

  process.exit(0);
}

main().catch((err: unknown) => {
  console.error('Erro no backfill:', err);
  process.exit(1);
});
