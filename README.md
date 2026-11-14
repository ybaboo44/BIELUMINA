# BIELUMINA — boutique e-commerce

Boutique premium en français, HTG/USD, sans collecte de paiement en ligne. Le socle livré utilise React, TypeScript, Vite et Supabase (PostgreSQL, Auth, RLS). Les migrations sont dans `supabase/migrations/`.

## Fonctionnement

- Accueil, catalogue, recherche, filtres, tri, fiches produits et favoris.
- Panier et choix HTG/USD. Le panier et les favoris sont locaux au navigateur ; le catalogue et les commandes sont dans Supabase.
- Commande invitée avec preuve MonCash/Natcom via `create_order_with_payment_proof`, qui s’appuie sur `create_order` pour valider la commande, relire les prix, verrouiller le stock et enregistrer les lignes de façon transactionnelle.
- Suivi via `track_order` avec numéro + code d’accès. Le numéro seul ne donne aucun accès.
- Back-office `/admin` avec Supabase Auth et rôles, vue d’ensemble des ventes payées, commandes, paiements et stocks, plus les modules produits, prix, livraison, clients, notifications, équipe et paramètres.
- Aucun formulaire ni appel de paiement en ligne.

## Démarrage

```bash
npm install
Copy-Item .env.example .env
# Renseigner l’URL et la clé publiable Supabase
npm run dev
npm run test
npm run build
```

Ne jamais placer de clé `service_role`, de secret e-mail ou de secret WhatsApp dans une variable `VITE_*`.

## Base Supabase

Le dépôt contient les migrations du projet BIELUMINA. Avant de déployer, vérifier dans le projet Supabase cible l’état des migrations et des données initiales ; ne pas réinitialiser une base existante ni supposer que les migrations ont été appliquées. Voir [DEPLOY.md](./DEPLOY.md) pour la procédure de mise en production.

Tables principales : produits, variantes, catégories, mouvements de stock, zones de livraison, commandes, lignes, historiques, notifications, rôles/permissions, invitations et audit. RLS est activé sur toutes les tables. Les opérations sensibles utilisent des fonctions serveur avec `search_path` fixé.

## Création du premier super-administrateur

Aucun mot de passe par défaut et aucune route publique de création ne sont fournis.

1. Dans Supabase Dashboard → Authentication → Users, créer manuellement l’utilisateur principal avec un mot de passe unique et confirmé.
2. Relever son UUID.
3. Dans SQL Editor, exécuter en remplaçant l’UUID :

```sql
insert into public.user_roles (user_id, role)
values ('UUID-DE-L-UTILISATEUR', 'super_admin');
```

4. Se connecter sur `/admin`. Activer ensuite la MFA dans Supabase Auth pour les comptes privilégiés.
5. Pour un employé, créer/inviter son utilisateur dans Authentication puis attribuer uniquement le rôle nécessaire (`manager`, `catalog_manager`, `order_manager`, `inventory_manager` ou `viewer`). Pour suspendre un compte, passer `profiles.active` à `false`.

## Notifications

- La migration `202610240008_order_notification_delivery.sql` met en file les confirmations et les changements de statut pour le client et l’équipe.
- Pour recevoir un e-mail, configurez l’adresse privée de l’équipe dans `/admin` → Paramètres, fournissez une adresse e-mail au checkout, puis ajoutez les secrets serveur `RESEND_API_KEY` et `EMAIL_FROM`.
- Pour WhatsApp, le client doit donner son accord au checkout ; l’équipe peut configurer un numéro privé dans `/admin` → Paramètres. Les identifiants Meta et les modèles approuvés restent requis.
- Déployez `order-notifications` et planifiez son appel pour traiter les reprises. Les erreurs fournisseur sont visibles dans l’administration ; aucun succès n’est affiché avant confirmation du fournisseur.
- Les secrets d’e-mail et Meta ne vont jamais dans le navigateur ou dans une variable `VITE_*`. Suivre [DEPLOY.md](./DEPLOY.md) et [docs/WHATSAPP_SETUP.md](./docs/WHATSAPP_SETUP.md).

