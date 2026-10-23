create extension if not exists pgcrypto;

create type public.order_status as enum ('pending_confirmation','confirmed','processing','ready_for_delivery','shipped','delivered','cancelled');
create type public.payment_status as enum ('unpaid','pending','paid');
create type public.notification_status as enum ('pending','processing','sent','failed','cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('super_admin','manager','catalog_manager','order_manager','inventory_manager','viewer')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);
create table public.role_permissions (
  role text not null,
  permission text not null,
  primary key (role, permission)
);
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text not null default '',
  image_path text,
  position integer not null default 0,
  active boolean not null default true
);
create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id),
  slug text unique not null,
  sku text unique not null,
  name text not null,
  description text not null default '',
  image_path text,
  price_htg numeric(14,2) check (price_htg is null or price_htg >= 0),
  price_usd numeric(14,2) check (price_usd is null or price_usd >= 0),
  promo_htg numeric(14,2) check (promo_htg is null or promo_htg >= 0),
  promo_usd numeric(14,2) check (promo_usd is null or promo_usd >= 0),
  published boolean not null default false,
  archived boolean not null default false,
  featured boolean not null default false,
  is_new boolean not null default false,
  low_stock_threshold integer not null default 3,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text unique not null,
  name text not null default 'Standard',
  options jsonb not null default '{}'::jsonb,
  stock_qty integer not null default 0 check (stock_qty >= 0),
  reserved_qty integer not null default 0 check (reserved_qty >= 0 and reserved_qty <= stock_qty),
  active boolean not null default true
);
create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id),
  actor_id uuid references auth.users(id),
  delta integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);
create table public.shipping_zones (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  fee_htg numeric(14,2) not null default 0 check (fee_htg >= 0),
  fee_usd numeric(14,2) not null default 0 check (fee_usd >= 0),
  active boolean not null default true
);
create table public.store_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
create table public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  base_currency text not null check (base_currency in ('HTG','USD')),
  quote_currency text not null check (quote_currency in ('HTG','USD')),
  rate numeric(18,8) not null check (rate > 0),
  effective_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  guest_token_hash text unique not null,
  idempotency_key text unique not null,
  customer_name text not null,
  phone text not null,
  email text,
  delivery_zone_id uuid references public.shipping_zones(id),
  delivery_address text not null default '',
  instructions text not null default '',
  currency text not null check (currency in ('HTG','USD')),
  subtotal numeric(14,2) not null,
  shipping_fee numeric(14,2) not null,
  total numeric(14,2) not null,
  status public.order_status not null default 'pending_confirmation',
  payment_status public.payment_status not null default 'unpaid',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),
  variant_id uuid references public.product_variants(id),
  product_name text not null,
  variant_name text not null,
  sku text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(14,2) not null,
  line_total numeric(14,2) not null,
  currency text not null check (currency in ('HTG','USD'))
);
create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  actor_id uuid references auth.users(id),
  from_status public.order_status,
  to_status public.order_status not null,
  note text not null default '',
  created_at timestamptz not null default now()
);
create table public.payment_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  actor_id uuid references auth.users(id),
  from_status public.payment_status,
  to_status public.payment_status not null,
  reference text not null,
  created_at timestamptz not null default now()
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  channel text not null check (channel in ('email','whatsapp')),
  recipient text not null,
  status public.notification_status not null default 'pending',
  attempts integer not null default 0,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  error_code text,
  sent_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table public.notification_attempts (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  status public.notification_status not null,
  error_code text,
  attempted_at timestamptz not null default now()
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  resource text not null,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table public.admin_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null,
  invited_by uuid references auth.users(id),
  accepted_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index products_catalog_idx on public.products(published, archived, category_id);
create index products_search_idx on public.products using gin(to_tsvector('french', name || ' ' || description));
create index variants_product_idx on public.product_variants(product_id, active);
create index orders_created_idx on public.orders(created_at desc);
create index orders_status_idx on public.orders(status, payment_status);
create index notifications_queue_idx on public.notifications(status, next_attempt_at);
create index audit_resource_idx on public.audit_logs(resource, resource_id, created_at desc);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.has_permission(permission_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    join public.user_roles ur on ur.user_id = p.id
    join public.role_permissions rp on rp.role = ur.role
    where p.id = auth.uid() and p.active and rp.permission = permission_name
  );
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p join public.user_roles ur on ur.user_id=p.id where p.id=auth.uid() and p.active);
$$;

