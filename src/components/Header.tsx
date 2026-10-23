import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import { Heart, Menu, Search, ShoppingBag, UserRound, X } from 'lucide-react';
import { useStore } from '@/lib/store';

const links = [
  { to: '/', label: 'Accueil' }, { to: '/boutique', label: 'Boutique' },
  { to: '/a-propos', label: 'Notre univers' }, { to: '/contact', label: 'Contact' },
];

export function Header() {
  const { cartCount, favorites, currency, setCurrency } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMenuOpen(false); setSearchOpen(false); } };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    navigate(`/boutique?q=${encodeURIComponent(query.trim())}`); setSearchOpen(false); setQuery('');
  };

  return <>
    <div className="announcement">Livraison partout en Haïti <span>•</span> Commandez en HTG ou USD <span>•</span> Aucun paiement en ligne</div>
    <header className="site-header">
      <Link to="/" className="brand" aria-label="BIELUMINA — Accueil">
        <img src="/images/logo-cercle.png" alt="" />
        <span><strong>BIELUMINA</strong><small>ÉLÉGANCE · QUALITÉ · VOUS</small></span>
      </Link>
      <nav className="desktop-nav" aria-label="Navigation principale">
        {links.map(link => <NavLink key={link.to} to={link.to} end={link.to === '/'}>{link.label}</NavLink>)}
      </nav>
      <div className="header-actions">
        <label className="currency-select"><span className="sr-only">Devise</span>
          <select value={currency} onChange={e => setCurrency(e.target.value as 'HTG' | 'USD')}><option>HTG</option><option>USD</option></select>
        </label>
        <button className="icon-button" onClick={() => setSearchOpen(true)} aria-label="Rechercher"><Search /></button>
        <Link className="icon-button desktop-action" to="/favoris" aria-label={`Favoris, ${favorites.length} articles`}><Heart /><span className="action-count">{favorites.length || ''}</span></Link>
        <Link className="icon-button desktop-action" to="/admin" aria-label="Espace administration"><UserRound /></Link>
        <Link className="icon-button" to="/panier" aria-label={`Panier, ${cartCount} articles`}><ShoppingBag /><span className="action-count">{cartCount || ''}</span></Link>
        <button className="icon-button mobile-menu-button" onClick={() => setMenuOpen(true)} aria-label="Ouvrir le menu"><Menu /></button>
      </div>
    </header>
    {menuOpen && <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) setMenuOpen(false); }}>
      <aside className="mobile-drawer" role="dialog" aria-modal="true" aria-label="Menu">
        <button className="icon-button drawer-close" onClick={() => setMenuOpen(false)} aria-label="Fermer"><X /></button>
        <img className="drawer-logo" src="/images/logo-cercle.png" alt="BIELUMINA" />
        <nav>{links.map(link => <NavLink key={link.to} to={link.to} onClick={() => setMenuOpen(false)}>{link.label}</NavLink>)}
          <NavLink to="/favoris" onClick={() => setMenuOpen(false)}>Favoris ({favorites.length})</NavLink>
          <NavLink to="/suivi-commande" onClick={() => setMenuOpen(false)}>Suivre ma commande</NavLink>
          <NavLink to="/admin" onClick={() => setMenuOpen(false)}>Administration</NavLink>
        </nav>
      </aside>
    </div>}
    {searchOpen && <div className="search-overlay" role="dialog" aria-modal="true" aria-label="Recherche">
      <button className="icon-button search-close" onClick={() => setSearchOpen(false)} aria-label="Fermer la recherche"><X /></button>
      <form onSubmit={submitSearch}><span>QUE RECHERCHEZ-VOUS ?</span><div><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Un produit, une catégorie…" aria-label="Votre recherche" /><button type="submit" aria-label="Lancer la recherche"><Search /></button></div></form>
    </div>}
  </>;
}
