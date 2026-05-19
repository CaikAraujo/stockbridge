import { z } from 'zod';
import { dateRangeSchema, paginationSchema } from './common';

export const movementListSchema = paginationSchema.extend({
  locationId: z.string().uuid().optional(),
  articleId: z.string().uuid().optional(),
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
  dateRange: dateRangeSchema.optional(),
  excludeVoided: z.boolean().default(true),
});

export const recentActivitySchema = z.object({
  limit: z.number().int().min(1).max(50).default(10),
  locationId: z.string().uuid().optional(),
});
