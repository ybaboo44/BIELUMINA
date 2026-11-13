export type Currency = 'HTG' | 'USD';

export type Variant = {
  id: string;
  sku: string;
  name: string;
  stock_qty: number;
  reserved_qty: number;
  options: Record<string, unknown>;
};

export type ProductImage = {
  id: string;
  product_id: string;
  storage_path: string;
  alt_text: string;
  is_primary: boolean;
  position: number;
  created_at: string;
};

export type Product = {
  id: string;
  category_id: string | null;
  slug: string;
  sku: string;
  name: string;
  description: string;
  image_path: string;
  price_htg: number | null;
  price_usd: number | null;
  promo_htg: number | null;
  promo_usd: number | null;
  published: boolean;
  archived: boolean;
  featured: boolean;
  is_new: boolean;
  low_stock_threshold: number;
  product_variants: Variant[];
  product_images?: ProductImage[];
};

export type Category = {
  id: string;
  slug: string;
  name: string;
  description: string;
  image_path: string;
  position: number;
};

export type ShippingZone = {
  id: string;
  name: string;
  fee_htg: number;
  fee_usd: number;
};

export type CartLine = {
  product: Product;
  variant: Variant;
  quantity: number;
};

export type Order = {
  id: string;
  order_number: string;
  customer_name: string;
  phone: string;
  email: string | null;
  currency: Currency;
  subtotal: number;
  shipping_fee: number;
  total: number;
  status: string;
  payment_status: string;
  payment_method?: string;
  whatsapp_consent?: boolean;
  created_at: string;
  delivery_address: string;
  instructions: string;
};

export type StoreNotification = {
  id: string;
  order_id: string | null;
  channel: 'email' | 'whatsapp';
  recipient: string;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';
  attempts: number;
  template_name: string | null;
  provider_message_id: string | null;
  error_code: string | null;
  sent_at: string | null;
  last_attempt_at: string | null;
  created_at: string;
};

export type PaymentMethod = {
  id: string;
  label: string;
  instructions: string;
  active: boolean;
};

export const money = (value: number | null | undefined, currency: Currency) => {
  if (value === null || value === undefined) return 'Prix à confirmer';
  const formatted = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));
  return currency === 'HTG' ? `${formatted} HTG` : `${formatted} USD`;
};

export const imageUrl = (storagePath: string | null | undefined) => {
  if (!storagePath) return '/images/logo-cercle.png';
  if (storagePath.startsWith('/')) return storagePath; // assets statiques hérités (/images/*)
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  return `${base}/storage/v1/object/public/product-images/${storagePath}`;
};

export const primaryImage = (product: Product): string => {
  const primary = (product.product_images || []).find(i => i.is_primary)
    || (product.product_images || []).slice().sort((a, b) => a.position - b.position)[0];
  return imageUrl(primary?.storage_path ?? product.image_path);
};

export const priceFor = (product: Product, currency: Currency) => {
  if (currency === 'HTG') return product.promo_htg ?? product.price_htg;
  return product.promo_usd ?? product.price_usd;
};

export const basePriceFor = (product: Product, currency: Currency) =>
  currency === 'HTG' ? product.price_htg : product.price_usd;

export const orderStatusLabels: Record<string, string> = {
  pending_confirmation: 'En attente de confirmation', confirmed: 'Confirmée',
  processing: 'En préparation', ready_for_delivery: 'Prête pour livraison',
  shipped: 'Expédiée', delivered: 'Livrée', cancelled: 'Annulée',
};

export const paymentStatusLabels: Record<string, string> = {
  unpaid: 'Non payé', pending: 'En attente', proof_received: 'Preuve de paiement reçue',
  verification: 'En cours de vérification', paid: 'Payé confirmé',
  rejected: 'Paiement refusé', failed: 'Paiement échoué', refunded: 'Remboursé',
};

export const paymentMethodLabels: Record<string, string> = {
  on_delivery: 'Paiement à la livraison',
  manual_transfer: 'Virement / mobile money (validation manuelle)',
};
