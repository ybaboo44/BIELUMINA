// Helpers métier partagés — reprise du dépôt dasboardbielumina (src/lib/commerce.ts),
// adaptés aux statuts réels du projet principal BIELUMINA.
import type { Currency } from './types';

export function convertPrice(amount: number, from: Currency, rate: number): number {
  if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(rate) || rate <= 0) throw new Error('Montant ou taux invalide');
  return Math.round((from === 'HTG' ? amount / rate : amount * rate) * 100) / 100;
}

export function orderTotal(subtotal: number, shipping: number, discount = 0): number {
  const total = subtotal + shipping - discount;
  if (total < 0) throw new Error('Le total ne peut pas être négatif');
  return Math.round(total * 100) / 100;
}

export type OrderStatus =
  | 'pending_confirmation' | 'confirmed' | 'processing'
  | 'ready_for_delivery' | 'shipped' | 'delivered' | 'cancelled';

export type PaymentStatus =
  | 'unpaid' | 'pending' | 'proof_received' | 'verification'
  | 'paid' | 'rejected' | 'failed' | 'refunded';

const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  pending_confirmation: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['ready_for_delivery', 'cancelled'],
  ready_for_delivery: ['shipped'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return (allowedTransitions[from] || []).includes(to);
}

export function nextStatuses(from: OrderStatus): OrderStatus[] {
  return allowedTransitions[from] || [];
}

export const paymentLabels: Record<PaymentStatus, string> = {
  unpaid: 'Non payé',
  pending: 'En attente',
  proof_received: 'Preuve reçue',
  verification: 'En vérification',
  paid: 'Payé',
  rejected: 'Refusé',
  failed: 'Échoué',
  refunded: 'Remboursé',
};

export function shortMoney(value: number): string {
  return new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function dateFr(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

export function slugify(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
