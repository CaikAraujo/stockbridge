import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().min(1).max(500).default(20),
});

export const idSchema = z.object({
  id: z.string().uuid(),
});

export const idempotencySchema = z.object({
  idempotencyKey: z.string().uuid(),
});

export const dateRangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
