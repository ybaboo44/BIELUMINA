# Changelog — Audit, corrections et finalisation

## Problèmes identifiés → causes réelles → corrections

### 1. Bouton « Administration » visible côté public
- Cause : liens `/admin` dans `Header.tsx` (icône compte desktop + entrée tiroir mobile).
- Correction : les deux liens sont supprimés des interfaces publiques. Le dashboard reste sur `/admin/*` avec sa propre authentification Supabase et ses permissions RLS (masquer le bouton n'est pas la mesure de sécurité — les policies le sont).

### 2. Images qui ne s'affichaient pas
- Cause racine n°1 : `public/images/bag.jpg` référencé dans `src/index.css`, `HomePage.tsx`, `ContentPages.tsx`, le seed SQL et le fallback `imageUrl()` — **fichier absent du projet** (HTTP 404).
- Cause racine n°2 : `ProductCard`, `CartPage`, `CheckoutPage` affichaient `product.image_path` brut, ignorant les `product_images` (photos multiples) et les chemins Supabase Storage.
- Correction : fallback vers `/images/logo-cercle.png` (existant), références `bag.jpg` remplacées par des fichiers présents (`perfume.jpg`), seed SQL corrigé, `primaryImage()`/`imageUrl()` utilisés partout, galerie déjà en place sur la fiche produit.

### 3. Processus de commande
- Était déjà solide côté serveur (`create_order` : relecture des prix, stocks, transaction, idempotence, frais de zone).
- Ajouts : choix du mode de paiement (radio, instructions configurables en admin), consentement WhatsApp explicite, enregistrement des deux champs via `create_order` étendu (rétrocompatible), **page de confirmation enrichie** : articles, quantités, sous-total, livraison, total, mode de paiement, statut du paiement, code d'accès au suivi sécurisé.

### 4. Menu mobile
- Réécrit : structure à sections (Navigation / Mon espace), verrouillage du défilement de fond, focus initial sur « Fermer », `aria-expanded`/`aria-controls`, cibles tactiles ≥ 44 px, fermeture par Échap/clic extérieur/sélection (déjà présente), compteur panier réel dans le tiroir, aucun chevauchement, transitions sobres (respect de `prefers-reduced-motion` déjà en place).

### 5. Administration
- Le dashboard intégré possède déjà une navigation logique à 9 rubriques (Vue d'ensemble, Produits, Commandes, Prix et devises, Livraison et zones, Clients, Notifications, Équipe et accès, Paramètres) filtrées par permissions ; statistiques issues de requêtes réelles ; vérifié, pas reconstruit. L'ancien `AdminPage.tsx` obsolète a été retiré (aucune référence restante).

## Vérifications effectuées (statiques, sans environnement d'exécution réseau)
- Tous les imports alias `@/` résolvent vers des fichiers existants.
- Aucune référence publique à `/admin` hors de la déclaration de route.
- Aucun `bag.jpg` restant (code, CSS, seed SQL).
- Migration 007 : politiques en drop-then-create, grant `create_order` conforme à la vraie signature, `product_images` étendue par `ALTER` (non destructive).

## À exécuter localement (npm requis, non exécutable ici)
`npm install && npm run test && npm run lint && npm run build` — puis `supabase db push` et déploiement des fonctions (voir DEPLOY.md).
