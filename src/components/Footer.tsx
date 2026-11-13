import { Link } from 'react-router';
import { ArrowUpRight, Instagram, Mail, MapPin } from 'lucide-react';

export function Footer() {
  return <footer className="footer">
    <div className="footer-main">
      <div className="footer-brand"><img src="/images/logo-cercle.png" alt="BIELUMINA" /><p>Plus qu’un produit,<br /><em>une lumière dans votre quotidien.</em></p></div>
      <div><h3>Découvrir</h3><Link to="/boutique">La boutique</Link><Link to="/boutique?nouveau=1">Nouveautés</Link><Link to="/boutique?promo=1">Offres privilèges</Link><Link to="/favoris">Mes favoris</Link></div>
      <div><h3>Vous accompagner</h3><Link to="/contact">Nous contacter</Link><Link to="/suivi-commande">Suivre une commande</Link><Link to="/faq">Questions fréquentes</Link><Link to="/livraison-retours">Livraison & retours</Link></div>
      <div><h3>Service client</h3><p><MapPin size={16} /> Port-au-Prince, Haïti</p><a href="mailto:service@bielumina.com"><Mail size={16} /> service@bielumina.com</a><a href="https://www.instagram.com/" target="_blank" rel="noreferrer"><Instagram size={16} /> Instagram <ArrowUpRight size={14} /></a></div>
    </div>
    <div className="footer-bottom"><span>© 2026 BIELUMINA. Tous droits réservés.</span><div><Link to="/confidentialite">Confidentialité</Link><Link to="/conditions">Conditions générales</Link></div></div>
  </footer>;
}
