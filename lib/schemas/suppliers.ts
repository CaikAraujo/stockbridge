import { z } from 'zod';
import { paginationSchema } from './common';

export const supplierCreateSchema = z.object({
  idempotencyKey: z.string().uuid(),
  name: z.string().min(1).max(200),
  email: z.string().email().max(200).optional().or(z.literal('')),
  contactName: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
});

export const supplierUpdateSchema = supplierCreateSchema.extend({
  id: z.string().uuid(),
});

export const supplierListSchema = paginationSchema.extend({
  search: z.string().trim().min(1).max(100).optional(),
  includeInactive: z.boolean().default(false),
});

export const supplierToggleActiveSchema = z.object({
  idempotencyKey: z.string().uuid(),
  id: z.string().uuid(),
  active: z.boolean(),
});

export const supplierBulkAssignSchema = z.object({
  idempotencyKey: z.string().uuid(),
  articleIds: z.array(z.string().uuid()).min(1).max(200),
  supplierId: z.string().uuid().nullable(),
});
