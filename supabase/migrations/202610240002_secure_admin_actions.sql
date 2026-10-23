create or replace function public.admin_update_order_status(p_order_id uuid,p_status public.order_status,p_note text default '')
returns void language plpgsql security definer set search_path=public as $$
declare v_order public.orders%rowtype; v_allowed boolean:=false;
begin
  if not public.has_permission('orders.write') then raise exception 'PERMISSION_DENIED'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  v_allowed := case v_order.status
    when 'pending_confirmation' then p_status in ('confirmed','cancelled')
    when 'confirmed' then p_status in ('processing','cancelled')
    when 'processing' then p_status in ('ready_for_delivery','cancelled')
    when 'ready_for_delivery' then p_status='shipped'
    when 'shipped' then p_status='delivered'
    else false end;
  if not v_allowed then raise exception 'INVALID_STATUS_TRANSITION'; end if;
  update public.orders set status=p_status,updated_at=now() where id=p_order_id;
  insert into public.order_status_history(order_id,actor_id,from_status,to_status,note) values(p_order_id,auth.uid(),v_order.status,p_status,left(p_note,500));
  insert into public.audit_logs(actor_id,action,resource,resource_id,metadata) values(auth.uid(),'order.status_changed','orders',p_order_id::text,jsonb_build_object('from',v_order.status,'to',p_status));
  if p_status='cancelled' then
    update public.product_variants v set stock_qty=v.stock_qty+x.quantity from (select variant_id,sum(quantity) quantity from public.order_items where order_id=p_order_id and variant_id is not null group by variant_id) x where v.id=x.variant_id;
    insert into public.inventory_movements(variant_id,actor_id,delta,reason) select oi.variant_id,auth.uid(),oi.quantity,'Annulation '||v_order.order_number from public.order_items oi where oi.order_id=p_order_id and oi.variant_id is not null;
  end if;
end $$;
grant execute on function public.admin_update_order_status(uuid,public.order_status,text) to authenticated;

create or replace function public.audit_catalog_change() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.audit_logs(actor_id,action,resource,resource_id,metadata) values(auth.uid(),lower(tg_op),tg_table_name,coalesce(new.id,old.id)::text,jsonb_build_object('sku',coalesce(new.sku,old.sku)));
  return coalesce(new,old);
end $$;
create trigger products_audit after insert or update on public.products for each row execute function public.audit_catalog_change();
create trigger variants_audit after insert or update on public.product_variants for each row execute function public.audit_catalog_change();
