import 'server-only';
import { TRPCError } from '@trpc/server';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { DB } from '@/db/client';
import { articles, stockLevels, stockMovements, transferItems, transfers } from '@/db/schema';

export interface WithdrawalParams {
  articleId: string;
  quantity: number;
  fromLocationId: string;
  toLocationId: string;
  createdBy: string;
  idempotencyKey: string;
  jobId?: string;
  notes?: string;
}

export interface ReturnParams {
  articleId: string;
  quantity: number;
  fromLocationId: string;
  toLocationId: string;
  createdBy: string;
  idempotencyKey: string;
  notes?: string;
}

export interface VoidParams {
  movementId: string;
  voidedBy: string;
  voidReason: string;
}

export class StockMovementService {
  constructor(private db: DB) {}

  // ================================================================
  // RETIRADA: Depósito → Caminhão
  // ================================================================
  async createWithdrawal(params: WithdrawalParams) {
    if (params.quantity <= 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Quantidade deve ser maior que zero',
      });
    }

    // CORREÇÃO 1 — Idempotência antes de qualquer operação
    const existing = await this.db
      .select({ transferId: stockMovements.transferId })
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.createdBy, params.createdBy),
          eq(stockMovements.idempotencyKey, `${params.idempotencyKey}-out`),
        ),
      )
      .limit(1);

    if (existing[0]?.transferId) {
      const [transfer] = await this.db
        .select()
        .from(transfers)
        .where(eq(transfers.id, existing[0].transferId));
      if (!transfer) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      return transfer;
    }

    const quantityStr = params.quantity.toFixed(3);

    return await this.db.transaction(async (tx) => {
      // CORREÇÃO 2a — SELECT FOR UPDATE garante exclusividade na tx
      const [level] = await tx
        .select({ quantity: stockLevels.quantity })
        .from(stockLevels)
        .where(
          and(
            eq(stockLevels.articleId, params.articleId),
            eq(stockLevels.locationId, params.fromLocationId),
          ),
        )
        .for('update');

      const current = parseFloat(level?.quantity ?? '0');
      if (current < params.quantity) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Estoque insuficiente. Disponível: ${current.toFixed(3)}, solicitado: ${params.quantity}`,
        });
      }

      // CORREÇÃO 2b — Código gerado via função SQL (sem race condition)
      const codeResult = await tx.execute<{ code: string }>(
        sql`SELECT next_transfer_code() as code`,
      );
      const code = codeResult.rows[0]?.code ?? '';

      // CORREÇÃO 2c — Snapshot do custo dentro da tx
      const [article] = await tx
        .select({ costPriceCents: articles.costPriceCents })
        .from(articles)
        .where(eq(articles.id, params.articleId));

      const [transfer] = await tx
        .insert(transfers)
        .values({
          code,
          fromLocationId: params.fromLocationId,
          toLocationId: params.toLocationId,
          status: 'received',
          createdBy: params.createdBy,
          shippedBy: params.createdBy,
          shippedAt: new Date(),
          receivedBy: params.createdBy,
          receivedAt: new Date(),
          notes: params.notes,
        })
        .returning();

      if (!transfer) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      await tx.insert(stockMovements).values({
        articleId: params.articleId,
        locationId: params.fromLocationId,
        quantityDelta: `-${quantityStr}`,
        movementType: 'transfer_out',
        transferId: transfer.id,
        jobId: params.jobId,
        unitCostCents: article?.costPriceCents,
        createdBy: params.createdBy,
        notes: params.notes,
        idempotencyKey: `${params.idempotencyKey}-out`,
      });

      await tx.insert(stockMovements).values({
        articleId: params.articleId,
        locationId: params.toLocationId,
        quantityDelta: quantityStr,
        movementType: 'transfer_in',
        transferId: transfer.id,
        jobId: params.jobId,
        unitCostCents: article?.costPriceCents,
        createdBy: params.createdBy,
        notes: params.notes,
        idempotencyKey: `${params.idempotencyKey}-in`,
      });

      await tx.insert(transferItems).values({
        transferId: transfer.id,
        articleId: params.articleId,
        quantityShipped: quantityStr,
        quantityReceived: quantityStr,
      });

      return transfer;
    });
  }

  // ================================================================
  // DEVOLUÇÃO: Caminhão → Depósito
  // ================================================================
  async createReturn(params: ReturnParams) {
    if (params.quantity <= 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Quantidade deve ser maior que zero',
      });
    }

    // CORREÇÃO 1 — Idempotência antes de qualquer operação
    const existing = await this.db
      .select({ transferId: stockMovements.transferId })
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.createdBy, params.createdBy),
          eq(stockMovements.idempotencyKey, `${params.idempotencyKey}-out`),
        ),
      )
      .limit(1);

    if (existing[0]?.transferId) {
      const [transfer] = await this.db
        .select()
        .from(transfers)
        .where(eq(transfers.id, existing[0].transferId));
      if (!transfer) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      return transfer;
    }

    const quantityStr = params.quantity.toFixed(3);

    return await this.db.transaction(async (tx) => {
      // CORREÇÃO 2a — SELECT FOR UPDATE garante exclusividade na tx
      const [level] = await tx
        .select({ quantity: stockLevels.quantity })
        .from(stockLevels)
        .where(
          and(
            eq(stockLevels.articleId, params.articleId),
            eq(stockLevels.locationId, params.fromLocationId),
          ),
        )
        .for('update');

      const current = parseFloat(level?.quantity ?? '0');
      if (current < params.quantity) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Estoque insuficiente. Disponível: ${current.toFixed(3)}, solicitado: ${params.quantity}`,
        });
      }

      // CORREÇÃO 2b — Código gerado via função SQL (sem race condition)
      const codeResult = await tx.execute<{ code: string }>(
        sql`SELECT next_transfer_code() as code`,
      );
      const code = codeResult.rows[0]?.code ?? '';

      // CORREÇÃO 2c — Snapshot do custo dentro da tx
      const [article] = await tx
        .select({ costPriceCents: articles.costPriceCents })
        .from(articles)
        .where(eq(articles.id, params.articleId));

      const [transfer] = await tx
        .insert(transfers)
        .values({
          code,
          fromLocationId: params.fromLocationId,
          toLocationId: params.toLocationId,
          status: 'received',
          createdBy: params.createdBy,
          shippedBy: params.createdBy,
          shippedAt: new Date(),
          receivedBy: params.createdBy,
          receivedAt: new Date(),
          notes: params.notes,
        })
        .returning();

      if (!transfer) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      await tx.insert(stockMovements).values({
        articleId: params.articleId,
        locationId: params.fromLocationId,
        quantityDelta: `-${quantityStr}`,
        movementType: 'transfer_out',
        transferId: transfer.id,
        unitCostCents: article?.costPriceCents,
        createdBy: params.createdBy,
        notes: params.notes,
        idempotencyKey: `${params.idempotencyKey}-out`,
      });

      await tx.insert(stockMovements).values({
        articleId: params.articleId,
        locationId: params.toLocationId,
        quantityDelta: quantityStr,
        movementType: 'return',
        transferId: transfer.id,
        unitCostCents: article?.costPriceCents,
        createdBy: params.createdBy,
        notes: params.notes,
        idempotencyKey: `${params.idempotencyKey}-in`,
      });

      await tx.insert(transferItems).values({
        transferId: transfer.id,
        articleId: params.articleId,
        quantityShipped: quantityStr,
        quantityReceived: quantityStr,
      });

      return transfer;
    });
  }

  // ================================================================
  // VOID: estorno atômico com WHERE (CORREÇÃO 3)
  // O trigger SQL reverte o stock_levels automaticamente
  // ================================================================
  async voidMovement(params: VoidParams) {
    return await this.db.transaction(async (tx) => {
      const [voided] = await tx
        .update(stockMovements)
        .set({
          voidedAt: new Date(),
          voidedBy: params.voidedBy,
          voidReason: params.voidReason,
        })
        .where(and(eq(stockMovements.id, params.movementId), isNull(stockMovements.voidedAt)))
        .returning();

      if (!voided) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Movimento já foi estornado',
        });
      }

      return voided;
    });
  }

  // ================================================================
  // RESTOCK: entrada de mercadoria no depósito
  // ================================================================
  async createRestock(params: {
    articleId: string;
    locationId: string;
    quantity: number;
    notes?: string;
    unitCostCents?: number;
    createdBy: string;
    idempotencyKey: string;
  }) {
    const location = await this.db.query.locations.findFirst({
      where: (l, { eq: eqFn }) => eqFn(l.id, params.locationId),
      columns: { type: true, active: true },
    });
    if (!location?.active || location.type !== 'warehouse') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Restock permitido apenas no depósito',
      });
    }

    return await this.db.transaction(async (tx) => {
      const quantityStr = params.quantity.toFixed(3);
      const [movement] = await tx
        .insert(stockMovements)
        .values({
          articleId: params.articleId,
          locationId: params.locationId,
          quantityDelta: quantityStr,
          movementType: 'restock',
          unitCostCents: params.unitCostCents,
          notes: params.notes,
          createdBy: params.createdBy,
          idempotencyKey: params.idempotencyKey,
        })
        .returning();
      if (!movement) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      return movement;
    });
  }

  // ================================================================
  // ADJUSTMENT: ajuste manual de inventário (admin)
  // ================================================================
  async createAdjustment(params: {
    articleId: string;
    locationId: string;
    newQuantity: number;
    reason: string;
    photoUrl?: string;
    createdBy: string;
    idempotencyKey: string;
  }) {
    return await this.db.transaction(async (tx) => {
      const [level] = await tx
        .select({ quantity: stockLevels.quantity })
        .from(stockLevels)
        .where(
          and(
            eq(stockLevels.articleId, params.articleId),
            eq(stockLevels.locationId, params.locationId),
          ),
        )
        .for('update');

      const current = parseFloat(level?.quantity ?? '0');
      const delta = params.newQuantity - current;

      if (Math.abs(delta) < 0.001) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Quantidade nova é igual à atual. Nenhum ajuste necessário.',
        });
      }

      const [movement] = await tx
        .insert(stockMovements)
        .values({
          articleId: params.articleId,
          locationId: params.locationId,
          quantityDelta: delta.toFixed(3),
          movementType: 'adjustment',
          reason: params.reason,
          photoUrl: params.photoUrl,
          createdBy: params.createdBy,
          idempotencyKey: params.idempotencyKey,
        })
        .returning();

      if (!movement) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      return movement;
    });
  }

  // ================================================================
  // CONSUMPTION: saída por consumo operacional (rapport InterFast)
  // ================================================================
  async createConsumption(params: {
    articleId: string;
    locationId: string;
    quantity: number;
    reason: string;
    createdBy: string;
    idempotencyKey: string;
    allowNegative?: boolean;
  }) {
    if (params.quantity <= 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Quantidade deve ser > 0',
      });
    }
    return await this.db.transaction(async (tx) => {
      const [level] = await tx
        .select({ quantity: stockLevels.quantity })
        .from(stockLevels)
        .where(
          and(
            eq(stockLevels.articleId, params.articleId),
            eq(stockLevels.locationId, params.locationId),
          ),
        )
        .for('update');
      const current = parseFloat(level?.quantity ?? '0');
      if (!params.allowNegative && current < params.quantity) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Estoque insuficiente: disponível ${current.toFixed(3)}, consumo ${params.quantity}`,
        });
      }
      const [movement] = await tx
        .insert(stockMovements)
        .values({
          articleId: params.articleId,
          locationId: params.locationId,
          quantityDelta: (-params.quantity).toFixed(3),
          movementType: 'consumption',
          reason: params.reason,
          createdBy: params.createdBy,
          idempotencyKey: params.idempotencyKey,
        })
        .returning();
      if (!movement) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      return movement;
    });
  }

  // ================================================================
  // VOID TRANSFER: estorna todos os movimentos de uma transferência
  // (CORREÇÃO 4)
  // ================================================================
  async voidTransfer(params: { transferId: string; voidedBy: string; voidReason: string }) {
    return await this.db.transaction(async (tx) => {
      const voided = await tx
        .update(stockMovements)
        .set({
          voidedAt: new Date(),
          voidedBy: params.voidedBy,
          voidReason: params.voidReason,
        })
        .where(
          and(eq(stockMovements.transferId, params.transferId), isNull(stockMovements.voidedAt)),
        )
        .returning();

      if (voided.length === 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Transferência já foi estornada',
        });
      }

      return voided;
    });
  }
}
