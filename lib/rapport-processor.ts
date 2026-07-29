import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { gasBottles, notifications, rapportImportItems, rapportImports, stockLevels } from '@/db/schema';
import { decodeHtmlEntities } from '@/lib/utils';
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

type MatchResult =
  | { kind: 'ok'; articleId: string }
  | { kind: 'needs_review'; reason: string };

export async function processRecentInterventions(hoursBack = 2): Promise<ProcessResult> {
  const result: ProcessResult = { processed: 0, skipped: 0, errors: [] };
  const events = await fetchRecentEvents(hoursBack);

  for (const event of events) {
    try {
      const existing = await db.query.rapportImports.findFirst({
        where: (r, { eq: eqFn }) => eqFn(r.interfastInterventionId, String(event.id)),
      });
      if (existing) { result.skipped++; continue; }

      const intervention = await fetchIntervention(String(event.id));
      const rawArticles = extractArticles(intervention);
      if (rawArticles.length === 0) { result.skipped++; continue; }

      const techName = decodeHtmlEntities(extractTechnicianName(intervention));

      // Resolve técnico → caminhão. Se falhar, todos os artigos vão a needs_review.
      let locationId: string | null = null;
      let techReviewReason: string | null = null;

      if (!techName) {
        techReviewReason = 'Technicien introuvable dans le système';
      } else {
        const firstName = techName.split(' ')[0];
        if (!firstName) {
          techReviewReason = 'Technicien introuvable dans le système';
        } else {
          const techUser = await db.query.users.findFirst({
            where: (u, { ilike: ilikeFn }) => ilikeFn(u.name, `%${firstName}%`),
            columns: { id: true },
          });
          if (!techUser) {
            techReviewReason = 'Technicien introuvable dans le système';
          } else {
            const truck = await db.query.locations.findFirst({
              where: (l, { eq: eqFn, and: andFn }) =>
                andFn(eqFn(l.assignedUserId, techUser.id), eqFn(l.type, 'truck')),
              columns: { id: true },
            });
            if (!truck) {
              techReviewReason = 'Aucun camion attribué à ce chauffeur';
            } else {
              locationId = truck.id;
            }
          }
        }
      }

      await db.transaction(async (tx) => {
        const [rapportImport] = await tx
          .insert(rapportImports)
          .values({
            interfastInterventionId: String(event.id),
            interfastReference: event.reference ? decodeHtmlEntities(event.reference) : null,
            technicienName: techName || null,
            clientName: event.client?.name ? decodeHtmlEntities(event.client.name) : null,
            locationId: locationId ?? undefined,
            interventionDate: intervention.finishDate
              ? new Date(intervention.finishDate).toISOString().split('T')[0]
              : null,
            status: 'pending',
            rawArticles: rawArticles as unknown as Record<string, unknown>[],
          })
          .onConflictDoNothing({ target: rapportImports.interfastInterventionId })
          .returning();

        if (!rapportImport) { result.skipped++; return; }

        for (const article of rawArticles) {
          const cleanName = decodeHtmlEntities(article.name);
          const cleanSupplierCode = article.supplierCode
            ? decodeHtmlEntities(article.supplierCode)
            : '';
          const cleanArticle = { ...article, name: cleanName, supplierCode: cleanSupplierCode };

          // Se o técnico/caminhão não foi resolvido, todos os artigos ficam needs_review.
          let matchResult: MatchResult;
          if (techReviewReason !== null || locationId === null) {
            matchResult = {
              kind: 'needs_review',
              reason: techReviewReason ?? 'Technicien introuvable dans le système',
            };
          } else {
            matchResult = await matchArticleInStock(cleanArticle, locationId);
          }

          const priceCents = article.price ? parsePriceCents(article.price) : null;

          await tx.insert(rapportImportItems).values({
            rapportId: rapportImport.id,
            description: cleanName,
            interfastArticleId: article.articleId || null,
            supplierCode: cleanSupplierCode || null,
            quantity: String(article.quantity),
            unit: article.unit,
            priceCents: priceCents ?? undefined,
            articleId: matchResult.kind === 'ok' ? matchResult.articleId : undefined,
            status: matchResult.kind === 'ok' ? 'matched' : 'needs_review',
            reviewReason: matchResult.kind === 'needs_review' ? matchResult.reason : null,
          });

          // Dedução de garrafas de gás (sistema separado de stock_levels).
          // Só acontece quando o artigo deu match e a localização é conhecida.
          if (matchResult.kind === 'ok' && isGasDescription(cleanName) && article.unit === 'kg') {
            await deductGasFromBottle(cleanName, article.quantity, locationId, techName || null, tx);
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

// ─── Catálogo ────────────────────────────────────────────────────────────────

async function findInCatalog(article: InterfastArticle): Promise<{ id: string } | null> {
  // 1. Código de fornecedor → SKU ou barcode (match exato)
  if (article.supplierCode) {
    const match = await db.query.articles.findFirst({
      where: (a, { or: orFn, eq: eqFn }) =>
        orFn(eqFn(a.sku, article.supplierCode), eqFn(a.barcode, article.supplierCode)),
      columns: { id: true },
    });
    if (match) return match;
  }

  // 2. Nome normalizado (exato e inequívoco — sem substring)
  const normalized = normalizeName(article.name);
  if (normalized.length < 3) return null;

  const allActive = await db.query.articles.findMany({
    where: (a, { eq: eqFn }) => eqFn(a.active, true),
    columns: { id: true, name: true },
  });

  const exact = allActive.filter((a) => normalizeName(a.name) === normalized);
  const first = exact[0];
  if (exact.length === 1 && first) return { id: first.id };
  return null;
}

// ─── Match com verificação de stock no caminhão ───────────────────────────────

async function matchArticleInStock(
  article: InterfastArticle,
  locationId: string,
): Promise<MatchResult> {
  const catalogMatch = await findInCatalog(article);
  if (!catalogMatch) return { kind: 'needs_review', reason: 'Article inconnu' };

  const level = await db.query.stockLevels.findFirst({
    where: (sl, { eq: eqFn, and: andFn }) =>
      andFn(eqFn(sl.articleId, catalogMatch.id), eqFn(sl.locationId, locationId)),
    columns: { quantity: true },
  });

  if (!level) {
    return { kind: 'needs_review', reason: 'Article absent du stock du camion' };
  }

  const available = parseFloat(level.quantity);
  if (available < article.quantity) {
    return {
      kind: 'needs_review',
      reason: `Stock insuffisant sur le camion (disponible\u00a0: ${level.quantity})`,
    };
  }

  return { kind: 'ok', articleId: catalogMatch.id };
}

// ─── Utilitários ─────────────────────────────────────────────────────────────

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

// ─── Garrafas de gás (tracking físico separado do stock_levels) ───────────────

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
    .set({ currentWeightKg: String(newWeight), status: isEmpty ? 'empty' : 'in_use', updatedAt: new Date() })
    .where(eq(gasBottles.id, bottleFinal.id));

  if (isEmpty) {
    await client.insert(notifications).values({
      type: 'gas_bottle_empty',
      title: 'Garrafa de gás vazia',
      message: `A garrafa ${bottleFinal.name} (REF: ${bottleFinal.reference}) do motorista ${technicianName ?? 'desconhecido'} ficou vazia.`,
      data: { bottleId: bottleFinal.id, reference: bottleFinal.reference, gasType: bottleFinal.name, locationId, technicianName },
      status: 'unread',
    });
  }

  return true;
}
