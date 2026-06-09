import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { generateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';
import { z } from 'zod';
import { sessions, users } from '@/db/schema';
import { decryptSecret, encryptSecret } from '@/lib/crypto';
import { checkRateLimit } from '@/lib/rate-limit';
import { adminProcedure, protectedProcedure } from '@/server/procedures';
import { router } from '@/server/trpc';

const APP_NAME = 'StockBridge';

const codeSchema = z.object({
  code: z
    .string()
    .length(6)
    .regex(/^\d{6}$/),
});

export const totpRouter = router({
  // Gera secret + QR code para o admin escanear
  setupGenerate: adminProcedure.mutation(async ({ ctx }) => {
    const existing = await ctx.db.query.users.findFirst({
      where: (u, { eq: eqFn }) => eqFn(u.id, ctx.user.id),
      columns: { totpSecret: true },
    });

    if (existing?.totpSecret) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'TOTP já está ativo. Desative primeiro para reconfigurar.',
      });
    }

    const secret = generateSecret();
    const otpauth = generateURI({
      issuer: APP_NAME,
      label: ctx.user.email ?? ctx.user.id,
      secret,
    });
    const qrDataUrl = await QRCode.toDataURL(otpauth);

    // Salva secret cifrado (ainda não ativado)
    await ctx.db
      .update(users)
      .set({ totpSecret: encryptSecret(secret) })
      .where(eq(users.id, ctx.user.id));

    return { qrDataUrl };
  }),

  // Admin confirma leitura do QR digitando o primeiro código — ativa o TOTP
  setupActivate: adminProcedure.input(codeSchema).mutation(async ({ ctx, input }) => {
    const user = await ctx.db.query.users.findFirst({
      where: (u, { eq: eqFn }) => eqFn(u.id, ctx.user.id),
      columns: { totpSecret: true },
    });

    if (!user?.totpSecret) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Gere o QR code primeiro.',
      });
    }

    const plainSecret = decryptSecret(user.totpSecret);
    const result = verifySync({ token: input.code, secret: plainSecret });

    if (!result.valid) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Código inválido. Tente novamente.',
      });
    }

    // Marca apenas a sessão atual como TOTP verificada
    await ctx.db
      .update(sessions)
      .set({ totpVerified: true })
      .where(
        ctx.sessionToken
          ? eq(sessions.sessionToken, ctx.sessionToken)
          : eq(sessions.userId, ctx.user.id),
      );

    return { activated: true };
  }),

  // Verifica código TOTP no fluxo de login (step-up)
  verify: protectedProcedure.input(codeSchema).mutation(async ({ ctx, input }) => {
    const rl = checkRateLimit(`totp:verify:${ctx.user.id}`, 5, 15 * 60 * 1000);
    if (!rl.allowed) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: 'Muitas tentativas. Aguarde 15 minutos.',
      });
    }

    const user = await ctx.db.query.users.findFirst({
      where: (u, { eq: eqFn }) => eqFn(u.id, ctx.user.id),
      columns: { totpSecret: true },
    });

    if (!user?.totpSecret) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'TOTP não configurado.',
      });
    }

    const plainSecret = decryptSecret(user.totpSecret);
    const result = verifySync({ token: input.code, secret: plainSecret });

    if (!result.valid) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Código inválido.',
      });
    }

    // Marca apenas a sessão atual como TOTP verificada
    await ctx.db
      .update(sessions)
      .set({ totpVerified: true })
      .where(
        ctx.sessionToken
          ? eq(sessions.sessionToken, ctx.sessionToken)
          : eq(sessions.userId, ctx.user.id),
      );

    return { verified: true };
  }),

  // Desativa TOTP — exige código válido para confirmar
  disable: adminProcedure.input(codeSchema).mutation(async ({ ctx, input }) => {
    const user = await ctx.db.query.users.findFirst({
      where: (u, { eq: eqFn }) => eqFn(u.id, ctx.user.id),
      columns: { totpSecret: true },
    });

    if (!user?.totpSecret) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'TOTP não está ativo.',
      });
    }

    const plainSecret = decryptSecret(user.totpSecret);
    const result = verifySync({ token: input.code, secret: plainSecret });

    if (!result.valid) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Código inválido. TOTP não desativado.',
      });
    }

    await ctx.db.update(users).set({ totpSecret: null }).where(eq(users.id, ctx.user.id));

    return { disabled: true };
  }),

  // Retorna se o usuário atual tem TOTP ativo
  status: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.query.users.findFirst({
      where: (u, { eq: eqFn }) => eqFn(u.id, ctx.user.id),
      columns: { totpSecret: true },
    });
    return { enabled: !!user?.totpSecret };
  }),
});
