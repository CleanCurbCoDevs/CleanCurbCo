-- Final payment-integrity corrections.
--
-- 1. Normalize every monetary payment column even when it already
--    existed before migration 006.
-- 2. Represent refunded Stripe checkout state explicitly.

alter table public.payments
  alter column service_amount
  type numeric(12, 2)
  using round(
    service_amount::numeric,
    2
  ),

  alter column tip_amount
  type numeric(12, 2)
  using round(
    tip_amount::numeric,
    2
  ),

  alter column total_amount
  type numeric(12, 2)
  using round(
    total_amount::numeric,
    2
  );

alter table public.payments
  drop constraint if exists
    payments_checkout_state_check;

alter table public.payments
  add constraint
    payments_checkout_state_check
  check (
    checkout_state in (
      'not_started',
      'creating',
      'ready',
      'paid',
      'failed',
      'cancelled',
      'refunded'
    )
  );

update public.payments
set
  checkout_state = 'refunded',
  checkout_error = null
where status = 'refunded';
