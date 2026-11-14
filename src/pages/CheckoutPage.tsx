import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, LockKeyhole } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import { useShippingZones } from '@/hooks/useCatalog';
import { money, priceFor, primaryImage } from '@/lib/types';

type FormData = {
  name: string;
  phone: string;
  email: string;
  zone: string;
  address: string;
  instructions?: string;
  consent: boolean;
  payment_provider: '' | 'moncash' | 'natcom';
  payment_txn_id: string;
  payment_depositor_phone: string;
  whatsapp_consent: boolean;
};

const schema = z.object({
  name: z.string().trim().min(2,'Indiquez votre nom complet.'),
  phone: z.string().trim().min(7,'Indiquez un numéro de téléphone valide.'),
  email: z.string().trim().email('Adresse e-mail invalide.').or(z.literal('')),
  zone: z.string().uuid('Choisissez une zone de livraison.'),
  address: z.string().trim().min(5,'Précisez votre adresse ou le point de retrait.'),
  instructions: z.string().max(1000,'1000 caractères maximum.').optional(),
  consent: z.boolean().refine(Boolean,'Votre accord est nécessaire pour enregistrer la commande.'),
  payment_provider: z.enum(['moncash','natcom'], { error: 'Choisissez MonCash ou Natcom.' }),
  payment_txn_id: z.string().trim().regex(/^\d{12}$/, 'Le Txn ID doit contenir exactement 12 chiffres.'),
  payment_depositor_phone: z.string().trim().regex(/^\+?[0-9][0-9 ()-]{6,19}$/, 'Indiquez le numéro utilisé pour effectuer le dépôt.'),
  whatsapp_consent: z.boolean().default(false),
}).superRefine((data, context) => {
  if (!data.email && !data.whatsapp_consent) {
    context.addIssue({ code: 'custom', path: ['whatsapp_consent'], message: 'Indiquez un e-mail ou acceptez la confirmation par WhatsApp.' });
  }
});

const resolver: Resolver<FormData> = zodResolver(schema) as Resolver<FormData>;

