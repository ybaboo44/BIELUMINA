# Mise en production BIELUMINA

## Pré-requis

- Un projet Supabase de production dont la base et les migrations ont été vérifiées.
- L’URL du projet Supabase et sa clé `publishable` (publique).
- Un compte Vercel autorisé à créer ou mettre à jour le projet relié au dépôt GitHub.
- Node.js et npm pour les vérifications locales.

Ne jamais publier `service_role`, un mot de passe de base de données, un jeton Meta ou un autre secret dans le dépôt, dans une variable `VITE_*` ou dans le navigateur.

## Vérifier et préparer Supabase

1. Vérifier l’état de la base et des migrations. Appliquer `202610240001` à `202610240009` dans l’ordre avec Supabase CLI après liaison au bon projet. La migration `007` corrige la signature de `create_order`; `008` ajoute les destinataires privés et la file de notification e-mail/WhatsApp; `009` ajoute la preuve de dépôt MonCash/Natcom. Ne pas réinitialiser la base de production.
2. Créer le premier compte administrateur dans Authentication, puis attribuer son rôle selon la procédure du README. Activer la MFA.
3. Configurer les URL de redirection Auth après avoir obtenu le domaine Vercel.
4. Dans Supabase Dashboard → Edge Functions → Secrets, configurer :
   - `RESEND_API_KEY` et `EMAIL_FROM` (adresse d’expédition vérifiée chez Resend).
   - `CRON_SECRET` (valeur aléatoire longue, pour le traitement planifié de la file).
   - Pour WhatsApp : `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_API_VERSION` et les modèles Meta approuvés.
5. Après application des migrations, ouvrir `/admin` → Paramètres et configurer l’e-mail privé de l’équipe (et éventuellement son WhatsApp privé). Activer le canal e-mail. Pour envoyer au client par e-mail, celui-ci doit renseigner son adresse au checkout ; pour WhatsApp, il doit cocher le consentement.
6. Déployer les fonctions avec Supabase CLI après liaison au bon projet :

   ```powershell
   supabase login
   supabase link --project-ref <reference-du-projet>
   supabase functions deploy order-notifications --no-verify-jwt
   supabase functions deploy whatsapp-webhook
   ```

   `order-notifications` valide le code privé de suivi du client pour sa demande de confirmation et les permissions Supabase pour les actions admin. `--no-verify-jwt` est nécessaire pour laisser passer la demande de commande invitée ; l’autorisation est contrôlée dans la fonction. Ne pas exposer de clé service-role. Les étapes Meta sont documentées dans [docs/WHATSAPP_SETUP.md](./docs/WHATSAPP_SETUP.md).
7. Configurer un cron externe pour appeler chaque minute `POST https://<ref>.supabase.co/functions/v1/order-notifications` avec l’en-tête `x-cron-secret: <CRON_SECRET>` et le JSON `{"action":"dispatch_due"}`. Désactiver tout ancien cron appelant `whatsapp-notifications` pour éviter deux workers sur la même file.

## Déployer sur Vercel

1. Importer `https://github.com/ybaboo44/BIELUMINA` dans Vercel et choisir la branche `main`.
2. Utiliser les paramètres Vite : commande de build `npm run build`, répertoire de sortie `dist`, commande d’installation `npm install`.
3. Dans Project Settings → Environment Variables, ajouter pour Production (et Preview si souhaité) :
   - `VITE_SUPABASE_URL` : URL HTTPS du projet Supabase.
   - `VITE_SUPABASE_PUBLISHABLE_KEY` : clé publique `publishable` de ce même projet.
4. Déployer, puis noter le domaine HTTPS généré.
5. Dans Supabase → Authentication → URL Configuration, définir l’URL du site en production et autoriser les URL de redirection requises.
6. Vérifier la boutique, l’authentification `/admin`, la création et le suivi d’une commande test, et l’arrivée des notifications chez le client et l’équipe. Ne pas utiliser de données ou de paiements réels pour ce test.

Le client échoue volontairement avec une erreur explicite si les variables Supabase sont absentes ; ne pas promouvoir un déploiement sans ces deux variables.

## Vérifications avant ouverture publique

- `npm test`, `npm run lint` et `npm run build` passent.
- Les données, tarifs, zones de livraison et coordonnées du vendeur ont été vérifiés.
- Aucun secret n’est suivi par Git (`.env` doit rester local et ignoré).
- Le rôle administrateur est attribué au bon compte et la MFA est activée.
- Les politiques RLS et les migrations ont été validées sur le projet cible.
- Les en-têtes et le routage SPA sont définis dans [vercel.json](./vercel.json).
- Les sauvegardes Supabase sont activées ; le processus de restauration est connu.
