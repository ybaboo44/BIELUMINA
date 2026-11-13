# Procédure d'application

```bash
# 1. URGENT — purger le .env commité (les deux dépôts)
git rm --cached .env && echo ".env" >> .gitignore
git commit -m "chore: stop tracking .env"
git filter-repo --path .env --invert-paths   # puis force-push coordonné

# 2. Branche
git clone https://github.com/ybaboo44/BIELUMINA.git && cd BIELUMINA
git checkout -b feature/dashboard-whatsapp-integration

# 3. Copier le kit
cp -r <dossier_du_kit>/. .

# 4. Base de données
supabase link --project-ref VOTRE_REF && supabase db push   # migration 202610240004

# 5. Fonctions + secrets serveur
supabase functions deploy whatsapp-send
supabase functions deploy whatsapp-webhook
supabase secrets set WHATSAPP_ACCESS_TOKEN=... WHATSAPP_PHONE_NUMBER_ID=...   WHATSAPP_BUSINESS_ACCOUNT_ID=... WHATSAPP_VERIFY_TOKEN=...   WHATSAPP_APP_SECRET=... WHATSAPP_API_VERSION=v23.0   WHATSAPP_TEMPLATE_NAME=... CRON_SECRET=...

# 6. Locale
npm install && cp .env.example .env
npm run test && npm run lint && npm run build

# 7. Publication (aucun push sur main sans autorisation)
git add -A && git commit -m "feat: dashboard intégré, WhatsApp Cloud API, images multiples, carrousel"
git push -u origin feature/dashboard-whatsapp-integration
```

Activer WhatsApp en production (humain requis) : création app Meta / numéro
validé → modèles `order_*` et `payment_*` approuvés (9 variables, ordre dans
src/lib/whatsapp.ts) → callback `https://<ref>.supabase.co/functions/v1/whatsapp-webhook`
avec WHATSAPP_VERIFY_TOKEN + abonnement « messages » → cron pg_cron toutes les
minutes : POST whatsapp-send action=process-due avec x-cron-secret.
Sans ces étapes : mode simulation, aucun message réel.
