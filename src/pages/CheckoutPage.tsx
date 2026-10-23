import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, LockKeyhole } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import { useShippingZones } from '@/hooks/useCatalog';
import { money, priceFor } from '@/lib/types';

const schema = z.object({
  name: z.string().trim().min(2,'Indiquez votre nom complet.'),
  phone: z.string().trim().min(7,'Indiquez un numéro de téléphone valide.'),
  email: z.string().trim().email('Adresse e-mail invalide.').or(z.literal('')),
  zone: z.string().uuid('Choisissez une zone de livraison.'),
  address: z.string().trim().min(5,'Précisez votre adresse ou le point de retrait.'),
  instructions: z.string().max(1000,'1000 caractères maximum.').optional(),
  consent: z.boolean().refine(Boolean,'Votre accord est nécessaire pour enregistrer la commande.'),
});
type FormData = z.infer<typeof schema>;

export function CheckoutPage() {
  const { cart, currency, subtotal, clearCart } = useStore();
  const zones = useShippingZones(); const navigate = useNavigate();
  const idempotency = useRef(crypto.randomUUID());
  const [serverError,setServerError] = useState('');
  const { register, handleSubmit, watch, formState: { errors,isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { name:'',phone:'',email:'',zone:'',address:'',instructions:'',consent:false } });
  const zoneId = watch('zone');
  const shipping = useMemo(() => { const z = zones.find(z => z.id===zoneId); return z ? Number(currency==='HTG'?z.fee_htg:z.fee_usd) : 0; }, [zones,zoneId,currency]);

  const submit = async (data: FormData) => {
    setServerError('');
    const { data: result, error } = await supabase.rpc('create_order', {
      p_customer_name:data.name,p_phone:data.phone,p_email:data.email||null,p_delivery_zone_id:data.zone,
      p_delivery_address:data.address,p_instructions:data.instructions||'',p_currency:currency,
      p_items:cart.map(line=>({variant_id:line.variant.id,quantity:line.quantity})),p_idempotency_key:idempotency.current,
    });
    if (error) { const code=error.message||''; setServerError(code.includes('INSUFFICIENT_STOCK')?'Un article n’est plus disponible dans la quantité demandée. Actualisez votre panier.':code.includes('PRODUCT_UNAVAILABLE')?'Un article n’est plus disponible. Retirez-le du panier pour continuer.':'La commande n’a pas pu être enregistrée. Vérifiez vos informations et réessayez.'); return; }
    sessionStorage.setItem('bl-last-order',JSON.stringify(result)); clearCart(); navigate('/confirmation',{state:result});
  };

  if (!cart.length) return <main className="empty-state page-empty"><h1>Votre panier est vide</h1><Link className="button button-dark" to="/boutique">Retour à la boutique</Link></main>;
  return <main className="section-shell checkout-page"><Link className="back-link" to="/panier"><ArrowLeft size={16}/> Retour au panier</Link><div className="page-intro"><span className="eyebrow">FINALISER VOTRE COMMANDE</span><h1>Vos coordonnées</h1><p>Notre équipe vous contactera pour confirmer la disponibilité, la livraison et le règlement.</p></div>
    <form className="checkout-layout" onSubmit={handleSubmit(submit)}><div className="checkout-form">
      <section><h2><span>1</span> Informations client</h2><div className="form-grid"><label className="field full"><span>Nom complet *</span><input {...register('name')} autoComplete="name" placeholder="Votre nom et prénom" />{errors.name&&<small className="field-error">{errors.name.message}</small>}</label><label className="field"><span>Téléphone *</span><input {...register('phone')} autoComplete="tel" placeholder="+509 …" />{errors.phone&&<small className="field-error">{errors.phone.message}</small>}</label><label className="field"><span>E-mail (facultatif)</span><input {...register('email')} type="email" autoComplete="email" placeholder="vous@exemple.com" />{errors.email&&<small className="field-error">{errors.email.message}</small>}</label></div></section>
      <section><h2><span>2</span> Livraison</h2><div className="form-grid"><label className="field full"><span>Zone de livraison *</span><select {...register('zone')}><option value="">Sélectionnez votre zone</option>{zones.map(z=><option value={z.id} key={z.id}>{z.name} — {money(currency==='HTG'?z.fee_htg:z.fee_usd,currency)}</option>)}</select>{errors.zone&&<small className="field-error">{errors.zone.message}</small>}</label><label className="field full"><span>Adresse / indication de livraison *</span><textarea {...register('address')} rows={3} placeholder="Commune, rue, repère…" />{errors.address&&<small className="field-error">{errors.address.message}</small>}</label><label className="field full"><span>Instructions (facultatif)</span><textarea {...register('instructions')} rows={3} placeholder="Précisions utiles pour notre équipe" /></label></div></section>
      <label className="consent"><input type="checkbox" {...register('consent')} /><span>J’accepte que BIELUMINA utilise ces informations pour traiter ma commande et me contacter. Je comprends qu’aucun paiement n’est effectué maintenant.</span></label>{errors.consent&&<small className="field-error">{errors.consent.message}</small>}
      {serverError&&<div className="form-error" role="alert">{serverError}</div>}
    </div>
    <aside className="order-summary checkout-summary"><h2>Votre commande</h2><div className="checkout-items">{cart.map(line=><div key={line.variant.id}><img src={line.product.image_path} alt=""/><span>{line.product.name}<small>{line.variant.name} · Qté {line.quantity}</small></span><strong>{money(Number(priceFor(line.product,currency)||0)*line.quantity,currency)}</strong></div>)}</div><div><span>Sous-total</span><strong>{money(subtotal,currency)}</strong></div><div><span>Livraison</span><strong>{zoneId?money(shipping,currency):'À sélectionner'}</strong></div><div className="summary-total"><span>Total en {currency}</span><strong>{money(subtotal+shipping,currency)}</strong></div><button className="button button-gold" type="submit" disabled={isSubmitting}>{isSubmitting?'Enregistrement…':<>Confirmer la commande <ArrowRight size={18}/></>}</button><p><LockKeyhole size={14}/> Vos informations sont transmises de façon sécurisée. Aucun paiement en ligne.</p></aside>
    </form>
  </main>;
}