export function CheckoutPage() {
  const { cart, currency, subtotal, clearCart } = useStore();
  const { zones, loading: zonesLoading, error: zonesError, refresh: refreshZones } = useShippingZones();
  const navigate = useNavigate();
  const idempotencyKey = useRef<string | null>(null);
  const [serverError,setServerError] = useState('');
  const { register, handleSubmit, control, formState: { errors,isSubmitting } } = useForm<FormData>({ resolver, defaultValues: { name:'',phone:'',email:'',zone:'',address:'',instructions:'',consent:false,payment_provider:'',payment_txn_id:'',payment_depositor_phone:'',whatsapp_consent:false } });
  const zoneId = useWatch({ control, name: 'zone' });
  const shipping = useMemo(() => { const zone = zones.find(zone => zone.id===zoneId); return zone ? Number(currency==='HTG'?zone.fee_htg:zone.fee_usd) : 0; }, [zones,zoneId,currency]);

  const submit = async (data: FormData) => {
    setServerError('');
    if (zonesLoading || zonesError || !zones.some(zone => zone.id === data.zone)) {
      setServerError('Choisissez une zone de livraison disponible avant de confirmer la commande.');
      return;
    }
    idempotencyKey.current ??= crypto.randomUUID();
    const { data: result, error } = await supabase.rpc('create_order_with_payment_proof', {
      p_customer_name:data.name,p_phone:data.phone,p_email:data.email||null,p_delivery_zone_id:data.zone,
      p_delivery_address:data.address,p_instructions:data.instructions||'',p_currency:currency,
      p_items:cart.map(line=>({variant_id:line.variant.id,quantity:line.quantity})),p_idempotency_key:idempotencyKey.current,
      p_payment_provider:data.payment_provider,p_payment_txn_id:data.payment_txn_id,p_payment_depositor_phone:data.payment_depositor_phone,
      p_whatsapp_consent:data.whatsapp_consent,
    });
    if (error) {
      const code=error.message||'';
      setServerError(code.includes('INSUFFICIENT_STOCK')?'Un article n’est plus disponible dans la quantité demandée. Actualisez votre panier.':code.includes('PRODUCT_UNAVAILABLE')?'Un article n’est plus disponible. Retirez-le du panier pour continuer.':code.includes('INVALID_SHIPPING_ZONE')?'Cette zone de livraison n’est plus disponible. Choisissez-en une autre.':code.includes('DUPLICATE_ORDER_KEY')?'Cette tentative de commande a déjà été traitée. Vérifiez votre e-mail ou contactez notre équipe avant de recommencer.':code.includes('DUPLICATE_PAYMENT_TXN_ID')?'Ce Txn ID a déjà été utilisé. Vérifiez la référence du dépôt.':'La commande n’a pas pu être enregistrée. Vérifiez vos informations et réessayez.');
      return;
    }
    if (!result || typeof result !== 'object' || !('order_number' in result) || !('access_token' in result)) {
      setServerError('Le serveur n’a pas renvoyé la confirmation attendue. Contactez notre équipe avant de recommencer.');
      return;
    }
    const confirmation: Record<string, unknown> = { ...(result as Record<string, unknown>) };
    let notificationNotice = '';
    const { data: delivery, error: deliveryError } = await supabase.functions.invoke('order-notifications', {
      body: { action: 'dispatch_order', order_number: confirmation.order_number, access_token: confirmation.access_token },
    });
    if (deliveryError) {
      notificationNotice = 'Votre commande est enregistrée, mais le service de notification ne répond pas. Notre équipe doit vérifier la configuration des e-mails et de WhatsApp.';
    } else if (!delivery || delivery.processed === 0) {
      notificationNotice = 'Votre commande est enregistrée, mais aucun canal de notification actif n’a été trouvé. Notre équipe doit vérifier les paramètres de contact.';
    } else if (delivery.ok !== true) {
      notificationNotice = 'Votre commande est enregistrée, mais une ou plusieurs notifications n’ont pas pu être envoyées. Notre équipe peut les relancer depuis l’administration.';
    }
    confirmation.notification_notice = notificationNotice;
    sessionStorage.setItem('bl-last-order', JSON.stringify(confirmation)); clearCart(); navigate('/confirmation', { state: confirmation });
  };

  if (!cart.length) return <main className="empty-state page-empty"><h1>Votre panier est vide</h1><Link className="button button-dark" to="/boutique">Retour à la boutique</Link></main>;
  return <main className="section-shell checkout-page"><Link className="back-link" to="/panier"><ArrowLeft size={16}/> Retour au panier</Link><div className="page-intro"><span className="eyebrow">FINALISER VOTRE COMMANDE</span><h1>Vos coordonnées</h1><p>Notre équipe vous contactera pour confirmer la disponibilité, la livraison et le règlement.</p></div>
    <form className="checkout-layout" onSubmit={handleSubmit(submit)}><div className="checkout-form">
      <section><h2><span>1</span> Informations client</h2><div className="form-grid"><label className="field full"><span>Nom complet *</span><input {...register('name')} autoComplete="name" placeholder="Votre nom et prénom" />{errors.name&&<small className="field-error">{errors.name.message}</small>}</label><label className="field"><span>Téléphone *</span><input {...register('phone')} autoComplete="tel" placeholder="+509 …" />{errors.phone&&<small className="field-error">{errors.phone.message}</small>}</label><label className="field"><span>E-mail (ou confirmation WhatsApp)</span><input {...register('email')} type="email" autoComplete="email" placeholder="vous@exemple.com" />{errors.email&&<small className="field-error">{errors.email.message}</small>}</label></div></section>
      <section><h2><span>2</span> Livraison</h2><div className="form-grid"><label className="field full"><span>Zone de livraison *</span><select {...register('zone')} disabled={zonesLoading||Boolean(zonesError)||zones.length===0}><option value="">{zonesLoading?'Chargement des zones…':'Sélectionnez votre zone'}</option>{zones.map(zone=><option value={zone.id} key={zone.id}>{zone.name} — {money(currency==='HTG'?zone.fee_htg:zone.fee_usd,currency)}</option>)}</select>{errors.zone&&<small className="field-error">{errors.zone.message}</small>}</label>{zonesError&&<div className="field full form-error" role="alert">Impossible de charger les zones de livraison. {zonesError}<button className="button button-outline" type="button" onClick={() => void refreshZones()}>Réessayer</button></div>}{!zonesLoading&&!zonesError&&zones.length===0&&<p className="field full form-error" role="alert">Aucune zone de livraison n’est configurée pour le moment. Veuillez réessayer plus tard.</p>}<label className="field full"><span>Adresse / indication de livraison *</span><textarea {...register('address')} rows={3} placeholder="Commune, rue, repère…" />{errors.address&&<small className="field-error">{errors.address.message}</small>}</label><label className="field full"><span>Instructions (facultatif)</span><textarea {...register('instructions')} rows={3} placeholder="Précisions utiles pour notre équipe" /></label></div></section>
      <section><h2><span>3</span> Preuve de paiement</h2><p className="payment-proof-intro">Choisissez le service utilisé pour votre dépôt, puis indiquez sa référence et le numéro de téléphone associé. La preuve sera vérifiée par notre équipe avant la confirmation du paiement.</p><div className="form-grid"><label className="field full"><span>Service de dépôt *</span><select {...register('payment_provider')}><option value="">Choisir MonCash ou Natcom</option><option value="moncash">MonCash</option><option value="natcom">Natcom</option></select>{errors.payment_provider&&<small className="field-error">{errors.payment_provider.message}</small>}</label><label className="field"><span>Txn ID (12 chiffres) *</span><input {...register('payment_txn_id')} inputMode="numeric" autoComplete="off" maxLength={12} placeholder="003597765384" />{errors.payment_txn_id&&<small className="field-error">{errors.payment_txn_id.message}</small>}</label><label className="field"><span>Téléphone utilisé pour le dépôt *</span><input {...register('payment_depositor_phone')} type="tel" inputMode="tel" autoComplete="tel" placeholder="+509 …" />{errors.payment_depositor_phone&&<small className="field-error">{errors.payment_depositor_phone.message}</small>}</label></div></section>
      <label className="consent whatsapp-consent"><input type="checkbox" {...register('whatsapp_consent')} /><span>J’accepte de recevoir la confirmation et le suivi de ma commande par WhatsApp au numéro indiqué (format international +509…). Cochez cette case ou renseignez votre e-mail.</span></label>{errors.whatsapp_consent&&<small className="field-error">{errors.whatsapp_consent.message}</small>}
      <label className="consent"><input type="checkbox" {...register('consent')} /><span>J’accepte que BIELUMINA utilise ces informations pour traiter ma commande et vérifier le dépôt. Je comprends que le paiement ne sera confirmé qu’après vérification par notre équipe.</span></label>{errors.consent&&<small className="field-error">{errors.consent.message}</small>}
      {serverError&&<div className="form-error" role="alert">{serverError}</div>}
    </div>
    <aside className="order-summary checkout-summary"><h2>Votre commande</h2><div className="checkout-items">{cart.map(line=><div key={line.variant.id}><img src={primaryImage(line.product)} alt=""/><span>{line.product.name}<small>{line.variant.name} · Qté {line.quantity}</small></span><strong>{money(Number(priceFor(line.product,currency)||0)*line.quantity,currency)}</strong></div>)}</div><div><span>Sous-total</span><strong>{money(subtotal,currency)}</strong></div><div><span>Livraison</span><strong>{zoneId?money(shipping,currency):'À sélectionner'}</strong></div><div className="summary-total"><span>Total en {currency}</span><strong>{money(subtotal+shipping,currency)}</strong></div><button className="button button-gold" type="submit" disabled={isSubmitting||zonesLoading||Boolean(zonesError)||zones.length===0}>{isSubmitting?'Enregistrement…':zonesLoading?'Chargement des zones…':<>Confirmer la commande <ArrowRight size={18}/></>}</button><p><LockKeyhole size={14}/> Le dépôt reste en attente jusqu’à sa vérification par notre équipe.</p></aside>
    </form>
  </main>;
}
