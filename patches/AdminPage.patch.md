# Patch AdminPage.tsx
1. `type Tab = 'dashboard' | 'orders' | 'products' | 'payments' | 'notifications';`
2. Charger `notifications` (select('*').order('created_at',{ascending:false})) et compteurs WhatsApp réels (en file / envoyés / échoués) pour le tableau de bord.
3. Onglet « Paiements » : commandes filtrables par payment_status ; actions via `supabase.rpc('admin_update_payment_status', { p_order_id, p_status, p_reference })` (visible si has_permission('payment.write')) ; historique `payment_status_history`.
4. Onglet « Notifications » : table (canal, destinataire, statut, tentatives, provider_message_id, error_code) ; bouton Relancer (`admin_retry_notification`) ; bouton « Tester le flux WhatsApp » = `supabase.functions.invoke('whatsapp-send', { body: { action: 'test' } })` avec mention « simulation si identifiants Meta absents ».
5. Onglet « Catalogue » : par produit, bloc dépliable `<ProductImagesManager product={p} onChanged={loadProducts} />`.
