import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CartLine, Currency, Product, Variant } from './types';
import { priceFor } from './types';

type StoreContextType = {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  cart: CartLine[];
  cartCount: number;
  subtotal: number;
  favorites: string[];
  addToCart: (product: Product, variant: Variant, quantity?: number) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  removeFromCart: (variantId: string) => void;
  clearCart: () => void;
  toggleFavorite: (productId: string) => void;
};

const StoreContext = createContext<StoreContextType | null>(null);
const read = <T,>(key: string, fallback: T): T => {
  try { return JSON.parse(localStorage.getItem(key) || '') as T; } catch { return fallback; }
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<Currency>(() => read('bl-currency', 'HTG'));
  const [cart, setCart] = useState<CartLine[]>(() => read('bl-cart', []));
  const [favorites, setFavorites] = useState<string[]>(() => read('bl-favorites', []));

  useEffect(() => { localStorage.setItem('bl-currency', JSON.stringify(currency)); }, [currency]);
  useEffect(() => { localStorage.setItem('bl-cart', JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem('bl-favorites', JSON.stringify(favorites)); }, [favorites]);

  const addToCart = (product: Product, variant: Variant, quantity = 1) => {
    setCart(current => {
      const existing = current.find(line => line.variant.id === variant.id);
      if (existing) return current.map(line => line.variant.id === variant.id
        ? { ...line, quantity: Math.min(line.quantity + quantity, variant.stock_qty) } : line);
      return [...current, { product, variant, quantity }];
    });
  };

  const value = useMemo<StoreContextType>(() => ({
    currency, setCurrency, cart, favorites,
    cartCount: cart.reduce((sum, line) => sum + line.quantity, 0),
    subtotal: cart.reduce((sum, line) => sum + Number(priceFor(line.product, currency) || 0) * line.quantity, 0),
    addToCart,
    updateQuantity: (variantId, quantity) => setCart(current => current.map(line => line.variant.id === variantId
      ? { ...line, quantity: Math.max(1, Math.min(quantity, line.variant.stock_qty)) } : line)),
    removeFromCart: variantId => setCart(current => current.filter(line => line.variant.id !== variantId)),
    clearCart: () => setCart([]),
    toggleFavorite: productId => setFavorites(current => current.includes(productId)
      ? current.filter(id => id !== productId) : [...current, productId]),
  }), [currency, cart, favorites]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore doit être utilisé dans StoreProvider');
  return value;
}
