/*
 * Clean Curb OS
 *
 * Prevents staff profiles from claiming customer bookings.
 *
 * The original atomic implementation is retained as an
 * internal function. The public RPC name becomes a guarded
 * wrapper that verifies and locks the customer profile before
 * performing the existing atomic ownership transfer.
 */

alter function public.claim_booking_to_customer(
  uuid,
  uuid,
  text,
  text
)
rename to claim_booking_to_customer_unchecked;

/*
 * The internal implementation must never be callable directly
 * through PostgREST, including with the service-role client.
 *
 * The guarded SECURITY DEFINER wrapper below can still invoke
 * it as the owning database role.
 */
revoke all
on function public.claim_booking_to_customer_unchecked(
  uuid,
  uuid,
  text,
  text
)
from public;

revoke execute
on function public.claim_booking_to_customer_unchecked(
  uuid,
  uuid,
  text,
  text
)
from anon, authenticated, service_role;

create or replace function public.claim_booking_to_customer(
  p_booking_id uuid,
  p_customer_id uuid,
  p_customer_email text,
  p_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if
    p_booking_id is null or
    p_customer_id is null or
    nullif(trim(p_customer_email), '') is null or
    nullif(trim(p_token_hash), '') is null
  then
    raise exception 'INVALID_CLAIM_INPUT';
  end if;

  /*
   * Lock the profile for the duration of the claim. This
   * prevents its role from changing between validation and
   * the atomic ownership transfer.
   */
  select *
  into v_profile
  from public.profiles
  where id = p_customer_id
  for update;

  if not found then
    raise exception 'CUSTOMER_PROFILE_NOT_FOUND';
  end if;

  if v_profile.role is distinct from 'customer' then
    raise exception 'CUSTOMER_ROLE_REQUIRED';
  end if;

  return public.claim_booking_to_customer_unchecked(
    p_booking_id,
    p_customer_id,
    p_customer_email,
    p_token_hash
  );
end;
$$;

revoke all
on function public.claim_booking_to_customer(
  uuid,
  uuid,
  text,
  text
)
from public;

revoke execute
on function public.claim_booking_to_customer(
  uuid,
  uuid,
  text,
  text
)
from anon, authenticated;

grant execute
on function public.claim_booking_to_customer(
  uuid,
  uuid,
  text,
  text
)
to service_role;

comment on function public.claim_booking_to_customer(
  uuid,
  uuid,
  text,
  text
) is
  'Validates that the authenticated profile is a customer, then atomically consumes a booking claim and links all booking-owned records to that customer.';

comment on function public.claim_booking_to_customer_unchecked(
  uuid,
  uuid,
  text,
  text
) is
  'Internal atomic booking-claim implementation. Direct execution is prohibited; use claim_booking_to_customer instead.';
