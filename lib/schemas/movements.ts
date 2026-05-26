import { z } from 'zod';
import { idempotencySchema, paginationSchema } from './common';

export const recentActivitySchema = z.object({
  limit: z.number().int().min(1).max(50).default(10),
  locationId: z.string().uuid().optional(),
});

export const movementListSchema = paginationSchema.extend({
  locationId: z.string().uuid().optional(),
  createdBy: z.string().uuid().optional(),
  type: z
    .enum([
      'consumption',
      'restock',
      'transfer_out',
      'transfer_in',
      'adjustment',
      'initial',
      'return',
    ])
    .optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const withdrawSchema = z
  .object({
    articleId: z.string().uuid(),
    quantity: z.number().positive(),
    fromLocationId: z.string().uuid(),
    toLocationId: z.string().uuid(),
    notes: z.string().max(300).optional(),
  })
  .merge(idempotencySchema);

export const returnSchema = withdrawSchema;

export const voidSchema = z
  .object({
    movementId: z.string().uuid(),
    voidReason: z.string().min(5).max(300),
  })
  .merge(idempotencySchema);

export const restockSchema = z
  .object({
    articleId: z.string().uuid(),
    locationId: z.string().uuid(),
    quantity: z.number().positive(),
    notes: z.string().max(300).optional(),
    unitCostCents: z.number().int().nonnegative().optional(),
  })
  .merge(idempotencySchema);

export const adjustSchema = z
  .object({
    articleId: z.string().uuid(),
    locationId: z.string().uuid(),
    newQuantity: z.number().min(0),
    reason: z.string().min(5, 'Motivo obrigatório (mín. 5 caracteres)').max(300),
    photoUrl: z.string().url().optional(),
  })
  .merge(idempotencySchema);
