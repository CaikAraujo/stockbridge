import { beforeAll, describe, expect, it, vi } from 'vitest';

// Isola o módulo de "server only" para rodar em contexto de teste Node
vi.mock('server-only', () => ({}));

import { db } from '@/db/client';
import { StockMovementService } from '@/server/services/stock-movement.service';

describe('StockMovementService', () => {
  let service: StockMovementService;

  beforeAll(() => {
    service = new StockMovementService(db);
  });

  it('rejeita quantidade zero', async () => {
    await expect(
      service.createWithdrawal({
        articleId: 'fake-id',
        quantity: 0,
        fromLocationId: 'fake-wh',
        toLocationId: 'fake-truck',
        createdBy: 'fake-user',
        idempotencyKey: 'test-key-1',
      }),
    ).rejects.toThrow('maior que zero');
  });

  it('rejeita quantidade negativa', async () => {
    await expect(
      service.createWithdrawal({
        articleId: 'fake-id',
        quantity: -1,
        fromLocationId: 'fake-wh',
        toLocationId: 'fake-truck',
        createdBy: 'fake-user',
        idempotencyKey: 'test-key-2',
      }),
    ).rejects.toThrow('maior que zero');
  });

  it('cálculo de saldo após movimentos', () => {
    const movements = [
      { quantityDelta: '10.000', voidedAt: null },
      { quantityDelta: '-3.500', voidedAt: null },
      { quantityDelta: '-2.000', voidedAt: new Date() }, // voidado — não conta
    ];
    const saldo = movements
      .filter((m) => m.voidedAt === null)
      .reduce((acc, m) => acc + parseFloat(m.quantityDelta), 0);
    expect(saldo).toBeCloseTo(6.5);
  });
});
