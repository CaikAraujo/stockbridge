import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { gasBottles, notifications, rapportImportItems, rapportImports } from '@/db/schema';
import { normalizeGasCode } from '@/server/routers/gas-bottles';
import {
  extractArticles,
  extractTechnicianName,
  fetchIntervention,
  fetchRecentEvents,
  type InterfastArticle,
} from './interfast-client';

interface ProcessResult {
  processed: number;
  skipped: number;
  errors: string[];
}

export async function processRecentInterventions(hoursBack = 2): Promise<ProcessResult> {
  const result: ProcessResult = { processed: 0, skipped: 0, errors: [] };

  const events = await fetchRecentEvents(hoursBack);

  for (const event of events) {
    try {
      // Verifica se já foi processado (idempotência)
      const existing = await db.query.rapportImports.findFirst({
        where: (r, { eq: eqFn }) => eqFn(r.interfastInterventionId, String(event.id)),
      });

      if (existing) {
        result.skipped++;
        continue;
      }

      // Busca detalhes completos da intervenção
      const intervention = await fetchIntervention(String(event.id));
      const rawArticles = extractArticles(intervention);

      // Ignora intervenções sem artigos
      if (rawArticles.length === 0) {
        result.skipped++;
        continue;
      }

      const techName = extractTechnicianName(intervention);

      // Tenta encontrar o caminhão do técnico pelo primeiro nome
      let locationId: string | null = null;
      if (techName) {
        const firstName = techName.split(' ')[0];
        if (firstName) {
          const techUser = await db.query.users.findFirst({
            where: (u, { ilike: ilikeFn }) => ilikeFn(u.name, `%${firstName}%`),
            columns: { id: true },
          });

          if (techUser) {
            const truck = await db.query.locations.findFirst({
              where: (l, { eq: eqFn, and: andFn }) =>
                andFn(eqFn(l.assignedUserId, techUser.id), eqFn(l.type, 'truck')),
              columns: { id: true },
            });
            locationId = truck?.id ?? null;
          }
        }
      }

      await db.transaction(async (tx) => {
        const [rapportImport] = await tx
          .insert(rapportImports)
          .values({
            interfastInterventionId: String(event.id),
            interfastReference: event.reference,
            technicienName: techName || null,
            clientName: event.client?.name ?? null,
            locationId: locationId ?? undefined,
            interventionDate: intervention.finishDate
              ? new Date(intervention.finishDate).toISOString().split('T')[0]
              : null,
            status: 'pending',
            rawArticles: rawArticles as unknown as Record<string, unknown>[],
          })
          .onConflictDoNothing({ target: rapportImports.interfastInterventionId })
          .returning();

        if (!rapportImport) {
          result.skipped++;
          return;
        }

        for (const article of rawArticles) {
          const cleanName = stripHtml(article.name);
          const matchedArticle = await matchArticle({ ...article, name: cleanName });
          const priceCents = article.price ? parsePriceCents(article.price) : null;

          await tx.insert(rapportImportItems).values({
            rapportId: rapportImport.id,
            description: cleanName,
            interfastArticleId: article.articleId || null,
            supplierCode: article.supplierCode || null,
            quantity: String(article.quantity),
            unit: article.unit,
            priceCents: priceCents ?? undefined,
            articleId: matchedArticle?.id ?? undefined,
            status: matchedArticle ? 'matched' : 'unmatched',
          });

          if (isGasDescription(cleanName) && article.unit === 'kg') {
            await deductGasFromBottle(
              cleanName,
              article.quantity,
              locationId,
              techName ?? null,
              tx,
            );
          }
        }

        result.processed++;
      });
    } catch (err) {
      result.errors.push(
        `Intervention ${event.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return result;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function parsePriceCents(raw: string): number | null {
  const cleaned = raw
    .trim()
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

function isGasDescription(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes('gaz') || n.includes('gas') || n.includes('r-') || /r\d{2,3}[a-z]?/i.test(n);
}

type DbOrTx = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;

async function deductGasFromBottle(
  description: string,
  quantityKg: number,
  locationId: string | null,
  technicianName: string | null,
  tx?: DbOrTx,
): Promise<boolean> {
  if (!locationId) return false;

  const gasCode = normalizeGasCode(description);
  if (gasCode.length < 2) return false;

  const client = tx ?? db;

  // Procura garrafa em uso primeiro, depois qualquer garrafa disponível no caminhão
  const bottleInUse = await client.query.gasBottles.findFirst({
    where: (b, { eq: eqFn, and: andFn }) =>
      andFn(eqFn(b.locationId, locationId), eqFn(b.gasTypeCode, gasCode), eqFn(b.status, 'in_use')),
    columns: { id: true, reference: true, name: true, currentWeightKg: true },
  });

  const bottleFinal =
    bottleInUse ??
    (await client.query.gasBottles.findFirst({
      where: (b, { eq: eqFn, and: andFn }) =>
        andFn(eqFn(b.locationId, locationId), eqFn(b.gasTypeCode, gasCode)),
      columns: { id: true, reference: true, name: true, currentWeightKg: true },
    }));

  if (!bottleFinal) return false;

  const current = parseFloat(bottleFinal.currentWeightKg);
  const newWeight = Math.max(0, current - quantityKg);
  const isEmpty = newWeight <= 0;

  await client
    .update(gasBottles)
    .set({
      currentWeightKg: String(newWeight),
      status: isEmpty ? 'empty' : 'in_use',
      updatedAt: new Date(),
    })
    .where(eq(gasBottles.id, bottleFinal.id));

  if (isEmpty) {
    await client.insert(notifications).values({
      type: 'gas_bottle_empty',
      title: 'Garrafa de gás vazia',
      message: `A garrafa ${bottleFinal.name} (REF: ${bottleFinal.reference}) do motorista ${technicianName ?? 'desconhecido'} ficou vazia.`,
      data: {
        bottleId: bottleFinal.id,
        reference: bottleFinal.reference,
        gasType: bottleFinal.name,
        locationId,
        technicianName,
      },
      status: 'unread',
    });
  }

  return true;
}

async function matchArticle(article: InterfastArticle): Promise<{ id: string } | null> {
  // 1. Match exato por supplierCode → SKU ou barcode
  if (article.supplierCode) {
    const code = article.supplierCode;
    const match = await db.query.articles.findFirst({
      where: (a, { or: orFn, eq: eqFn }) => orFn(eqFn(a.sku, code), eqFn(a.barcode, code)),
      columns: { id: true },
    });
    if (match) return match;
  }

  // 2. Match exato por nome normalizado
  const normalized = normalizeName(article.name);
  if (normalized.length < 3) return null;

  const allArticles = await db.query.articles.findMany({
    where: (a, { eq: eqFn }) => eqFn(a.active, true),
    columns: { id: true, name: true },
  });

  const exact = allArticles.filter((a) => normalizeName(a.name) === normalized);

  // Só faz match se for único e inequívoco
  const firstMatch = exact[0];
  if (exact.length === 1 && firstMatch) return { id: firstMatch.id };
  return null; // ambíguo ou não encontrado → unmatched
}
