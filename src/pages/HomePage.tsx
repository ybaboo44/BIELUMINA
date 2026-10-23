import { ArrowRight, ChevronRight, Headphones, PackageCheck, ShieldCheck, Truck } from 'lucide-react';
import { Link } from 'react-router';
import { useCatalog } from '@/hooks/useCatalog';
import { ProductCard } from '@/components/ProductCard';

export function HomePage() {
  const { products, categories, loading, error, refresh } = useCatalog();
  const featured = products.filter(p => p.featured).slice(0, 4);
  const newest = products.filter(p => p.is_new).slice(0, 4);
  return <main>
    <section className="hero">
      <div className="hero-copy"><span className="eyebrow">LA SÉLECTION BIELUMINA</span><h1>L’élégance<br />à portée<br /><em>de main.</em></h1><p>Des pièces choisies avec soin pour révéler votre style, embellir votre quotidien et vous accompagner durablement.</p><Link className="button button-gold" to="/boutique">Découvrir la boutique <ArrowRight size={18} /></Link><div className="hero-note"><span>Mode</span><span>Beauté</span><span>Maison</span><span>Tech</span></div></div>
      <div className="hero-visual"><img src="/images/bag.jpg" alt="Sac Élégance de la sélection BIELUMINA" /><div className="hero-caption"><span>01 — L’ICÔNE</span><strong>Le raffinement,<br />sans compromis.</strong><Link to="/produit/sac-elegance-noir">Découvrir <ChevronRight size={16} /></Link></div></div>
    </section>

    <section className="category-strip section-shell"><div className="section-heading compact"><div><span className="eyebrow">VOS ENVIES</span><h2>Un monde à explorer</h2></div><Link to="/boutique">Tout voir <ArrowRight size={17} /></Link></div>
      <div className="category-grid">{categories.map(category => <Link to={`/boutique?categorie=${category.slug}`} className="category-tile" key={category.id}><img src={category.image_path} alt="" loading="lazy" /><div><h3>{category.name}</h3><span>Explorer <ArrowRight size={15} /></span></div></Link>)}</div>
    </section>

    <section className="section-shell products-section"><div className="section-heading"><div><span className="eyebrow">NOS COUPS DE CŒUR</span><h2>La sélection du moment</h2></div><p>Une collection courte, des pièces singulières.<br />Parce que le beau n’a pas besoin d’en faire trop.</p></div>
      {loading ? <div className="product-grid">{[1,2,3,4].map(i => <div className="product-skeleton" key={i} />)}</div> : error ? <div className="error-state">{error}<button className="text-link" onClick={refresh}>Réessayer</button></div> : <div className="product-grid">{featured.map(product => <ProductCard key={product.id} product={product} />)}</div>}
    </section>

    <section className="campaign"><div className="campaign-image"><img src="/images/perfume.jpg" alt="Rituel de beauté lumineux" loading="lazy" /></div><div className="campaign-copy"><span className="eyebrow">RITUELS DE LUMIÈRE</span><h2>Votre beauté,<br /><em>votre signature.</em></h2><p>Des essentiels qui célèbrent ce qui vous rend unique. Offrez-vous un moment de soin, une attention, un éclat.</p><Link className="button button-light" to="/boutique?categorie=beaute">Explorer la beauté <ArrowRight size={18} /></Link></div></section>

    {newest.length > 0 && <section className="section-shell products-section"><div className="section-heading"><div><span className="eyebrow">JUSTE ARRIVÉS</span><h2>Les nouveautés</h2></div><Link to="/boutique?nouveau=1">Voir les nouveautés <ArrowRight size={17} /></Link></div><div className="product-grid">{newest.map(product => <ProductCard key={product.id} product={product} />)}</div></section>}

    <section className="service-band"><div><Truck /><h3>Livraison soignée</h3><p>Partout en Haïti, selon votre zone.</p></div><div><ShieldCheck /><h3>Commande sécurisée</h3><p>Vos informations restent protégées.</p></div><div><Headphones /><h3>Service attentif</h3><p>Une équipe à votre écoute.</p></div><div><PackageCheck /><h3>Choix vérifiés</h3><p>Disponibilité contrôlée à la commande.</p></div></section>

    <section className="manifesto section-shell"><span>B</span><div><p>« Plus qu’un produit, une lumière dans votre quotidien. »</p><Link to="/a-propos">Découvrir notre univers <ArrowRight size={17} /></Link></div></section>
  </main>;
}
