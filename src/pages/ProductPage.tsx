import { useState } from 'react';
import { ArrowLeft, Check, Heart, Minus, Plus, ShieldCheck, ShoppingBag, Truck } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { useCatalog } from '@/hooks/useCatalog';
import { useStore } from '@/lib/store';
import { basePriceFor, money, priceFor } from '@/lib/types';
import { ProductCard } from '@/components/ProductCard';

export function ProductPage() {
  const { slug } = useParams();
  const { products, loading } = useCatalog();
  const { currency, addToCart, favorites, toggleFavorite } = useStore();
  const product = products.find(p => p.slug === slug);
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState(1);
  if (loading) return <main className="detail-loading"><div className="product-skeleton" /></main>;
  if (!product) return <main className="empty-state page-empty"><h1>Produit introuvable</h1><p>Cette pièce n’est plus disponible ou son adresse a changé.</p><Link className="button button-dark" to="/boutique">Retour à la boutique</Link></main>;
  const variant = product.product_variants.find(v => v.id === variantId) || product.product_variants[0];
  const price = priceFor(product, currency); const base = basePriceFor(product, currency);
  const stock = variant?.stock_qty || 0;
  const add = () => { if (!variant || !stock) return; addToCart(product, variant, quantity); toast.success('Votre sélection a été ajoutée au panier'); };
  const related = products.filter(p => p.category_id === product.category_id && p.id !== product.id).slice(0,4);
  return <main className="section-shell product-page">
    <Link className="back-link" to="/boutique"><ArrowLeft size={16} /> Retour à la collection</Link>
    <div className="product-detail"><div className="detail-image"><img src={product.image_path} alt={product.name} />{product.is_new && <span className="badge-new">Nouveau</span>}</div>
      <div className="detail-copy"><span className="eyebrow">{product.sku}</span><h1>{product.name}</h1><div className="detail-price"><strong>{money(price,currency)}</strong>{price !== null && base !== null && price < base && <del>{money(base,currency)}</del>}</div><p className="detail-description">{product.description}</p>
        {product.product_variants.length > 1 && <label className="field"><span>Version</span><select value={variant?.id} onChange={e => setVariantId(e.target.value)}>{product.product_variants.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>}
        <div className="stock-message">{stock > 0 ? <><Check size={17} /> En stock{stock <= 3 ? ` — plus que ${stock}` : ''}</> : 'Actuellement indisponible'}</div>
        <div className="purchase-row"><div className="quantity"><button onClick={() => setQuantity(Math.max(1,quantity-1))} disabled={quantity<=1} aria-label="Diminuer"><Minus /></button><span>{quantity}</span><button onClick={() => setQuantity(Math.min(stock,quantity+1))} disabled={quantity>=stock} aria-label="Augmenter"><Plus /></button></div><button className="button button-gold add-detail" onClick={add} disabled={!stock}><ShoppingBag size={18} /> Ajouter au panier</button><button className={`favorite-detail ${favorites.includes(product.id) ? 'active' : ''}`} onClick={() => toggleFavorite(product.id)} aria-label="Ajouter aux favoris"><Heart fill={favorites.includes(product.id) ? 'currentColor' : 'none'} /></button></div>
        <div className="purchase-benefits"><p><Truck /> Livraison calculée selon votre zone</p><p><ShieldCheck /> Commande confirmée par notre équipe avant règlement</p></div>
        <div className="detail-note"><strong>Commandez sereinement.</strong><p>Aucun paiement n’est demandé sur le site. Après votre commande, notre équipe vous contacte pour convenir de la livraison et du règlement.</p></div>
      </div>
    </div>
    {related.length > 0 && <section className="related"><div className="section-heading"><h2>Vous aimerez aussi</h2></div><div className="product-grid">{related.map(p => <ProductCard key={p.id} product={p} />)}</div></section>}
  </main>;
}
