import { Heart, Plus } from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import type { Product } from '@/lib/types';
import { basePriceFor, money, priceFor } from '@/lib/types';
import { useStore } from '@/lib/store';

export function ProductCard({ product }: { product: Product }) {
  const { currency, addToCart, favorites, toggleFavorite } = useStore();
  const variant = product.product_variants[0];
  const price = priceFor(product, currency);
  const base = basePriceFor(product, currency);
  const promo = price !== null && base !== null && price < base;
  const stock = variant?.stock_qty ?? 0;
  const add = () => {
    if (!variant || stock < 1) return;
    addToCart(product, variant); toast.success(`${product.name} ajouté au panier`);
  };
  return <article className="product-card">
    <div className="product-image-wrap">
      <Link to={`/produit/${product.slug}`} aria-label={`Voir ${product.name}`}><img src={product.image_path} alt={product.name} loading="lazy" /></Link>
      <div className="product-badges">{product.is_new && <span className="badge-new">Nouveau</span>}{promo && <span className="badge-promo">Offre</span>}</div>
      <button className={`favorite-button ${favorites.includes(product.id) ? 'active' : ''}`} onClick={() => toggleFavorite(product.id)} aria-label={favorites.includes(product.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}><Heart fill={favorites.includes(product.id) ? 'currentColor' : 'none'} /></button>
      {stock > 0 && <button className="quick-add" onClick={add}><Plus size={17} /> Ajout rapide</button>}
    </div>
    <div className="product-info"><Link to={`/produit/${product.slug}`}><h3>{product.name}</h3></Link><p className="product-sku">{product.sku}</p>
      <div className="product-price"><strong>{money(price, currency)}</strong>{promo && <del>{money(base, currency)}</del>}</div>
      {stock === 0 ? <span className="stock-out">Indisponible</span> : stock <= 3 ? <span className="stock-low">Plus que {stock} en stock</span> : null}
    </div>
  </article>;
}