## Déploiement Vercel

Suivre [DEPLOY.md](./DEPLOY.md) pour importer le dépôt, configurer `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY`, déployer et autoriser le domaine Vercel dans Supabase Auth. Le déploiement nécessite ces variables ; aucune configuration de production n’est incluse dans le dépôt.

## Sauvegarde et restauration

- Activer les sauvegardes Supabase/PITR selon l’offre du projet.
- Exporter régulièrement les migrations et tester une restauration dans un projet isolé.
- Ne jamais tester une restauration sur la base de production.
- Conserver une procédure écrite : arrêt des écritures, restauration, vérification des totaux/stocks, tests d’authentification et reprise.

## Checklist préproduction

- [ ] Premier super-admin créé manuellement, MFA activée, aucun compte partagé.
- [ ] Coordonnées vendeur, zones et frais vérifiés.
- [ ] Prix HTG et USD validés produit par produit ; aucune conversion implicite.
- [ ] Tests de stock simultané, annulation et remise en stock effectués sur environnement isolé.
- [ ] Notifications configurées et preuves fournisseur vérifiées ; reprises testées.
- [ ] Domaine HTTPS, redirections Auth et en-têtes validés.
- [ ] Sauvegarde/restauration testée.
- [ ] Audit des dépendances traité avant ouverture publique.

## Limites explicites du socle

L’import/export CSV complet, les invitations depuis l’UI, les rapports graphiques avancés et la suite E2E complète restent à réaliser avant de qualifier la plateforme de production complète. Le worker de notification est inclus, mais il n’enverra rien tant que les fonctions, fournisseurs, secrets et destinataires ne sont pas configurés en production.


---

## Projet intégré — dashboard + WhatsApp Business API + images multiples

- `/admin` : dashboard d'administration complet intégré (9 modules : vue d'ensemble, produits avec photos multiples, commandes, tarifs/taux, livraison, clients, notifications WhatsApp, équipe et rôles, paramètres). Authentification Supabase, permissions RLS.
- Page d'accueil : carrousels produits (sélection, nouveautés) ; fiche produit : galerie multi-photos avec miniatures.
- Checkout : preuve de dépôt MonCash/Natcom (Txn ID et numéro du déposant) + consentement WhatsApp explicite. Le paiement reste en attente de vérification manuelle par l’équipe.
- Migrations : `001`–`003` (BIELUMINA) puis `00400`–`00600` (dashboard), `202610240007` (rôle payment_manager, statuts de vérification, WhatsApp entrant et extension de `create_order`), `202610240008` (file de notifications e-mail/WhatsApp et destinataire privé de l’équipe) et `202610240009` (preuve de dépôt MonCash/Natcom, Txn ID et téléphone du déposant).
- Edge Functions : `order-notifications` (envoi Resend/Meta via file, contrôle d’accès, anti-doublon et reprise) et `whatsapp-webhook` (vérification HMAC-SHA256, statuts de livraison, journalisation des messages entrants — jamais de confirmation automatique de paiement).
- Sans identifiants Meta ou Resend : aucun message réel n'est envoyé ; l’échec est enregistré dans la file et visible depuis `/admin`.

### Lancement
```bash
cp .env.example .env   # renseigner VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY
npm install
npm run test && npm run lint && npm run build && npm run dev
```
### Base de données et WhatsApp
Appliquer d’abord les migrations en ordre avec `supabase link` puis `supabase db push`. Déployer ensuite `supabase functions deploy order-notifications --no-verify-jwt` et `supabase functions deploy whatsapp-webhook`.
— voir **DEPLOY.md** et **docs/WHATSAPP_SETUP.md** (création app Meta, modèles à approuver, webhook, cron).
