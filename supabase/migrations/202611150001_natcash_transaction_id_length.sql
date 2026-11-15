-- Validate transaction IDs according to the selected mobile-money provider.
create or replace function public.create_order_with_payment_proof(
  p_customer_name text,
  p_phone text,
  p_email text,
  p_delivery_zone_id uuid,
  p_delivery_address text,
  p_instructions text,
  p_currency text,
  p_items jsonb,
  p_idempotency_key text,
  p_payment_provider text,
  p_payment_txn_id text,
  p_payment_depositor_phone text,
  p_whatsapp_consent boolean
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_result jsonb;
  v_order_id uuid;
  v_constraint_name text;
begin
  if p_payment_provider is null or p_payment_provider not in ('moncash', 'natcom') then
    raise exception 'INVALID_PAYMENT_PROVIDER';
  end if;
  if p_payment_txn_id is null
     or (p_payment_provider = 'moncash' and trim(p_payment_txn_id) !~ '^[0-9]{12}$')
     or (p_payment_provider = 'natcom' and trim(p_payment_txn_id) !~ '^[0-9]{14}$') then
    raise exception 'INVALID_PAYMENT_TXN_ID';
  end if;
  if p_payment_depositor_phone is null
     or trim(p_payment_depositor_phone) !~ '^\+?[0-9][0-9 ()-]{6,19}$' then
    raise exception 'INVALID_PAYMENT_DEPOSITOR_PHONE';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 16 then
    raise exception 'INVALID_IDEMPOTENCY';
  end if;
  if exists (
    select 1 from public.orders
    where idempotency_key = p_idempotency_key
  ) then
    raise exception 'DUPLICATE_ORDER_KEY';
  end if;
  if exists (
    select 1 from public.orders
    where payment_provider = p_payment_provider
      and payment_txn_id = trim(p_payment_txn_id)
  ) then
    raise exception 'DUPLICATE_PAYMENT_TXN_ID';
  end if;

  v_result := public.create_order(
    p_customer_name,
    p_phone,
    p_email,
    p_delivery_zone_id,
    p_delivery_address,
    p_instructions,
    p_currency,
    p_items,
    p_idempotency_key,
    'manual_transfer',
    p_whatsapp_consent
  );

  if coalesce((v_result->>'duplicate')::boolean, false) then
    raise exception 'DUPLICATE_ORDER_KEY';
  end if;

  update public.orders
  set payment_provider = p_payment_provider,
      payment_txn_id = trim(p_payment_txn_id),
      payment_depositor_phone = trim(p_payment_depositor_phone),
      payment_status = 'pending'
  where order_number = v_result->>'order_number'
  returning id into v_order_id;

  if v_order_id is null then
    raise exception 'ORDER_PAYMENT_PROOF_SAVE_FAILED';
  end if;

  insert into public.payment_status_history
    (order_id, from_status, to_status, reference)
  values
    (v_order_id, 'unpaid', 'pending', 'Preuve de dépôt soumise via le checkout');

  return v_result || jsonb_build_object(
    'payment_status', 'pending',
    'payment_method', 'manual_transfer',
    'payment_provider', p_payment_provider,
    'payment_txn_id', trim(p_payment_txn_id),
    'payment_depositor_phone', trim(p_payment_depositor_phone)
  );
exception
  when unique_violation then
    get stacked diagnostics v_constraint_name = constraint_name;
    if v_constraint_name = 'orders_payment_proof_txn_unique' then
      raise exception 'DUPLICATE_PAYMENT_TXN_ID';
    end if;
    raise;
end;
$$;

revoke all on function public.create_order_with_payment_proof(
  text, text, text, uuid, text, text, text, jsonb, text, text, text, text, boolean
) from public;
grant execute on function public.create_order_with_payment_proof(
  text, text, text, uuid, text, text, text, jsonb, text, text, text, text, boolean
) to anon, authenticated;
