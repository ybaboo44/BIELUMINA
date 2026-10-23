# BIELUMINA — boutique e-commerce

Boutique premium en français, HTG/USD, sans collecte de paiement en ligne. Le socle livré utilise React, TypeScript, Vite et Supabase (PostgreSQL, Auth, RLS). Les migrations sont dans `supabase/migrations/`.

## Fonctionnement

- Accueil, catalogue, recherche, filtres, tri, fiches produits et favoris.
- Panier et choix HTG/USD. Le panier et les favoris sont locaux au navigateur ; le catalogue et les commandes sont dans Supabase.
- Commande invitée via la fonction PostgreSQL `create_order` : validation, relecture des prix, verrouillage du stock, transaction, instantanés des lignes, idempotence, numéro non séquentiel et jeton de suivi haché.
- Suivi via `track_order` avec numéro + code d’accès. Le numéro seul ne donne aucun accès.
- Back-office `/admin` avec Supabase Auth, contrôle des rôles, indicateurs, commandes, transitions de statut serveur, publication et stock.
- Aucun formulaire ni appel de paiement en ligne.

## Démarrage

```bash
npm install
cp .env.example .env
# Renseigner l’URL et la clé publiable Supabase
npm run dev
npm run test
npm run build
```

Ne jamais placer de clé `service_role`, de secret e-mail ou de secret WhatsApp dans une variable `VITE_*`.

## Base Supabase

Le projet configuré dans cette version s’appelle **BIELUMINA**. Les migrations ont déjà été appliquées et le catalogue initial est présent. Pour reconstruire un autre environnement, appliquer les migrations dans leur ordre chronologique avec Supabase CLI ou l’outil SQL du tableau de bord.

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

L’état livré ne prétend aucun envoi automatique : les identifiants fournisseurs ne sont pas configurés.

- La file `notifications` et les tentatives sont prêtes.
- Le canal e-mail est désactivé par défaut. Configurer l’adresse vendeur dans `store_settings`, puis un fournisseur transactionnel et un worker Supabase Edge Function avec reprise exponentielle.
- WhatsApp doit rester en mode manuel jusqu’à la configuration de l’API WhatsApp Business et de ses modèles approuvés. Ne jamais marquer un message comme envoyé à la simple ouverture de `wa.me`.

## Déploiement Vercel

1. Importer le dépôt dans Vercel (framework Vite, build `npm run build`, sortie `dist`).
2. Ajouter `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` dans les variables d’environnement.
3. `vercel.json` contient la réécriture SPA et des en-têtes de sécurité de base.
4. Ajouter le domaine final dans Supabase Auth → URL configuration.
5. Vérifier les politiques CORS/CSP du fournisseur de notifications avant activation.

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

L’import/export CSV, l’édition complète des fiches avec images multiples, les invitations depuis l’UI, les workers d’envoi, les rapports graphiques avancés et la suite E2E complète restent à réaliser avant de qualifier la plateforme de production complète. Les fonctions présentes dans l’interface sont connectées ; aucune intégration externe non configurée n’est simulée.
