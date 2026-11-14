-- ============================================================================
-- BIELUMINA — Intégration dashboard + WhatsApp Business API + images multiples
-- Migration ADDITIVE : ne supprime ni table ni donnée.
-- À appliquer APRÈS 202610240001/2/3 du projet principal.
-- ============================================================================

-- 1. Statuts de paiement enrichis (vérif. manuelle des paiements) -------------
alter type public.payment_status add value if not exists 'proof_received';
alter type public.payment_status add value if not exists 'verification';
alter type public.payment_status add value if not exists 'rejected';
alter type public.payment_status add value if not exists 'failed';
alter type public.payment_status add value if not exists 'refunded';
-- PostgreSQL ne permet pas de retirer une valeur d'enum : migration additive,
-- volontairement non réversible sans reconstruction destructive du type.

-- 2. Consentement WhatsApp + mode de paiement sur les commandes --------------
alter table public.orders add column if not exists whatsapp_consent boolean not null default false;
alter table public.orders add column if not exists payment_method text not null default 'on_delivery'
  check (payment_method in ('on_delivery','manual_transfer'));

-- 3. File de notifications : traçabilité fournisseur + idempotence -----------
alter table public.notifications add column if not exists provider_message_id text;
alter table public.notifications add column if not exists template_name text;
alter table public.notifications add column if not exists idempotency_key text;
create unique index if not exists notifications_idempotency_unique
  on public.notifications(idempotency_key) where idempotency_key is not null;

-- 4. Images multiples par produit
alter table public.product_images add column if not exists is_primary boolean not null default false;
alter table public.product_images add column if not exists alt_text text not null default '';
update public.product_images pi set is_primary = true
where not exists (select 1 from public.product_images x where x.product_id = pi.product_id and x.is_primary)
  and pi.position = (select min(position) from public.product_images y where y.product_id = pi.product_id);
 --------------------------------------------
create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null,
  alt_text text not null default '',
  is_primary boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique(product_id, storage_path)
);
-- Un seul produit ne peut avoir qu'une image principale à la fois.
create unique index if not exists product_images_one_primary
  on public.product_images(product_id) where is_primary;

create or replace function public.product_images_single_primary() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_primary then
    update public.product_images set is_primary = false
     where product_id = new.product_id and id <> new.id and is_primary;
  end if;
  return new;
end $$;
drop trigger if exists product_images_primary_guard on public.product_images;
create trigger product_images_primary_guard before insert or update of is_primary on public.product_images
  for each row execute function public.product_images_single_primary();

alter table public.product_images enable row level security;


-- 5. Bucket Supabase Storage pour les nouvelles images -----------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
drop policy if exists "public product media read" on storage.objects;
create policy "public product media read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'product-images');
drop policy if exists "admin product media insert" on storage.objects;
create policy "admin product media insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'product-images' and public.has_permission('products.write'));
drop policy if exists "admin product media update" on storage.objects;
create policy "admin product media update" on storage.objects
  for update to authenticated using (bucket_id = 'product-images' and public.has_permission('products.write'))
  with check (bucket_id = 'product-images' and public.has_permission('products.write'));
drop policy if exists "admin product media delete" on storage.objects;
create policy "admin product media delete" on storage.objects
  for delete to authenticated using (bucket_id = 'product-images' and public.has_permission('products.write'));

-- 6. Rôle dédié "gestionnaire des paiements" ---------------------------------
alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check
  check (role in ('super_admin','manager','catalog_manager','order_manager','inventory_manager','payment_manager','viewer'));
insert into public.role_permissions (role, permission) values
  ('payment_manager','admin.access'),('payment_manager','orders.read'),('payment_manager','payment.write')
on conflict do nothing;

