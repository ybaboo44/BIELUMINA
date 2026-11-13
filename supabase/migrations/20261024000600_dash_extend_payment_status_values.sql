alter type public.payment_status add value if not exists 'failed';
alter type public.payment_status add value if not exists 'refunded';
-- PostgreSQL ne permet pas de retirer une valeur d'enum sans migration destructive.
-- Cette migration additive n'est donc volontairement pas réversible.
