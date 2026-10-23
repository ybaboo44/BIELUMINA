import { useEffect } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router';
import { Toaster } from 'sonner';
import { StoreProvider } from '@/lib/store';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { HomePage } from '@/pages/HomePage';
import { ShopPage } from '@/pages/ShopPage';
import { ProductPage } from '@/pages/ProductPage';
import { CartPage } from '@/pages/CartPage';
import { CheckoutPage } from '@/pages/CheckoutPage';
import { ConfirmationPage, TrackOrderPage } from '@/pages/OrderPages';
import { AboutPage, ContactPage, FAQPage, FavoritesPage, LegalPage } from '@/pages/ContentPages';
import { AdminPage } from '@/pages/AdminPage';

function AppContent(){
  const location=useLocation(); const isAdmin=location.pathname.startsWith('/admin');
  useEffect(()=>{window.scrollTo(0,0)},[location.pathname]);
  return <>{!isAdmin&&<Header/>}<Routes><Route path="/" element={<HomePage/>}/><Route path="/boutique" element={<ShopPage/>}/><Route path="/produit/:slug" element={<ProductPage/>}/><Route path="/favoris" element={<FavoritesPage/>}/><Route path="/panier" element={<CartPage/>}/><Route path="/commander" element={<CheckoutPage/>}/><Route path="/confirmation" element={<ConfirmationPage/>}/><Route path="/suivi-commande" element={<TrackOrderPage/>}/><Route path="/a-propos" element={<AboutPage/>}/><Route path="/contact" element={<ContactPage/>}/><Route path="/faq" element={<FAQPage/>}/><Route path="/conditions" element={<LegalPage type="conditions"/>}/><Route path="/confidentialite" element={<LegalPage type="confidentialite"/>}/><Route path="/livraison-retours" element={<LegalPage type="livraison"/>}/><Route path="/admin" element={<AdminPage/>}/><Route path="*" element={<main className="empty-state page-empty"><span className="eyebrow">404</span><h1>Cette page s’est éclipsée.</h1><p>Revenez à la boutique pour poursuivre votre découverte.</p><Link className="button button-dark" to="/">Retour à l’accueil</Link></main>}/></Routes>{!isAdmin&&<Footer/>}<Toaster position="bottom-center" richColors/></>;
}

export default function App(){return <StoreProvider><AppContent/></StoreProvider>}