-- 7. Moyens de paiement configurables (instructions administrables) ----------
insert into public.store_settings (key, value) values
('payments','{"methods":[{"id":"on_delivery","label":"Paiement à la livraison","instructions":"Réglez le montant exact en espèces au livreur. Préparez l\u2019appoint si possible.","active":true},{"id":"manual_transfer","label":"Virement / mobile money (validation manuelle)","instructions":"Effectuez le transfert, puis envoyez la référence de transaction par WhatsApp ou au service client. Votre commande sera confirmée après vérification.","active":true}]}'::jsonb)
on conflict (key) do nothing;

-- 8. Fonctions d'administration (reprises du dashboard, search_path fixe) ----
create or replace function public.admin_update_payment_status(p_order_id uuid, p_status public.payment_status, p_reference text default '')
returns void language plpgsql security definer set search_path = public as $$
declare v_old public.payment_status;
begin
  if not public.has_permission('payment.write') then raise exception 'PERMISSION_DENIED'; end if;
  select payment_status into v_old from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_old = p_status then return; end if;
  update public.orders set payment_status = p_status, updated_at = now() where id = p_order_id;
  insert into public.payment_status_history (order_id, actor_id, from_status, to_status, reference)
  values (p_order_id, auth.uid(), v_old, p_status, left(p_reference, 200));
  insert into public.audit_logs (actor_id, action, resource, resource_id, metadata)
  values (auth.uid(), 'order.payment_changed', 'orders', p_order_id::text, jsonb_build_object('from', v_old, 'to', p_status));
end $$;

