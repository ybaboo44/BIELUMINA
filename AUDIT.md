# Audit des deux dépôts

## BIELUMINA (principal — base conservée)
React 19.2 / TS 5.9 / Vite 7 / react-router 7 / Tailwind + shadcn/ui /
Supabase JS 2.109 / embla-carousel-react 8.6 (déjà présent) / recharts / vitest.
Migrations 202610240001/2/3 : catalogue, variantes, stock, commandes invitées
(create_order : relecture serveur des prix, idempotence, transaction, RLS,
rôles super_admin/manager/catalog_manager/order_manager/inventory_manager/viewer),
file notifications + attempts, historiques de statuts, audit.
Existant : boutique, panier, favoris, checkout, suivi de commande, /admin
(stats, commandes, publication, stock). Manquant : images multiples, carrousel,
paiements (unpaid/pending/paid), WhatsApp (file prête, aucun envoi).

## Dashboard (dépôt réel : ybaboo44/dasboardbielumina — l'URL « Dasboard » n'existe pas)
Même stack, mêmes composants shadcn (SHAs identiques) → intégration directe.
Réutilisé : migrations additives (product_images, bucket product-images,
consentement WhatsApp, colonnes notifications, RPC admin_update_payment_status /
admin_set_staff_role / admin_retry_notification), Edge Function whatsapp-notifications,
src/lib/commerce.ts. Non repris tel quel : App.tsx (monolithe 61 Ko autonome) —
ses vues sont portées en onglets de l'AdminPage de BIELUMINA.

## Risques
1. .env commité dans les deux dépôts (même SHA) → purge d'historique urgente.
2. Enums payment_status : migrations additives non réversibles (documenté).
3. Sans identifiants/app Meta : tout reste en simulation explicite.
