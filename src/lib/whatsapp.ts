// Service WhatsApp côté client : construction des paramètres de modèles
// et prévisualisation. AUCUN secret ici — l'envoi est exclusivement traité
// par la file `notifications` + la Supabase Edge Function whatsapp-send.

export type WhatsappPayload = {
  order_number?: string;
  customer_name?: string;
  total?: number | string;
  currency?: string;
  status?: string;
  subtotal?: number | string;
  shipping_fee?: number | string;
  delivery_address?: string;
  payment_method?: string;
  payment_status?: string;
};

export type TemplateParam = { type: 'text'; text: string };

const formatAmount = (value: number | string | undefined, currency?: string) => {
  if (value === undefined || value === null || value === '') return '';
  const amount = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(amount)) return String(value);
  const formatted = amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u202F|\u00A0/g, ' ');
  return currency ? `${formatted} ${currency}` : formatted;
};

// Ordre des variables — doit correspondre EXACTEMENT au modèle approuvé Meta :
// 1 customer_name, 2 order_number, 3 total, 4 status, 5 subtotal,
// 6 shipping_fee, 7 delivery_address, 8 payment_method, 9 payment_status
export function buildTemplateParams(payload: WhatsappPayload): TemplateParam[] {
  return [
    payload.customer_name ?? '',
    payload.order_number ?? '',
    formatAmount(payload.total, payload.currency),
    payload.status ?? '',
    formatAmount(payload.subtotal, payload.currency),
    formatAmount(payload.shipping_fee, payload.currency),
    payload.delivery_address ?? '',
    payload.payment_method ?? '',
    payload.payment_status ?? '',
  ].map(text => ({ type: 'text' as const, text }));
}

// Prévisualisation en clair pour l'admin (le rendu réel dépend du modèle Meta).
export function renderMessagePreview(template: string, payload: WhatsappPayload): string {
  const params = buildTemplateParams(payload).map(p => p.text);
  const [customer, order, total, status, , , address, method, payment] = params;
  if (template.startsWith('payment_')) {
    return `Bonjour ${customer},

Nous avons mis à jour le paiement de votre commande ${order}.
Montant : ${total}
Statut du paiement : ${payment}
Mode : ${method}

Merci d'avoir choisi BIELUMINA !`;
  }
  if (template === 'order_cancelled') {
    return `Bonjour ${customer},

Votre commande ${order} a été annulée.

Merci de votre compréhension.`;
  }
  return `Bonjour ${customer} !

Merci d'avoir choisi BIELUMINA.
Votre commande ${order} a bien été enregistrée.

Montant total : ${total}
Adresse : ${address}

Statut : ${status}

BIELUMINA`;
}
