import { z } from 'zod';
import { paginationSchema } from './common';

export const purchaseOrderItemSchema = z.object({
  articleId: z.string().uuid(),
  quantity: z
    .string()
    .regex(/^\d+(\.\d{1,3})?$/)
    .refine((v) => parseFloat(v) > 0, { message: 'Quantité doit être positive' }),
  unitCostSnapshot: z.number().nonnegative().optional(),
});

export const purchaseOrderCreateSchema = z.object({
  idempotencyKey: z.string().uuid(),
  supplierId: z.string().uuid(),
  emailSubject: z.string().min(1).max(500),
  emailBody: z.string().min(1).max(10000),
  message: z.string().max(2000).optional(),
  items: z.array(purchaseOrderItemSchema).min(1).max(200),
});

export const purchaseOrderUpdateStatusSchema = z.object({
  idempotencyKey: z.string().uuid(),
  id: z.string().uuid(),
  status: z.enum(['sent', 'confirmed', 'received', 'cancelled']),
});

export const purchaseOrderListSchema = paginationSchema.extend({
  supplierId: z.string().uuid().optional(),
  status: z
    .enum(['ready_to_send', 'sent', 'confirmed', 'received', 'cancelled'])
    .optional(),
});

export const emailTemplateSchema = z.object({
  idempotencyKey: z.string().uuid(),
  emailTemplateSubject: z.string().min(1).max(500),
  emailTemplateGreeting: z.string().min(1).max(500),
  emailTemplateBody: z.string().min(1).max(5000),
  emailTemplateFooter: z.string().min(1).max(2000),
});
