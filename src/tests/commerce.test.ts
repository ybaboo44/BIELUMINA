import { describe, expect, it } from 'vitest';
import { canTransition, nextStatuses, convertPrice, orderTotal } from '@/lib/commerce';

describe('Transitions de commande', () => {
  it('autorise uniquement les transitions valides', () => {
    expect(canTransition('pending_confirmation', 'confirmed')).toBe(true);
    expect(canTransition('pending_confirmation', 'delivered')).toBe(false);
    expect(canTransition('shipped', 'delivered')).toBe(true);
    expect(nextStatuses('delivered')).toEqual([]);
    expect(nextStatuses('cancelled')).toEqual([]);
  });
});

describe('Montants', () => {
  it('calcule le total sans total négatif', () => {
    expect(orderTotal(1000, 150)).toBe(1150);
    expect(() => orderTotal(100, -150)).toThrow();
  });
  it('convertit HTG <-> USD', () => {
    expect(convertPrice(13500, 'HTG', 135)).toBe(100);
    expect(convertPrice(100, 'USD', 135)).toBe(13500);
  });
  it('rejette montants et taux invalides', () => {
    expect(() => convertPrice(-1, 'HTG', 135)).toThrow();
    expect(() => convertPrice(100, 'USD', 0)).toThrow();
  });
});
