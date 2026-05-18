import { z } from 'zod';

export const locationListSchema = z.object({
  type: z.enum(['warehouse', 'truck']).optional(),
  active: z.boolean().default(true),
  withStock: z.boolean().default(false),
});
