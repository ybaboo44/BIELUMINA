# Notes de sécurité

- `.env` commité dans les deux dépôts → purger l'historique (filter-repo/BFG),
  rotation de la clé si la moindre clé non-publishable y figurait.
- Secrets Meta et service_role UNIQUEMENT en secrets Supabase Edge Functions.
- RLS activé sur product_images, whatsapp_inbound ; RPC security definer à
  search_path fixe, autorisations via has_permission côté serveur.
- Anti-doublons : unique partiel idempotency_key (notifications),
  product_images_one_primary, create_order existant (idempotency + relecture
  des prix serveur).
- Paiement confirmé uniquement par gestionnaire autorisé ; jamais via le
  navigateur ou un message entrant.
- Bucket product-images : public, 5 Mo, JPEG/PNG/WebP, écriture products.write.
- Consentement WhatsApp requis (orders.whatsapp_consent) ; désactivable global
  via store_settings key 'notifications' whatsapp_enabled=false.
