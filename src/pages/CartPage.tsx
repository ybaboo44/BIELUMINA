import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { useStore } from '@/lib/store';
import { money, priceFor } from '@/lib/types';

export function CartPage() {
  const { cart, currency, subtotal, updateQuantity, removeFromCart } = useStore();
  if (!cart.length) return <main className="empty-state page-empty"><ShoppingBag /><span className="eyebrow">VOTRE SÉLECTION</span><h1>Votre panier est vide</h1><p>Laissez-vous inspirer par notre collection et trouvez vos prochains coups de cœur.</p><Link className="button button-gold" to="/boutique">Découvrir la boutique <ArrowRight size={18} /></Link></main>;
  return <main className="section-shell cart-page"><div className="page-intro"><span className="eyebrow">VOTRE SÉLECTION</span><h1>Votre panier</h1><p>{cart.length} article{cart.length > 1 ? 's' : ''} · Montants en {currency}</p></div>
    <div className="cart-layout"><div className="cart-lines">{cart.map(({product,variant,quantity}) => <article className="cart-line" key={variant.id}><Link to={`/produit/${product.slug}`}><img src={product.image_path} alt={product.name} /></Link><div className="cart-line-copy"><Link to={`/produit/${product.slug}`}><h2>{product.name}</h2></Link><p>{variant.name} · {variant.sku}</p><strong>{money(priceFor(product,currency),currency)}</strong><div className="cart-line-actions"><div className="quantity"><button onClick={() => updateQuantity(variant.id,quantity-1)} disabled={quantity<=1} aria-label="Diminuer"><Minus /></button><span>{quantity}</span><button onClick={() => updateQuantity(variant.id,quantity+1)} disabled={quantity>=variant.stock_qty} aria-label="Augmenter"><Plus /></button></div><button className="remove-line" onClick={() => removeFromCart(variant.id)}><Trash2 size={16} /> Retirer</button></div></div><strong className="line-total">{money(Number(priceFor(product,currency)||0)*quantity,currency)}</strong></article>)}</div>
      <aside className="order-summary"><h2>Récapitulatif</h2><div><span>Sous-total</span><strong>{money(subtotal,currency)}</strong></div><div><span>Livraison</span><span>Calculée à l’étape suivante</span></div><div className="summary-total"><span>Total provisoire</span><strong>{money(subtotal,currency)}</strong></div><Link className="button button-gold" to="/commander">Finaliser ma commande <ArrowRight size={18} /></Link><p>Aucun paiement ne sera demandé en ligne. Notre équipe confirmera votre commande avant règlement.</p></aside>
    </div>
  </main>;
}
