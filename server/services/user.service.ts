import 'server-only';
import { TRPCError } from '@trpc/server';
import { and, eq, isNull } from 'drizzle-orm';
import type { DB } from '@/db/client';
import { accounts, locations, sessions, users, verificationTokens } from '@/db/schema';

export interface CreateDriverParams {
  name: string;
  email: string;
  truckId?: string;
  createdBy: string;
}

export interface DeleteDriverParams {
  userId: string;
}

export class UserService {
  constructor(private db: DB) {}

  async createDriver(params: CreateDriverParams) {
    const existing = await this.db.query.users.findFirst({
      where: (u, { eq: eqFn }) => eqFn(u.email, params.email),
      columns: { id: true },
    });

    if (existing) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: `Já existe um usuário com o e-mail "${params.email}".`,
      });
    }

    if (params.truckId) {
      const truck = await this.db.query.locations.findFirst({
        where: (l, { and: andFn, eq: eqFn }) =>
          andFn(eqFn(l.id, params.truckId!), eqFn(l.type, 'truck'), eqFn(l.active, true)),
        columns: { id: true, assignedUserId: true },
      });

      if (!truck) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Caminhão não encontrado ou inativo.',
        });
      }

      if (truck.assignedUserId) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Este caminhão já está atribuído a outro motorista.',
        });
      }
    }

    return await this.db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          name: params.name,
          email: params.email,
          role: 'driver',
          active: true,
        })
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
        });

      if (!user) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      if (params.truckId) {
        await tx
          .update(locations)
          .set({ assignedUserId: user.id, updatedAt: new Date() })
          .where(
            and(
              eq(locations.id, params.truckId),
              isNull(locations.assignedUserId),
            ),
          );
      }

      return user;
    });
  }

  async deleteDriver(params: DeleteDriverParams) {
    const user = await this.db.query.users.findFirst({
      where: (u, { eq: eqFn }) => eqFn(u.id, params.userId),
      columns: { id: true, role: true, email: true, active: true },
    });

    if (!user) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuário não encontrado.' });
    }

    if (user.role !== 'driver') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Só é possível excluir motoristas por esta operação.',
      });
    }

    await this.db.transaction(async (tx) => {
      // Desatribuir caminhão se existir
      await tx
        .update(locations)
        .set({ assignedUserId: null, updatedAt: new Date() })
        .where(eq(locations.assignedUserId, params.userId));

      // Remover sessões activas
      await tx.delete(sessions).where(eq(sessions.userId, params.userId));

      // Remover contas OAuth/magic-link
      await tx.delete(accounts).where(eq(accounts.userId, params.userId));

      // Remover tokens de verificação pendentes
      if (user.email) {
        await tx
          .delete(verificationTokens)
          .where(eq(verificationTokens.identifier, user.email));
      }

      // Soft-delete do usuário para preservar integridade referencial
      // (stock_movements.created_by, transfers, audit_log referem este user)
      await tx
        .update(users)
        .set({ active: false, updatedAt: new Date() })
        .where(eq(users.id, params.userId));
    });

    return { deleted: true };
  }
}
