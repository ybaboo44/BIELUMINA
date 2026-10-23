import { useMemo, useState } from 'react';
import { ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { useCatalog } from '@/hooks/useCatalog';
import { ProductCard } from '@/components/ProductCard';
import { useStore } from '@/lib/store';
import { priceFor } from '@/lib/types';

export function ShopPage() {
  const { products, categories, loading, error, refresh } = useCatalog();
  const { currency } = useStore();
  const [params, setParams] = useSearchParams();
  const [sort, setSort] = useState('selection');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const query = params.get('q') || '';
  const category = params.get('categorie') || '';
  const promo = params.get('promo') === '1';
  const nouveau = params.get('nouveau') === '1';

  const filtered = useMemo(() => {
    let list = products.filter(product => {
      const matchesQuery = !query || `${product.name} ${product.description} ${product.sku}`.toLowerCase().includes(query.toLowerCase());
      const matchesCategory = !category || categories.find(c => c.id === product.category_id)?.slug === category;
      const matchesPromo = !promo || (currency === 'HTG' ? product.promo_htg !== null : product.promo_usd !== null);
      return matchesQuery && matchesCategory && matchesPromo && (!nouveau || product.is_new);
    });
    if (sort === 'price-asc') list = [...list].sort((a,b) => Number(priceFor(a,currency) || 0) - Number(priceFor(b,currency) || 0));
    if (sort === 'price-desc') list = [...list].sort((a,b) => Number(priceFor(b,currency) || 0) - Number(priceFor(a,currency) || 0));
    if (sort === 'new') list = [...list].sort((a,b) => Number(b.is_new) - Number(a.is_new));
    return list;
  }, [products, categories, query, category, promo, nouveau, sort, currency]);

  const update = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next); };
  const clear = () => setParams({});
  const title = query ? `Résultats pour « ${query} »` : promo ? 'Offres privilèges' : nouveau ? 'Les nouveautés' : category ? categories.find(c => c.slug === category)?.name || 'Boutique' : 'La boutique';

  return <main className="shop-page section-shell">
    <div className="page-intro"><span className="eyebrow">BIELUMINA / COLLECTION</span><h1>{title}</h1><p>Des produits sélectionnés pour leur qualité, leur caractère et leur place dans votre quotidien.</p></div>
    <div className="shop-toolbar"><span>{filtered.length} produit{filtered.length !== 1 ? 's' : ''}</span><button className="filter-mobile" onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={17} /> Filtres</button><label>Trier par <select value={sort} onChange={e => setSort(e.target.value)}><option value="selection">Notre sélection</option><option value="new">Nouveautés</option><option value="price-asc">Prix croissant</option><option value="price-desc">Prix décroissant</option></select><ChevronDown size={15} /></label></div>
    <div className="shop-layout">
      <aside className={`filters ${filtersOpen ? 'open' : ''}`}><div className="filter-title"><strong>Filtrer</strong><button onClick={() => setFiltersOpen(false)} aria-label="Fermer les filtres"><X /></button></div>
        <div className="filter-group"><h3>Recherche</h3><label className="filter-search"><Search size={16} /><input value={query} onChange={e => update('q', e.target.value)} placeholder="Nom, référence…" /></label></div>
        <div className="filter-group"><h3>Catégories</h3><label><input type="radio" name="category" checked={!category} onChange={() => update('categorie','')} /> Toute la collection <span>{products.length}</span></label>{categories.map(c => <label key={c.id}><input type="radio" name="category" checked={category === c.slug} onChange={() => update('categorie',c.slug)} /> {c.name}<span>{products.filter(p => p.category_id === c.id).length}</span></label>)}</div>
        <div className="filter-group"><h3>À découvrir</h3><label><input type="checkbox" checked={nouveau} onChange={e => update('nouveau', e.target.checked ? '1' : '')} /> Nouveautés</label><label><input type="checkbox" checked={promo} onChange={e => update('promo', e.target.checked ? '1' : '')} /> Offres privilèges</label></div>
        {(query || category || promo || nouveau) && <button className="text-link" onClick={clear}>Effacer tous les filtres</button>}
      </aside>
      <section aria-live="polite">{loading ? <div className="product-grid shop-grid">{[1,2,3,4,5,6].map(i => <div className="product-skeleton" key={i} />)}</div> : error ? <div className="error-state">{error}<button className="text-link" onClick={refresh}>Réessayer</button></div> : filtered.length ? <div className="product-grid shop-grid">{filtered.map(product => <ProductCard key={product.id} product={product} />)}</div> : <div className="empty-state"><Search /><h2>Aucun produit trouvé</h2><p>Essayez une autre recherche ou explorez l’ensemble de notre collection.</p><button className="button button-dark" onClick={clear}>Voir toute la collection</button></div>}</section>
    </div>
  </main>;
}
