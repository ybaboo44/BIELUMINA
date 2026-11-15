export const paymentTxnIdLengths = {
  moncash: 12,
  natcom: 14,
} as const;

export type PaymentProvider = keyof typeof paymentTxnIdLengths;

export function isValidPaymentTxnId(provider: PaymentProvider, txnId: string): boolean {
  return /^\d+$/.test(txnId) && txnId.length === paymentTxnIdLengths[provider];
}