insert into public.role_permissions(role, permission) values
('super_admin','admin.access'),('super_admin','products.read'),('super_admin','products.write'),('super_admin','orders.read'),('super_admin','orders.write'),('super_admin','payment.write'),('super_admin','inventory.write'),('super_admin','settings.write'),('super_admin','staff.write'),('super_admin','audit.read'),
('manager','admin.access'),('manager','products.read'),('manager','products.write'),('manager','orders.read'),('manager','orders.write'),('manager','inventory.write'),
('catalog_manager','admin.access'),('catalog_manager','products.read'),('catalog_manager','products.write'),('catalog_manager','inventory.write'),
('order_manager','admin.access'),('order_manager','orders.read'),('order_manager','orders.write'),('order_manager','products.read'),
('inventory_manager','admin.access'),('inventory_manager','products.read'),('inventory_manager','inventory.write'),
('viewer','admin.access'),('viewer','products.read'),('viewer','orders.read');

create or replace function public.create_order(
  p_customer_name text, p_phone text, p_email text, p_delivery_zone_id uuid,
  p_delivery_address text, p_instructions text, p_currency text,
  p_items jsonb, p_idempotency_key text
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
  v_seller_email text;
begin
  if p_currency not in ('HTG','USD') then raise exception 'INVALID_CURRENCY'; end if;
  if length(trim(p_customer_name)) < 2 or length(trim(p_phone)) < 7 then raise exception 'INVALID_CUSTOMER'; end if;
  if p_email is not null and p_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then raise exception 'INVALID_EMAIL'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 30 then raise exception 'INVALID_ITEMS'; end if;
  if length(p_idempotency_key) < 16 then raise exception 'INVALID_IDEMPOTENCY'; end if;

  select * into v_order from public.orders where idempotency_key=p_idempotency_key;
  if found then return jsonb_build_object('order_number',v_order.order_number,'total',v_order.total,'currency',v_order.currency,'duplicate',true); end if;
  select * into v_zone from public.shipping_zones where id=p_delivery_zone_id and active;
  if not found then raise exception 'INVALID_SHIPPING_ZONE'; end if;

  insert into public.orders(order_number,guest_token_hash,idempotency_key,customer_name,phone,email,delivery_zone_id,delivery_address,instructions,currency,subtotal,shipping_fee,total)
  values ('BL-'||upper(encode(gen_random_bytes(6),'hex')),encode(sha256(v_token::bytea),'hex'),p_idempotency_key,trim(p_customer_name),trim(p_phone),nullif(trim(p_email),''),p_delivery_zone_id,trim(p_delivery_address),left(trim(p_instructions),1000),p_currency,0,case when p_currency='HTG' then v_zone.fee_htg else v_zone.fee_usd end,0)
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
  select value->>'seller_email' into v_seller_email from public.store_settings where key='store';
  if v_seller_email is not null and v_seller_email <> '' then
    insert into public.notifications(order_id,channel,recipient,payload) values(v_order.id,'email',v_seller_email,jsonb_build_object('order_number',v_order.order_number));
  end if;
  return jsonb_build_object('order_number',v_order.order_number,'total',v_order.total,'currency',v_order.currency,'access_token',v_token,'duplicate',false);
exception when unique_violation then
  select * into v_order from public.orders where idempotency_key=p_idempotency_key;
  if found then return jsonb_build_object('order_number',v_order.order_number,'total',v_order.total,'currency',v_order.currency,'duplicate',true); end if;
  raise;
end $$;

create or replace function public.track_order(p_order_number text, p_access_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_order public.orders%rowtype; v_items jsonb;
begin
  select * into v_order from public.orders where order_number=p_order_number and guest_token_hash=encode(sha256(p_access_token::bytea),'hex');
  if not found then return null; end if;
  select jsonb_agg(jsonb_build_object('product_name',product_name,'variant_name',variant_name,'quantity',quantity,'unit_price',unit_price,'line_total',line_total)) into v_items from public.order_items where order_id=v_order.id;
  return jsonb_build_object('order_number',v_order.order_number,'status',v_order.status,'payment_status',v_order.payment_status,'currency',v_order.currency,'subtotal',v_order.subtotal,'shipping_fee',v_order.shipping_fee,'total',v_order.total,'created_at',v_order.created_at,'items',v_items);
end $$;

grant execute on function public.create_order(text,text,text,uuid,text,text,text,jsonb,text) to anon, authenticated;
grant execute on function public.track_order(text,text) to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.shipping_zones enable row level security;
alter table public.store_settings enable row level security;
alter table public.exchange_rates enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.payment_status_history enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_attempts enable row level security;
alter table public.audit_logs enable row level security;
alter table public.admin_invitations enable row level security;

create policy "public categories" on public.categories for select to anon,authenticated using(active or public.has_permission('products.read'));
create policy "public products" on public.products for select to anon,authenticated using((published and not archived) or public.has_permission('products.read'));
create policy "public variants" on public.product_variants for select to anon,authenticated using(active or public.has_permission('products.read'));
create policy "public shipping" on public.shipping_zones for select to anon,authenticated using(active or public.has_permission('orders.read'));
create policy "public settings" on public.store_settings for select to anon,authenticated using(key in ('store','notifications'));
create policy "staff orders" on public.orders for select to authenticated using(public.has_permission('orders.read'));
create policy "staff order items" on public.order_items for select to authenticated using(public.has_permission('orders.read'));
create policy "staff order history" on public.order_status_history for select to authenticated using(public.has_permission('orders.read'));
create policy "staff notifications" on public.notifications for select to authenticated using(public.has_permission('orders.read'));
create policy "own profile" on public.profiles for select to authenticated using(id=auth.uid() or public.is_staff());
create policy "staff roles" on public.user_roles for select to authenticated using(user_id=auth.uid() or public.has_permission('staff.write'));
create policy "staff permissions" on public.role_permissions for select to authenticated using(public.is_staff());
create policy "staff audit" on public.audit_logs for select to authenticated using(public.has_permission('audit.read'));
create policy "admin products insert" on public.products for insert to authenticated with check(public.has_permission('products.write'));
create policy "admin products update" on public.products for update to authenticated using(public.has_permission('products.write')) with check(public.has_permission('products.write'));
create policy "admin variants insert" on public.product_variants for insert to authenticated with check(public.has_permission('products.write'));
create policy "admin variants update" on public.product_variants for update to authenticated using(public.has_permission('products.write')) with check(public.has_permission('products.write'));
create policy "admin inventory update" on public.product_variants for update to authenticated using(public.has_permission('inventory.write')) with check(public.has_permission('inventory.write'));
create policy "admin orders update" on public.orders for update to authenticated using(public.has_permission('orders.write')) with check(public.has_permission('orders.write'));
create policy "admin history insert" on public.order_status_history for insert to authenticated with check(public.has_permission('orders.write'));
create policy "admin settings update" on public.store_settings for update to authenticated using(public.has_permission('settings.write')) with check(public.has_permission('settings.write'));
create policy "admin inventory movements" on public.inventory_movements for select to authenticated using(public.has_permission('inventory.write'));

insert into public.categories(slug,name,description,image_path,position) values
('mode','Mode','Des silhouettes choisies pour leur allure et leur qualité.','/images/bag.jpg',1),
('beaute','Beauté','Votre rituel, sublimé par des essentiels lumineux.','/images/beauty.jpg',2),
('maison','Maison','Des pièces qui donnent une âme à votre intérieur.','/images/home.jpg',3),
('electronique','Électronique','La technologie au service de votre quotidien.','/images/headphones.jpg',4);

insert into public.products(category_id,slug,sku,name,description,image_path,price_htg,price_usd,promo_htg,promo_usd,published,featured,is_new)
select id,'sac-elegance-noir','BL-MOD-001','Sac Élégance Héritage','Un sac structuré aux finitions dorées, pensé pour accompagner vos journées avec distinction.','/images/bag.jpg',4800,36.50,null,null,true,true,true from public.categories where slug='mode';
insert into public.products(category_id,slug,sku,name,description,image_path,price_htg,price_usd,promo_htg,promo_usd,published,featured,is_new)
select id,'serum-eclat-royal','BL-BEA-001','Sérum Éclat Royal','Un rituel de soin délicat pour une peau visiblement lumineuse et nourrie.','/images/perfume.jpg',2500,19.00,2190,16.65,true,true,true from public.categories where slug='beaute';
insert into public.products(category_id,slug,sku,name,description,image_path,price_htg,price_usd,promo_htg,promo_usd,published,featured,is_new)
select id,'palette-lumiere','BL-BEA-002','Palette Lumière','Une harmonie de teintes lumineuses pour composer votre signature beauté.','/images/beauty.jpg',3200,24.35,null,null,true,false,true from public.categories where slug='beaute';
insert into public.products(category_id,slug,sku,name,description,image_path,price_htg,price_usd,promo_htg,promo_usd,published,featured,is_new)
select id,'montre-heritage','BL-ACC-001','Montre Héritage','Un garde-temps intemporel aux lignes épurées et à la présence affirmée.','/images/watch.jpg',6500,49.45,null,null,true,true,false from public.categories where slug='mode';
insert into public.products(category_id,slug,sku,name,description,image_path,price_htg,price_usd,promo_htg,promo_usd,published,featured,is_new)
select id,'fauteuil-serenite','BL-MAI-001','Fauteuil Sérénité','Une assise accueillante aux tonalités naturelles pour créer votre cocon.','/images/home.jpg',18500,140.75,16900,128.60,true,true,false from public.categories where slug='maison';
insert into public.products(category_id,slug,sku,name,description,image_path,price_htg,price_usd,promo_htg,promo_usd,published,featured,is_new)
select id,'casque-studio-or','BL-ELE-001','Casque Studio','Une immersion sonore précise dans un design confortable et raffiné.','/images/headphones.jpg',7900,60.10,null,null,true,false,true from public.categories where slug='electronique';
insert into public.products(category_id,slug,sku,name,description,image_path,price_htg,price_usd,promo_htg,promo_usd,published,featured,is_new)
select id,'ordinateur-air','BL-ELE-002','Ordinateur Air','Un compagnon fin et performant pour vos idées, vos projets et vos créations.','/images/laptop.jpg',68500,521.20,null,null,true,false,false from public.categories where slug='electronique';
insert into public.products(category_id,slug,sku,name,description,image_path,price_htg,price_usd,promo_htg,promo_usd,published,featured,is_new)
select id,'sneakers-signature','BL-MOD-002','Sneakers Signature','Une silhouette dynamique et un confort durable pour tous vos mouvements.','/images/shoes.jpg',5400,41.10,4590,34.95,true,true,false from public.categories where slug='mode';

insert into public.product_variants(product_id,sku,name,options,stock_qty)
select id,sku||'-STD','Standard','{}'::jsonb, case when sku in ('BL-MAI-001','BL-ELE-002') then 2 else 12 end from public.products;

insert into public.shipping_zones(name,fee_htg,fee_usd) values
('Port-au-Prince et Delmas',250,1.90),('Pétion-Ville',300,2.30),('Cap-Haïtien',750,5.70),('Autres départements',900,6.85),('Retrait en boutique',0,0);
insert into public.store_settings(key,value) values
('store','{"name":"BIELUMINA","default_currency":"HTG","seller_email":"","whatsapp_number":"","contact_email":"service@bielumina.com","contact_phone":""}'::jsonb),
('notifications','{"email_enabled":false,"whatsapp_enabled":true,"whatsapp_mode":"manual"}'::jsonb);
