# Guide WhatsApp Business (Meta Cloud API)

## 1. Prérequis compte Meta
- App Meta for Developers + produit WhatsApp activé.
- Compte WhatsApp Business (WABA) et numéro professionnel validé.
- Récupérer : Access Token (temporaire 24 h, puis token système permanent),
  Phone Number ID, WhatsApp Business Account ID.

## 2. Variables (secrets Supabase — jamais dans le frontend)
WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_BUSINESS_ACCOUNT_ID,
WHATSAPP_VERIFY_TOKEN (chaine aléatoire générée par vous), WHATSAPP_APP_SECRET
(App Secret de l'app Meta), WHATSAPP_API_VERSION (v23.0), WHATSAPP_TEMPLATE_NAME,
CRON_SECRET. Pour l’e-mail transactionnel, configurer aussi `RESEND_API_KEY` et
`EMAIL_FROM` (domaine expéditeur vérifié dans Resend). L’adresse privée de l’équipe
est configurée dans `/admin` → Paramètres ; elle n’est pas publique.

Déployer le dispatcher après application des migrations :

```powershell
supabase functions deploy order-notifications --no-verify-jwt
```

Le dispatcher accepte la confirmation invitée uniquement avec le code d’accès
retourné pour la commande, et vérifie les permissions des appels administrateur.
`--no-verify-jwt` est donc requis pour le checkout invité ; ne pas retirer les
contrôles d’accès intégrés à la fonction.

## 3. Modèles de messages (Meta → WhatsApp Manager → Modèles)
Créer un modèle par transition : order_pending_confirmation, order_confirmed,
order_processing, order_ready_for_delivery, order_shipped, order_delivered,
order_cancelled, payment_pending, payment_proof_received, payment_verification,
payment_paid, payment_rejected, payment_refunded.
Corps (ex. commande confirmée) :
« Bonjour {{1}} ! Merci d'avoir choisi BIELUMINA. Votre commande {{2}} est enregistrée. Montant : {{3}}. Statut : {{4}}. »
Ordre des variables = buildTemplateParams() dans src/lib/whatsapp.ts :
1 customer_name, 2 order_number, 3 total, 4 status, 5 subtotal, 6 shipping_fee,
7 delivery_address, 8 payment_method, 9 payment_status.
Les modèles doivent être APPROUVÉS avant tout envoi réel.

## 4. Webhook
Meta → Configuration → Webhook : URL
https://<ref>.supabase.co/functions/v1/whatsapp-webhook, verify token =
WHATSAPP_VERIFY_TOKEN, abonner le champ « messages ».
La signature X-Hub-Signature-256 est vérifiée avec WHATSAPP_APP_SECRET ; toute
requête non signée est rejetée (403).

## 5. Traitement de la file
Le checkout lance les notifications immédiates après l’enregistrement de la
commande. Un cron externe doit appeler chaque minute le dispatcher pour les
changements de statut et les nouvelles tentatives :

```bash
curl -X POST "https://<ref>.supabase.co/functions/v1/order-notifications" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: $CRON_SECRET" \
  -d '{"action":"dispatch_due"}'
```

La file applique une reprise plafonnée à cinq tentatives et une clé
`notifications.idempotency_key` par destinataire/canal/transition. Désactiver
tout ancien cron `whatsapp-notifications` afin qu’un seul worker traite la file.

## 6. Messages entrants
Journalisés dans whatsapp_inbound (lecture staff, RLS). Un message entrant ne
confirme JAMAIS un paiement : la confirmation reste manuelle via
admin_update_payment_status (permission payment.write).
