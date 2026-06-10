import { z } from 'zod';

export const userCreateSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  role: z.enum(['admin', 'manager', 'driver']),
  defaultLocationId: z.string().uuid().optional(),
});

export const createDriverSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(100),
  email: z.string().email('E-mail inválido'),
  truckId: z.string().uuid().optional(),
});

export const deleteDriverSchema = z.object({
  userId: z.string().uuid(),
});

export const userUpdateSchema = userCreateSchema.partial().extend({
  id: z.string().uuid(),
  active: z.boolean().optional(),
});

export const setPinSchema = z.object({
  userId: z.string().uuid(),
  pin: z
    .string()
    .length(4)
    .regex(/^\d{4}$/, 'PIN deve ter 4 dígitos'),
});

export const verifyPinSchema = z.object({
  pin: z
    .string()
    .length(4)
    .regex(/^\d{4}$/),
});

export const getDriverPinSchema = z.object({
  userId: z.string().uuid(),
});
