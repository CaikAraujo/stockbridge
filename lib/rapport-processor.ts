import { db } from '@/db/client';
import { rapportImportItems, rapportImports } from '@/db/schema';
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
          const matchedArticle = await matchArticle(article);
          const priceCents = article.price ? parsePriceCents(article.price) : null;

          await tx.insert(rapportImportItems).values({
            rapportId: rapportImport.id,
            description: article.name,
            interfastArticleId: article.articleId || null,
            supplierCode: article.supplierCode || null,
            quantity: String(article.quantity),
            unit: article.unit,
            priceCents: priceCents ?? undefined,
            articleId: matchedArticle?.id ?? undefined,
            status: matchedArticle ? 'matched' : 'unmatched',
          });
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
