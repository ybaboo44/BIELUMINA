export type Currency = 'HTG' | 'USD';

export type Variant = {
  id: string;
  sku: string;
  name: string;
  stock_qty: number;
  reserved_qty: number;
  options: Record<string, string>;
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
  created_at: string;
  delivery_address: string;
  instructions: string;
};

export const money = (value: number | null | undefined, currency: Currency) => {
  if (value === null || value === undefined) return 'Prix à confirmer';
  const formatted = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));
  return currency === 'HTG' ? `${formatted} HTG` : `${formatted} USD`;
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
