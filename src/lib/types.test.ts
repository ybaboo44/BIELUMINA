import { describe, expect, it } from 'vitest';
import { basePriceFor, money, priceFor, type Product } from './types';

const product = {
  price_htg: 2500, price_usd: 19, promo_htg: 2190, promo_usd: null,
} as Product;

describe('règles monétaires BIELUMINA', () => {
  it('affiche toujours le code devise de façon explicite', () => {
    expect(money(5050, 'HTG')).toBe('5 050,00 HTG');
    expect(money(36.5, 'USD')).toBe('36,50 USD');
  });
  it('n’invente pas un prix absent', () => {
    expect(money(null, 'USD')).toBe('Prix à confirmer');
  });
  it('applique la promotion devise par devise', () => {
    expect(priceFor(product, 'HTG')).toBe(2190);
    expect(priceFor(product, 'USD')).toBe(19);
    expect(basePriceFor(product, 'HTG')).toBe(2500);
  });
});
