# Patch CheckoutPage.tsx
1. Schéma zod : ajouter
   `whatsapp_consent: z.boolean().default(false),`
   `payment_method: z.string().min(1, 'Choisissez un mode de paiement.'),`
   et defaultValues : `whatsapp_consent: false, payment_method: 'on_delivery'`.
2. Charger les moyens de paiement actifs :
   `const [methods, setMethods] = useState<PaymentMethod[]>([]);`
   `useEffect(() => { supabase.from('store_settings').select('value').eq('key','payments').single().then(({data}) => setMethods(((data?.value as any)?.methods || []).filter((m: PaymentMethod) => m.active))); }, []);`
3. Section 3 « Paiement » : boutons radio `payment_method` affichant label + instructions (voir payment-option CSS).
4. Case à cocher whatsapp_consent (format international +509…), non cochée par défaut.
5. Appel RPC create_order : ajouter `p_whatsapp_consent: data.whatsapp_consent, p_payment_method: data.payment_method,` (nouveaux paramètres à défauts — l'ancienne signature reste valide).
