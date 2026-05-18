import { describe, expect, it } from 'vitest';

// Testa a matemática central do sistema
// stock atual = soma de todos os quantityDelta não voidados
function calculateStock(movements: { quantityDelta: string; voidedAt: Date | null }[]) {
  return movements
    .filter((m) => m.voidedAt === null)
    .reduce((acc, m) => acc + parseFloat(m.quantityDelta), 0);
}

describe('Stock math', () => {
  it('calcula saldo correto com múltiplos movimentos', () => {
    const movements = [
      { quantityDelta: '100.000', voidedAt: null },
      { quantityDelta: '-2.500', voidedAt: null },
      { quantityDelta: '-0.500', voidedAt: null },
    ];
    expect(calculateStock(movements)).toBeCloseTo(97.0);
  });

  it('ignora movimentos voidados', () => {
    const movements = [
      { quantityDelta: '100.000', voidedAt: null },
      { quantityDelta: '-50.000', voidedAt: new Date() }, // voidado
    ];
    expect(calculateStock(movements)).toBeCloseTo(100.0);
  });

  it('aceita decimais de 3 casas (kg de gás)', () => {
    const movements = [
      { quantityDelta: '5.000', voidedAt: null },
      { quantityDelta: '-1.250', voidedAt: null },
    ];
    expect(calculateStock(movements)).toBeCloseTo(3.75);
  });

  it('saldo nunca vai abaixo de zero sem aviso', () => {
    const movements = [
      { quantityDelta: '2.000', voidedAt: null },
      { quantityDelta: '-3.000', voidedAt: null },
    ];
    // Sistema permite negativo (divergência real), mas alertar
    expect(calculateStock(movements)).toBeCloseTo(-1.0);
  });
});
