/*
 * Clean Curb OS
 * Atomically attaches a booking and all booking-owned records
 * to the correct authenticated customer.
 */

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
  v_booking public.bookings%rowtype;
  v_claim public.booking_claims%rowtype;
  v_profile public.profiles%rowtype;
  v_service_address_id uuid;
  v_already_linked boolean := false;
  v_make_primary boolean := false;
  v_normalized_email text;
begin
  if
    p_booking_id is null or
    p_customer_id is null or
    nullif(trim(p_customer_email), '') is null or
    nullif(trim(p_token_hash), '') is null
  then
    raise exception 'INVALID_CLAIM_INPUT';
  end if;

  v_normalized_email :=
    lower(trim(p_customer_email));

  /*
   * Lock the claim so concurrent account-setup or login
   * requests cannot consume it twice.
   */
  select *
  into v_claim
  from public.booking_claims
  where booking_id = p_booking_id
    and token_hash = p_token_hash
    and used_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'CLAIM_INVALID_OR_EXPIRED';
  end if;

  select *
  into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  select *
  into v_profile
  from public.profiles
  where id = p_customer_id
  for update;

  if not found then
    raise exception 'CUSTOMER_PROFILE_NOT_FOUND';
  end if;

  /*
   * Possession of a claim token is not enough.
   * The authenticated account must use the same email
   * as both the booking and the claim.
   */
  if
    lower(trim(v_claim.email)) <> v_normalized_email or
    lower(trim(v_booking.email)) <> v_normalized_email
  then
    raise exception 'CLAIM_EMAIL_MISMATCH';
  end if;

  if
    nullif(trim(coalesce(v_profile.email, '')), '') is not null and
    lower(trim(v_profile.email)) <> v_normalized_email
  then
    raise exception 'PROFILE_EMAIL_MISMATCH';
  end if;

  if
    v_booking.customer_id is not null and
    v_booking.customer_id <> p_customer_id
  then
    raise exception 'BOOKING_ALREADY_OWNED';
  end if;

  v_already_linked :=
    v_booking.customer_id = p_customer_id;

  /*
   * Refuse to silently move related records away from
   * another customer. An inconsistent record should become
   * an exception, not an accidental ownership transfer.
   */
  if exists (
    select 1
    from public.payments
    where booking_id = p_booking_id
      and customer_id is not null
      and customer_id <> p_customer_id
  ) then
    raise exception 'PAYMENT_OWNERSHIP_CONFLICT';
  end if;

  if exists (
    select 1
    from public.service_visits
    where booking_id = p_booking_id
      and customer_id is not null
      and customer_id <> p_customer_id
  ) then
    raise exception 'SERVICE_VISIT_OWNERSHIP_CONFLICT';
  end if;

  if exists (
    select 1
    from public.service_photos
    where booking_id = p_booking_id
      and customer_id is not null
      and customer_id <> p_customer_id
  ) then
    raise exception 'SERVICE_PHOTO_OWNERSHIP_CONFLICT';
  end if;

  /*
   * Keep an existing address only when it already belongs
   * to this customer.
   */
  if v_booking.service_address_id is not null then
    select id
    into v_service_address_id
    from public.service_addresses
    where id = v_booking.service_address_id
      and customer_id = p_customer_id;

    if not found then
      raise exception 'SERVICE_ADDRESS_OWNERSHIP_CONFLICT';
    end if;
  end if;

  /*
   * Reuse a matching saved address before creating another.
   */
  if v_service_address_id is null then
    select id
    into v_service_address_id
    from public.service_addresses
    where customer_id = p_customer_id
      and lower(trim(street_address)) =
        lower(trim(v_booking.street_address))
      and lower(trim(city)) =
        lower(trim(v_booking.city))
      and lower(trim(state)) =
        lower(trim(v_booking.state))
      and coalesce(lower(trim(zip_code)), '') =
        coalesce(lower(trim(v_booking.zip_code)), '')
    order by is_primary desc, created_at asc
    limit 1;
  end if;

  if v_service_address_id is null then
    select not exists (
      select 1
      from public.service_addresses
      where customer_id = p_customer_id
        and is_primary = true
    )
    into v_make_primary;

    insert into public.service_addresses (
      customer_id,
      label,
      street_address,
      city,
      state,
      zip_code,
      neighborhood,
      collection_day,
      collection_time_window,
      same_day_preference,
      latitude,
      longitude,
      distance_from_hub_miles,
      notes,
      is_primary
    )
    values (
      p_customer_id,
      'Home',
      v_booking.street_address,
      v_booking.city,
      v_booking.state,
      v_booking.zip_code,
      v_booking.neighborhood,
      v_booking.collection_day,
      v_booking.collection_time_window,
      v_booking.same_day_preference,
      v_booking.service_latitude,
      v_booking.service_longitude,
      v_booking.service_distance_miles,
      v_booking.customer_notes,
      v_make_primary
    )
    returning id into v_service_address_id;
  end if;

  /*
   * Preserve existing profile data while importing useful
   * payment information collected before account creation.
   */
  update public.profiles
  set
    email = coalesce(
      nullif(trim(email), ''),
      trim(p_customer_email)
    ),
    stripe_customer_id = coalesce(
      stripe_customer_id,
      v_booking.stripe_customer_id
    ),
    payment_method_on_file =
      coalesce(payment_method_on_file, false) or
      coalesce(v_booking.payment_method_on_file, false),
    payment_setup_completed_at = coalesce(
      payment_setup_completed_at,
      v_booking.payment_setup_completed_at
    )
  where id = p_customer_id;

  update public.bookings
  set
    customer_id = p_customer_id,
    service_address_id = v_service_address_id
  where id = p_booking_id;

  /*
   * These customer IDs control portal visibility through
   * row-level security. Linking only the booking is not
   * sufficient.
   */
  update public.payments
  set customer_id = p_customer_id
  where booking_id = p_booking_id
    and customer_id is null;

  update public.service_visits
  set customer_id = p_customer_id
  where booking_id = p_booking_id
    and customer_id is null;

  update public.service_photos
  set customer_id = p_customer_id
  where booking_id = p_booking_id
    and customer_id is null;

  update public.referrals
  set referred_profile_id = p_customer_id
  where referred_booking_id = p_booking_id
    and referred_profile_id is null;

  update public.booking_claims
  set used_at = now()
  where id = v_claim.id;

  /*
   * Record the ownership transition inside the same database
   * transaction as the actual link.
   */
  insert into public.booking_events (
    booking_id,
    customer_id,
    actor_profile_id,
    source,
    event_type,
    outcome,
    message,
    idempotency_key,
    metadata
  )
  values (
    p_booking_id,
    p_customer_id,
    p_customer_id,
    'system',
    'CUSTOMER_LINKED',
    'success',
    'Booking and related records linked to customer account.',
    'booking:' || p_booking_id::text ||
      ':customer_linked:' || p_customer_id::text,
    jsonb_build_object(
      'serviceAddressId',
      v_service_address_id,
      'alreadyLinked',
      v_already_linked,
      'claimId',
      v_claim.id
    )
  )
  on conflict (idempotency_key)
  where idempotency_key is not null
  do nothing;

  return jsonb_build_object(
    'bookingId',
    p_booking_id,
    'customerId',
    p_customer_id,
    'serviceAddressId',
    v_service_address_id,
    'alreadyLinked',
    v_already_linked
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
  'Atomically consumes a booking claim and links all booking-owned records to the matching customer.';
