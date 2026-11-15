import { describe, expect, it } from 'vitest';
import { isValidPaymentTxnId } from './payment-proof';

describe('payment transaction IDs', () => {
  it('accepts exactly 12 numeric digits for MonCash, including leading zeroes', () => {
    expect(isValidPaymentTxnId('moncash', '003597765384')).toBe(true);
    expect(isValidPaymentTxnId('moncash', '00359776538')).toBe(false);
    expect(isValidPaymentTxnId('moncash', '0035977653840')).toBe(false);
  });

  it('accepts exactly 14 numeric digits for NatCash', () => {
    expect(isValidPaymentTxnId('natcom', '12345678901234')).toBe(true);
    expect(isValidPaymentTxnId('natcom', '1234567890123')).toBe(false);
    expect(isValidPaymentTxnId('natcom', '123456789012345')).toBe(false);
    expect(isValidPaymentTxnId('natcom', '1234567890123a')).toBe(false);
  });
});