create or replace function public.admin_set_staff_role(p_user_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_permission('staff.write') then raise exception 'PERMISSION_DENIED'; end if;
  if p_user_id = auth.uid() then raise exception 'CANNOT_CHANGE_OWN_ROLE'; end if;
  if p_role not in ('super_admin','manager','catalog_manager','order_manager','inventory_manager','payment_manager','viewer') then raise exception 'INVALID_ROLE'; end if;
  delete from public.user_roles where user_id = p_user_id;
  insert into public.user_roles (user_id, role) values (p_user_id, p_role);
  insert into public.audit_logs (actor_id, action, resource, resource_id, metadata)
  values (auth.uid(), 'staff.role_changed', 'profiles', p_user_id::text, jsonb_build_object('role', p_role));
end $$;

create or replace function public.admin_retry_notification(p_notification_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_permission('orders.write') then raise exception 'PERMISSION_DENIED'; end if;
  update public.notifications set status = 'pending', next_attempt_at = now(), error_code = null
   where id = p_notification_id and status = 'failed';
  if not found then raise exception 'NOTIFICATION_NOT_RETRYABLE'; end if;
end $$;

grant execute on function public.admin_update_payment_status(uuid, public.payment_status, text) to authenticated;
grant execute on function public.admin_set_staff_role(uuid, text) to authenticated;
grant execute on function public.admin_retry_notification(uuid) to authenticated;

-- 9. Règle de lecture staff pour l'historique des paiements ------------------
drop policy if exists "staff payment history" on public.payment_status_history;
create policy "staff payment history" on public.payment_status_history
  for select to authenticated using (public.has_permission('orders.read'));

-- 10. Enqueue WhatsApp : création d'une notification par transition réelle ---
create or replace function public.enqueue_order_whatsapp() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_enabled boolean := false;
begin
  select coalesce(value->>'whatsapp_enabled', 'false')::boolean into v_enabled
    from public.store_settings where key = 'notifications';
  if v_enabled and new.whatsapp_consent and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    insert into public.notifications (order_id, channel, recipient, template_name, idempotency_key, payload)
    values (new.id, 'whatsapp', new.phone,
            'order_' || new.status::text,
            new.id::text || ':' || new.status::text,
            jsonb_build_object(
              'order_number', new.order_number, 'customer_name', new.customer_name,
              'total', new.total, 'currency', new.currency, 'status', new.status,
              'subtotal', new.subtotal, 'shipping_fee', new.shipping_fee,
              'delivery_address', new.delivery_address, 'payment_method', new.payment_method,
              'payment_status', new.payment_status))
    on conflict (idempotency_key) where idempotency_key is not null do nothing;
  end if;
  return new;
end $$;
drop trigger if exists orders_enqueue_whatsapp on public.orders;
create trigger orders_enqueue_whatsapp after insert or update of status on public.orders
  for each row execute function public.enqueue_order_whatsapp();

-- Notification distincte pour les transitions de paiement vérifiées.
create or replace function public.enqueue_payment_whatsapp() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_enabled boolean := false;
begin
  select coalesce(value->>'whatsapp_enabled', 'false')::boolean into v_enabled
    from public.store_settings where key = 'notifications';
  if v_enabled and new.whatsapp_consent and old.payment_status is distinct from new.payment_status then
    insert into public.notifications (order_id, channel, recipient, template_name, idempotency_key, payload)
    values (new.id, 'whatsapp', new.phone,
            'payment_' || new.payment_status::text,
            new.id::text || ':payment:' || new.payment_status::text,
            jsonb_build_object(
              'order_number', new.order_number, 'customer_name', new.customer_name,
              'total', new.total, 'currency', new.currency,
              'payment_status', new.payment_status, 'payment_method', new.payment_method))
    on conflict (idempotency_key) where idempotency_key is not null do nothing;
  end if;
  return new;
end $$;
drop trigger if exists orders_enqueue_payment_whatsapp on public.orders;
create trigger orders_enqueue_payment_whatsapp after update of payment_status on public.orders
  for each row execute function public.enqueue_payment_whatsapp();

-- 11. Messages WhatsApp entrants (webhook) -----------------------------------
create table if not exists public.whatsapp_inbound (
  id uuid primary key default gen_random_uuid(),
  provider_message_id text unique,
  from_number text not null,
  to_number text,
  order_id uuid references public.orders(id) on delete set null,
  body text not null default '',
  raw jsonb not null default '{}'::jsonb,
  processed boolean not null default false,
  received_at timestamptz not null default now()
);
create index if not exists whatsapp_inbound_from_idx on public.whatsapp_inbound(from_number, received_at desc);
alter table public.whatsapp_inbound enable row level security;
drop policy if exists "staff inbound whatsapp read" on public.whatsapp_inbound;
create policy "staff inbound whatsapp read" on public.whatsapp_inbound
  for select to authenticated using (public.has_permission('orders.read'));
-- Les inserts dans whatsapp_inbound sont réservés à la clé service_role
-- (Edge Function webhook) : aucune policy INSERT pour anon/authenticated.

-- Extension rétrocompatible de create_order : mode de paiement + consentement WhatsApp.
create or replace function public.create_order(
  p_customer_name text, p_phone text, p_email text, p_delivery_zone_id uuid,
  p_delivery_address text, p_instructions text, p_currency text,
  p_items jsonb, p_idempotency_key text, p_payment_method text,
  p_whatsapp_consent boolean
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_item jsonb;
  v_variant record;
  v_zone public.shipping_zones%rowtype;
  v_subtotal numeric(14,2) := 0;
  v_unit numeric(14,2);
  v_qty integer;
  v_token text := encode(gen_random_bytes(24),'hex');
begin
  if p_currency not in ('HTG','USD') then raise exception 'INVALID_CURRENCY'; end if;
  if p_payment_method not in ('on_delivery','manual_transfer') then raise exception 'INVALID_PAYMENT_METHOD'; end if;
  if length(trim(p_customer_name)) < 2 or length(trim(p_phone)) < 7 then raise exception 'INVALID_CUSTOMER'; end if;
  if p_email is not null and p_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then raise exception 'INVALID_EMAIL'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 30 then raise exception 'INVALID_ITEMS'; end if;
  if length(p_idempotency_key) < 16 then raise exception 'INVALID_IDEMPOTENCY'; end if;

  select * into v_order from public.orders where idempotency_key=p_idempotency_key;
  if found then raise exception 'DUPLICATE_ORDER_KEY'; end if;
  select * into v_zone from public.shipping_zones where id=p_delivery_zone_id and active;
  if not found then raise exception 'INVALID_SHIPPING_ZONE'; end if;

  insert into public.orders(order_number,guest_token_hash,idempotency_key,customer_name,phone,email,delivery_zone_id,delivery_address,instructions,currency,subtotal,shipping_fee,total, payment_method, whatsapp_consent)
  values ('BL-'||upper(encode(gen_random_bytes(6),'hex')),encode(sha256(v_token::bytea),'hex'),p_idempotency_key,trim(p_customer_name),trim(p_phone),nullif(trim(p_email),''),p_delivery_zone_id,trim(p_delivery_address),left(trim(p_instructions),1000),p_currency,0,case when p_currency='HTG' then v_zone.fee_htg else v_zone.fee_usd end,0, p_payment_method, p_whatsapp_consent)
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;
    if v_qty < 1 or v_qty > 20 then raise exception 'INVALID_QUANTITY'; end if;
    select v.*, p.name product_name, p.published, p.archived, p.price_htg, p.price_usd, p.promo_htg, p.promo_usd
      into v_variant from public.product_variants v join public.products p on p.id=v.product_id
      where v.id=(v_item->>'variant_id')::uuid for update of v;
    if not found or not v_variant.active or not v_variant.published or v_variant.archived then raise exception 'PRODUCT_UNAVAILABLE'; end if;
    if v_variant.stock_qty - v_variant.reserved_qty < v_qty then raise exception 'INSUFFICIENT_STOCK'; end if;
    v_unit := case when p_currency='HTG' then coalesce(v_variant.promo_htg,v_variant.price_htg) else coalesce(v_variant.promo_usd,v_variant.price_usd) end;
    if v_unit is null then raise exception 'PRICE_NOT_CONFIGURED'; end if;
    insert into public.order_items(order_id,product_id,variant_id,product_name,variant_name,sku,quantity,unit_price,line_total,currency)
    values(v_order.id,v_variant.product_id,v_variant.id,v_variant.product_name,v_variant.name,v_variant.sku,v_qty,v_unit,round(v_unit*v_qty,2),p_currency);
    update public.product_variants set stock_qty=stock_qty-v_qty where id=v_variant.id;
    insert into public.inventory_movements(variant_id,delta,reason) values(v_variant.id,-v_qty,'Commande '||v_order.order_number);
    v_subtotal := v_subtotal + round(v_unit*v_qty,2);
  end loop;

  update public.orders set subtotal=v_subtotal,total=v_subtotal+shipping_fee where id=v_order.id returning * into v_order;
  insert into public.order_status_history(order_id,to_status,note) values(v_order.id,'pending_confirmation','Commande enregistrée par le client');
  return jsonb_build_object(
    'order_number', v_order.order_number,
    'total', v_order.total,
    'subtotal', v_order.subtotal,
    'shipping_fee', v_order.shipping_fee,
    'currency', v_order.currency,
    'status', v_order.status,
    'payment_status', v_order.payment_status,
    'payment_method', v_order.payment_method,
    'access_token', v_token,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', product_name, 'variant', variant_name, 'quantity', quantity,
        'unit_price', unit_price, 'line_total', line_total
      ) order by id)
      from public.order_items where order_id = v_order.id
    ), '[]'::jsonb),
    'duplicate', false
  );
exception when unique_violation then
  select * into v_order from public.orders where idempotency_key=p_idempotency_key;
  if found then raise exception 'DUPLICATE_ORDER_KEY'; end if;
  raise;
end $$;
grant execute on function public.create_order(text,text,text,uuid,text,text,text,jsonb,text,text,boolean) to anon, authenticated;
insert into public.store_settings (key, value) values
('store','{"name":"BIELUMINA","contact_email":"","contact_phone":"","whatsapp_number":"","default_currency":"HTG"}'::jsonb),
('notifications','{"whatsapp_enabled":false,"email_enabled":true}'::jsonb)
on conflict (key) do nothing;
