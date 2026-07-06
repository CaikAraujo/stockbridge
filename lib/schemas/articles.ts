import { z } from 'zod';
import { paginationSchema } from './common';

export const ARTICLE_UNITS = [
  'un', 'pc', 'cx', 'kg', 'g', 'l', 'ml', 'm', 'cm', 'rl', 'par',
] as const;

export type ArticleUnit = (typeof ARTICLE_UNITS)[number];

const unitEnum = z.enum(ARTICLE_UNITS);

export const articleCreateSchema = z.object({
  idempotencyKey: z.string().uuid(),
  sku: z.string().min(1).max(50),
  barcode: z.string().max(50).optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  unit: unitEnum,
  categoryId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  costPriceCents: z.number().int().nonnegative().optional(),
  salePriceCents: z.number().int().nonnegative().optional(),
  minStock: z
    .string()
    .regex(/^\d+(\.\d{1,3})?$/)
    .default('0'),
  reorderPoint: z
    .string()
    .regex(/^\d+(\.\d{1,3})?$/)
    .default('0'),
  refrigerantType: z.string().max(20).optional(),
});

export const articleUpdateSchema = articleCreateSchema.partial().extend({
  id: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
});

export const articleCsvRowSchema = z.object({
  nome: z.string().min(1).max(200),
  sku: z.string().min(1).max(50),
  unidade: z.enum(ARTICLE_UNITS),
  minStock: z.number().nonnegative().default(0),
  reorderPoint: z.number().nonnegative().default(0),
});

export const articleImportCsvSchema = z.object({
  idempotencyKey: z.string().uuid(),
  rows: z.array(articleCsvRowSchema).min(1).max(500),
});

export const articleListSchema = paginationSchema.extend({
  search: z.string().trim().min(1).max(50).optional(),
  categoryId: z.string().uuid().optional(),
  active: z.boolean().default(true),
});
