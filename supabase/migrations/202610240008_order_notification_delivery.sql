-- Keep order and payment notifications in the queue until a configured
-- provider confirms delivery. Provider credentials remain server-side.

create table if not exists public.notification_settings (
  id boolean primary key default true check (id),
  admin_email text not null default '',
  admin_whatsapp text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.notification_settings enable row level security;
revoke all on public.notification_settings from anon, public;
grant select, insert, update on public.notification_settings to authenticated;

drop policy if exists "notification settings staff read" on public.notification_settings;
create policy "notification settings staff read" on public.notification_settings
  for select to authenticated using (public.has_permission('settings.write'));
drop policy if exists "notification settings staff insert" on public.notification_settings;
create policy "notification settings staff insert" on public.notification_settings
  for insert to authenticated with check (public.has_permission('settings.write'));
drop policy if exists "notification settings staff update" on public.notification_settings;
create policy "notification settings staff update" on public.notification_settings
  for update to authenticated using (public.has_permission('settings.write'))
  with check (public.has_permission('settings.write'));

insert into public.notification_settings (id) values (true)
on conflict (id) do nothing;

insert into public.store_settings (key, value)
values ('notifications', '{"email_enabled":true,"whatsapp_enabled":false}'::jsonb)
on conflict (key) do update
set value = public.store_settings.value || '{"email_enabled":true}'::jsonb,
    updated_at = now();

create or replace function public.enqueue_order_notifications()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_email_enabled boolean := false;
  v_whatsapp_enabled boolean := false;
  v_admin_email text := '';
  v_admin_whatsapp text := '';
  v_event text;
  v_status text;
begin
  if tg_op = 'INSERT' then
    v_event := 'order_created';
    v_status := new.status::text;
  elsif old.status is distinct from new.status then
    v_event := 'order_status';
    v_status := new.status::text;
  elsif old.payment_status is distinct from new.payment_status then
    v_event := 'payment_status';
    v_status := new.payment_status::text;
  else
    return new;
  end if;

  select coalesce((value->>'email_enabled')::boolean, false),
         coalesce((value->>'whatsapp_enabled')::boolean, false)
    into v_email_enabled, v_whatsapp_enabled
    from public.store_settings where key = 'notifications';

  select admin_email, admin_whatsapp
    into v_admin_email, v_admin_whatsapp
    from public.notification_settings where id = true;

  if v_email_enabled then
    if nullif(trim(new.email), '') is not null then
      insert into public.notifications
        (order_id, channel, recipient, template_name, idempotency_key, payload)
      values
        (new.id, 'email', trim(new.email), v_event,
         new.id::text || ':' || v_event || ':' || v_status || ':customer',
         jsonb_build_object('recipient_type', 'customer', 'event', v_event, 'status', v_status))
      on conflict (idempotency_key) where idempotency_key is not null do nothing;
    end if;
    if nullif(trim(v_admin_email), '') is not null then
      insert into public.notifications
        (order_id, channel, recipient, template_name, idempotency_key, payload)
      values
        (new.id, 'email', trim(v_admin_email), v_event,
         new.id::text || ':' || v_event || ':' || v_status || ':admin',
         jsonb_build_object('recipient_type', 'admin', 'event', v_event, 'status', v_status))
      on conflict (idempotency_key) where idempotency_key is not null do nothing;
    end if;
  end if;

  if v_whatsapp_enabled then
    if new.whatsapp_consent and nullif(trim(new.phone), '') is not null then
      insert into public.notifications
        (order_id, channel, recipient, template_name, idempotency_key, payload)
      values
        (new.id, 'whatsapp', new.phone,
         case when v_event = 'payment_status' then 'payment_' || v_status else 'order_' || v_status end,
         new.id::text || ':' || v_event || ':' || v_status || ':customer:whatsapp',
         jsonb_build_object('recipient_type', 'customer', 'event', v_event, 'status', v_status))
      on conflict (idempotency_key) where idempotency_key is not null do nothing;
    end if;
    if nullif(trim(v_admin_whatsapp), '') is not null then
      insert into public.notifications
        (order_id, channel, recipient, template_name, idempotency_key, payload)
      values
        (new.id, 'whatsapp', trim(v_admin_whatsapp),
         case when v_event = 'payment_status' then 'payment_' || v_status else 'order_' || v_status end,
         new.id::text || ':' || v_event || ':' || v_status || ':admin:whatsapp',
         jsonb_build_object('recipient_type', 'admin', 'event', v_event, 'status', v_status))
      on conflict (idempotency_key) where idempotency_key is not null do nothing;
    end if;
  end if;

  return new;
end $$;

drop trigger if exists orders_enqueue_whatsapp on public.orders;
drop trigger if exists orders_enqueue_payment_whatsapp on public.orders;
drop trigger if exists orders_enqueue_notifications on public.orders;
create trigger orders_enqueue_notifications
  after insert or update of status, payment_status on public.orders
  for each row execute function public.enqueue_order_notifications();

revoke execute on function public.create_order(text,text,text,uuid,text,text,text,jsonb,text)
  from anon, authenticated;
grant execute on function public.create_order(text,text,text,uuid,text,text,text,jsonb,text,text,boolean)
  to anon, authenticated;
