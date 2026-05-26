import { timingSafeEqual } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { db } from '@/db/client';
import { articles, locations, stockLevels } from '@/db/schema';
import { stockAlertEmailHtml } from '@/lib/email/stock-alert-template';

const resend = new Resend(process.env.RESEND_API_KEY);

function verifyToken(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const auth = req.headers.get('authorization');
  if (!process.env.JOBS_SECRET || !verifyToken(auth ?? '', `Bearer ${process.env.JOBS_SECRET}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const lowItems = await db
    .select({
      articleName: articles.name,
      articleSku: articles.sku,
      unit: articles.unit,
      quantity: stockLevels.quantity,
      reorderPoint: articles.reorderPoint,
      locationName: locations.name,
    })
    .from(stockLevels)
    .innerJoin(articles, eq(stockLevels.articleId, articles.id))
    .innerJoin(locations, eq(stockLevels.locationId, locations.id))
    .where(
      and(
        sql`CAST(${stockLevels.quantity} AS numeric) <= CAST(${articles.reorderPoint} AS numeric)`,
        eq(articles.active, true),
        eq(locations.active, true),
      ),
    )
    .orderBy(locations.name, articles.name);

  if (lowItems.length === 0) {
    return NextResponse.json({ sent: false, reason: 'Nenhum item abaixo do mínimo' });
  }

  const admins = await db.query.users.findMany({
    where: (u, { eq: eqFn, and: andFn }) => andFn(eqFn(u.role, 'admin'), eqFn(u.active, true)),
    columns: { email: true },
  });

  const adminEmails = admins.map((a) => a.email).filter((e): e is string => !!e);

  if (adminEmails.length === 0) {
    return NextResponse.json({ sent: false, reason: 'Nenhum admin com email cadastrado' });
  }

  try {
    await resend.emails.send({
      from: process.env.AUTH_EMAIL_FROM ?? 'noreply@stockbridge.local',
      to: adminEmails,
      subject: `StockBridge — ${lowItems.length} item(ns) abaixo do estoque mínimo`,
      html: stockAlertEmailHtml(
        lowItems.map((item) => ({
          articleName: item.articleName,
          articleSku: item.articleSku,
          unit: item.unit,
          quantity: item.quantity,
          reorderPoint: item.reorderPoint,
          locationName: item.locationName,
        })),
      ),
    });
  } catch {
    return NextResponse.json({ error: 'Erro ao enviar email. Tente novamente.' }, { status: 500 });
  }

  return NextResponse.json({
    sent: true,
    itemCount: lowItems.length,
    sentTo: adminEmails.length,
  });
}
