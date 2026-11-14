import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import { Heart, Menu, Search, ShoppingBag, X } from 'lucide-react';
import { useStore } from '@/lib/store';

const links = [
  { to: '/', label: 'Accueil' },
  { to: '/boutique', label: 'Boutique' },
  { to: '/a-propos', label: 'Notre univers' },
  { to: '/contact', label: 'Contact' },
];

export function Header() {
  const { cartCount, favorites, currency, setCurrency } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const closeRef = useRef<HTMLButtonElement>(null);

  // Fermeture Échap (menu + recherche) — déjà en place
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMenuOpen(false); setSearchOpen(false); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Verrouillage du défilement de fond + focus au bouton « Fermer »
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => { document.body.style.overflow = previous; };
  }, [menuOpen]);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    navigate(`/boutique?q=${encodeURIComponent(query.trim())}`);
    setSearchOpen(false); setQuery('');
  };

  const closeMenu = () => setMenuOpen(false);

  return <>
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
        <Link className="icon-button" to="/panier" aria-label={`Panier, ${cartCount} articles`}><ShoppingBag /><span className="action-count">{cartCount || ''}</span></Link>
        <button className="icon-button mobile-menu-button" onClick={() => setMenuOpen(true)} aria-label="Ouvrir le menu" aria-expanded={menuOpen} aria-controls="mobile-menu"><Menu /></button>
      </div>
    </header>

    {menuOpen && (
      <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) closeMenu(); }}>
        <aside className="mobile-drawer" id="mobile-menu" role="dialog" aria-modal="true" aria-label="Menu de navigation">
          <div className="drawer-head">
            <img className="drawer-logo" src="/images/logo-cercle.png" alt="BIELUMINA" />
            <button ref={closeRef} className="icon-button drawer-close" onClick={closeMenu} aria-label="Fermer le menu"><X /></button>
          </div>
          <nav className="drawer-nav" aria-label="Navigation mobile">
            <p className="drawer-section">Navigation</p>
            {links.map(link => <NavLink key={link.to} to={link.to} end={link.to === '/'} onClick={closeMenu}>{link.label}</NavLink>)}
            <p className="drawer-section">Mon espace</p>
            <NavLink to="/favoris" onClick={closeMenu}>Favoris <span className="drawer-count">{favorites.length}</span></NavLink>
            <NavLink to="/suivi-commande" onClick={closeMenu}>Suivre ma commande</NavLink>
            <Link to="/panier" className="drawer-cart" onClick={closeMenu}>
              <ShoppingBag size={18} /> Mon panier <span className="drawer-count">{cartCount}</span>
            </Link>
          </nav>
          <p className="drawer-note">ÉLÉGANCE · QUALITÉ · VOUS</p>
        </aside>
      </div>
    )}

    {searchOpen && <div className="search-overlay" role="dialog" aria-modal="true" aria-label="Recherche">
      <button className="icon-button search-close" onClick={() => setSearchOpen(false)} aria-label="Fermer la recherche"><X /></button>
      <form onSubmit={submitSearch}><span>QUE RECHERCHEZ-VOUS ?</span><div><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Un produit, une catégorie…" aria-label="Votre recherche" /><button type="submit" aria-label="Lancer la recherche"><Search /></button></div></form>
    </div>}
  </>;
}
