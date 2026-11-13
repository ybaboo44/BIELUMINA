# Mise en production BIELUMINA

## Pré-requis

- Un projet Supabase de production dont la base et les migrations ont été vérifiées.
- L’URL du projet Supabase et sa clé `publishable` (publique).
- Un compte Vercel autorisé à créer ou mettre à jour le projet relié au dépôt GitHub.
- Node.js et npm pour les vérifications locales.

Ne jamais publier `service_role`, un mot de passe de base de données, un jeton Meta ou un autre secret dans le dépôt, dans une variable `VITE_*` ou dans le navigateur.

## Vérifier et préparer Supabase

1. Dans Supabase Dashboard, confirmer que les migrations `202610240001` à `202610240007` sont appliquées et que le catalogue de production est prêt. Ne pas réinitialiser la base de production.
2. Créer le premier compte administrateur dans Authentication, puis attribuer son rôle selon la procédure du README. Activer la MFA.
3. Configurer les URL de redirection Auth après avoir obtenu le domaine Vercel.
4. Les fonctions WhatsApp sont facultatives pour le lancement de la boutique. Si elles sont activées, les déployer avec Supabase CLI après liaison au bon projet :

   ```powershell
   supabase login
   supabase link --project-ref <reference-du-projet>
   supabase functions deploy whatsapp-notifications
   supabase functions deploy whatsapp-webhook
   ```

   Configurer leurs secrets exclusivement dans Supabase (Dashboard ou `supabase secrets set`). Les noms et les étapes Meta sont documentés dans [docs/WHATSAPP_SETUP.md](./docs/WHATSAPP_SETUP.md). Sans configuration et modèles Meta approuvés, aucun message réel n’est envoyé.

## Déployer sur Vercel

1. Importer `https://github.com/ybaboo44/BIELUMINA` dans Vercel et choisir la branche `main`.
2. Utiliser les paramètres Vite : commande de build `npm run build`, répertoire de sortie `dist`, commande d’installation `npm install`.
3. Dans Project Settings → Environment Variables, ajouter pour Production (et Preview si souhaité) :
   - `VITE_SUPABASE_URL` : URL HTTPS du projet Supabase.
   - `VITE_SUPABASE_PUBLISHABLE_KEY` : clé publique `publishable` de ce même projet.
4. Déployer, puis noter le domaine HTTPS généré.
5. Dans Supabase → Authentication → URL Configuration, définir l’URL du site en production et autoriser les URL de redirection requises.
6. Vérifier la boutique, l’authentification `/admin`, la création et le suivi d’une commande test. Ne pas utiliser de données ou de paiements réels pour ce test.

Le client échoue volontairement avec une erreur explicite si les variables Supabase sont absentes ; ne pas promouvoir un déploiement sans ces deux variables.

## Vérifications avant ouverture publique

- `npm test`, `npm run lint` et `npm run build` passent.
- Les données, tarifs, zones de livraison et coordonnées du vendeur ont été vérifiés.
- Aucun secret n’est suivi par Git (`.env` doit rester local et ignoré).
- Le rôle administrateur est attribué au bon compte et la MFA est activée.
- Les politiques RLS et les migrations ont été validées sur le projet cible.
- Les en-têtes et le routage SPA sont définis dans [vercel.json](./vercel.json).
- Les sauvegardes Supabase sont activées ; le processus de restauration est connu.
