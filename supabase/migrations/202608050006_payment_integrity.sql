-- Payment integrity and idempotency.
--
-- Money is stored as fixed two-decimal dollar amounts in PostgreSQL.
-- Conversion to Stripe cents occurs only at the Stripe API boundary.

alter table public.bookings
  alter column estimated_price
  type numeric(12, 2)
  using round(estimated_price::numeric, 2);

alter table public.payments
  alter column amount
  type numeric(12, 2)
  using round(amount::numeric, 2),

  add column if not exists
    service_amount numeric(12, 2),

  add column if not exists
    tip_amount numeric(12, 2),

  add column if not exists
    total_amount numeric(12, 2),

  add column if not exists
    tip_source text,

  add column if not exists
    received_at timestamptz,

  add column if not exists
    recorded_by_user_id uuid,

  add column if not exists
    checkout_generation integer
      not null default 0,

  add column if not exists
    checkout_state text
      not null default 'not_started',

  add column if not exists
    checkout_attempted_at timestamptz,

  add column if not exists
    checkout_finalized_at timestamptz,

  add column if not exists
    checkout_error text,

  add column if not exists
    last_payment_email_sent_at timestamptz;

update public.payments
set
  service_amount =
    coalesce(
      service_amount,
      amount,
      0
    ),

  tip_amount =
    coalesce(
      tip_amount,
      0
    ),

  total_amount =
    coalesce(
      total_amount,
      amount,
      0
    );

alter table public.payments
  alter column service_amount
    set default 0,

  alter column service_amount
    set not null,

  alter column tip_amount
    set default 0,

  alter column tip_amount
    set not null,

  alter column total_amount
    set default 0,

  alter column total_amount
    set not null;

alter table public.payments
  drop constraint if exists
    payments_money_nonnegative_check,

  drop constraint if exists
    payments_tip_source_check,

  drop constraint if exists
    payments_checkout_state_check;

alter table public.payments
  add constraint
    payments_money_nonnegative_check
  check (
    amount >= 0
    and service_amount >= 0
    and tip_amount >= 0
    and total_amount >= 0
  ),

  add constraint
    payments_tip_source_check
  check (
    tip_source is null
    or tip_source in (
      'checkout',
      'follow_up',
      'in_person',
      'manual'
    )
  ),

  add constraint
    payments_checkout_state_check
  check (
    checkout_state in (
      'not_started',
      'creating',
      'ready',
      'paid',
      'failed',
      'cancelled'
    )
  );

alter table public.route_stops
  add column if not exists
    payment_collection_required boolean
      not null default false,

  add column if not exists
    payment_collection_status text
      not null default 'not_required',

  add column if not exists
    payment_collected_at timestamptz,

  add column if not exists
    payment_collected_by_user_id uuid,

  add column if not exists
    payment_collected_amount numeric(12, 2),

  add column if not exists
    payment_collected_method text,

  add column if not exists
    payment_collection_notes text,

  add column if not exists
    tip_collected_amount numeric(12, 2)
      not null default 0;

alter table public.route_stops
  alter column payment_collected_amount
  type numeric(12, 2)
  using round(
    payment_collected_amount::numeric,
    2
  ),

  alter column tip_collected_amount
  type numeric(12, 2)
  using round(
    tip_collected_amount::numeric,
    2
  );

alter table public.route_stops
  drop constraint if exists
    route_stops_payment_collection_status_check,

  drop constraint if exists
    route_stops_payment_collected_method_check,

  drop constraint if exists
    route_stops_payment_money_check;

alter table public.route_stops
  add constraint
    route_stops_payment_collection_status_check
  check (
    payment_collection_status in (
      'not_required',
      'due',
      'collected',
      'customer_will_pay_electronically',
      'waived',
      'issue'
    )
  ),

  add constraint
    route_stops_payment_collected_method_check
  check (
    payment_collected_method is null
    or payment_collected_method in (
      'cash',
      'stripe',
      'venmo_business',
      'zelle',
      'other'
    )
  ),

  add constraint
    route_stops_payment_money_check
  check (
    (
      payment_collected_amount is null
      or payment_collected_amount >= 0
    )
    and tip_collected_amount >= 0
  );

-- Reconcile existing payment attempts with the new checkout state.

update public.payments
set
  checkout_generation =
    greatest(
      checkout_generation,
      case
        when checkout_url is not null
          then 1
        else 0
      end
    ),

  checkout_state =
    case
      when status = 'paid'
        then 'paid'

      when status = 'failed'
        then 'failed'

      when status = 'cancelled'
        then 'cancelled'

      when checkout_url is not null
        then 'ready'

      else checkout_state
    end,

  checkout_finalized_at =
    case
      when checkout_url is not null
        then coalesce(
          checkout_finalized_at,
          updated_at,
          created_at
        )
      else checkout_finalized_at
    end;

create index if not exists
  payments_booking_created_idx
on public.payments (
  booking_id,
  created_at desc
);

create index if not exists
  payments_checkout_state_idx
on public.payments (
  checkout_state,
  checkout_attempted_at
);

create unique index if not exists
  payments_stripe_session_unique_idx
on public.payments (
  stripe_checkout_session_id
)
where stripe_checkout_session_id
  is not null;


-- Reserve or reuse one Stripe checkout attempt.
--
-- Advisory locking serializes requests for the same booking/payment scope,
-- preventing two button presses from creating two simultaneous sessions.

create or replace function
  public.payment_reserve_stripe_checkout_atomic(
    p_payment_id uuid,
    p_customer_id uuid,
    p_booking_id uuid,
    p_service_visit_id uuid,
    p_amount numeric,
    p_currency text,
    p_description text,
    p_payment_type text,
    p_stripe_customer_id text,
    p_metadata jsonb
  )
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;

  v_has_payment boolean :=
    false;

  v_generation integer;

  v_amount numeric(12, 2) :=
    round(p_amount, 2);

  v_scope_key text;
begin
  if v_amount is null
    or v_amount <= 0
    or v_amount > 50000
  then
    raise exception using
      errcode = 'P0001',
      message =
        'payment_integrity:invalid_amount';
  end if;

  if nullif(trim(p_currency), '') is null
    or length(trim(p_currency)) <> 3
  then
    raise exception using
      errcode = 'P0001',
      message =
        'payment_integrity:invalid_currency';
  end if;

  if p_payment_type not in (
    'booking',
    'service_visit',
    'add_on',
    'cancellation_fee',
    'last_minute_charge',
    'manual_invoice',
    'payment_link'
  ) then
    raise exception using
      errcode = 'P0001',
      message =
        'payment_integrity:invalid_payment_type';
  end if;

  if p_booking_id is null
    and p_payment_id is null
    and p_customer_id is null
  then
    raise exception using
      errcode = 'P0001',
      message =
        'payment_integrity:missing_relationship';
  end if;

  v_scope_key =
    coalesce(
      p_payment_id::text,
      ''
    )
    || ':'
    || coalesce(
      p_booking_id::text,
      ''
    )
    || ':'
    || coalesce(
      p_service_visit_id::text,
      ''
    )
    || ':'
    || coalesce(
      p_customer_id::text,
      ''
    )
    || ':'
    || p_payment_type
    || ':'
    || v_amount::text;

  perform pg_advisory_xact_lock(
    hashtextextended(
      v_scope_key,
      0
    )
  );

  if p_booking_id is not null then
    perform 1
    from public.bookings
    where id = p_booking_id;

    if not found then
      raise exception using
        errcode = 'P0001',
        message =
          'payment_integrity:booking_missing';
    end if;
  end if;

  if p_service_visit_id is not null then
    perform 1
    from public.service_visits
    where id = p_service_visit_id
      and (
        p_booking_id is null
        or booking_id = p_booking_id
      );

    if not found then
      raise exception using
        errcode = 'P0001',
        message =
          'payment_integrity:visit_mismatch';
    end if;
  end if;

  if p_payment_id is not null then
    select *
    into v_payment
    from public.payments
    where id = p_payment_id
    for update;

    v_has_payment := found;

    if not v_has_payment then
      raise exception using
        errcode = 'P0001',
        message =
          'payment_integrity:payment_missing';
    end if;

    if v_payment.status in (
      'paid',
      'refunded'
    ) then
      raise exception using
        errcode = 'P0001',
        message =
          'payment_integrity:payment_settled';
    end if;

    if p_booking_id is not null
      and v_payment.booking_id is not null
      and v_payment.booking_id is distinct from
        p_booking_id
    then
      raise exception using
        errcode = 'P0001',
        message =
          'payment_integrity:booking_mismatch';
    end if;

    if p_service_visit_id is not null
      and v_payment.service_visit_id is not null
      and v_payment.service_visit_id is distinct from
        p_service_visit_id
    then
      raise exception using
        errcode = 'P0001',
        message =
          'payment_integrity:visit_mismatch';
    end if;

    if p_customer_id is not null
      and v_payment.customer_id is not null
      and v_payment.customer_id is distinct from
        p_customer_id
    then
      raise exception using
        errcode = 'P0001',
        message =
          'payment_integrity:customer_mismatch';
    end if;
  else
    select *
    into v_payment
    from public.payments
    where provider = 'stripe'
      and booking_id is not distinct from
        p_booking_id
      and service_visit_id is not distinct from
        p_service_visit_id
      and customer_id is not distinct from
        p_customer_id
      and payment_type is not distinct from
        p_payment_type
      and amount = v_amount
      and status = 'pending'
      and checkout_state in (
        'creating',
        'ready'
      )
    order by created_at desc
    limit 1
    for update;

    v_has_payment := found;
  end if;

  if v_has_payment
    and v_payment.checkout_state = 'ready'
    and nullif(
      v_payment.checkout_url,
      ''
    ) is not null
  then
    return jsonb_build_object(
      'paymentId',
        v_payment.id,
      'generation',
        v_payment.checkout_generation,
      'reuseExisting',
        true,
      'inProgress',
        false,
      'checkoutUrl',
        v_payment.checkout_url,
      'stripeCheckoutSessionId',
        v_payment.stripe_checkout_session_id
    );
  end if;

  if v_has_payment
    and v_payment.checkout_state = 'creating'
    and v_payment.checkout_attempted_at >
      now() - interval '2 minutes'
  then
    return jsonb_build_object(
      'paymentId',
        v_payment.id,
      'generation',
        v_payment.checkout_generation,
      'reuseExisting',
        false,
      'inProgress',
        true
    );
  end if;

  if v_has_payment then
    v_generation =
      greatest(
        v_payment.checkout_generation,
        0
      ) + 1;

    update public.payments
    set
      customer_id =
        coalesce(
          customer_id,
          p_customer_id
        ),

      booking_id =
        coalesce(
          booking_id,
          p_booking_id
        ),

      service_visit_id =
        coalesce(
          service_visit_id,
          p_service_visit_id
        ),

      amount = v_amount,
      service_amount = v_amount,
      tip_amount = 0,
      total_amount = v_amount,
      tip_source = null,

      currency =
        lower(
          trim(
            p_currency
          )
        ),

      status = 'pending',
      provider = 'stripe',

      stripe_customer_id =
        coalesce(
          p_stripe_customer_id,
          stripe_customer_id
        ),

      stripe_checkout_session_id =
        null,

      stripe_payment_intent_id =
        null,

      stripe_subscription_id =
        null,

      checkout_url =
        null,

      description =
        nullif(
          trim(
            p_description
          ),
          ''
        ),

      payment_type =
        p_payment_type,

      metadata =
        coalesce(
          metadata,
          '{}'::jsonb
        )
        || coalesce(
          p_metadata,
          '{}'::jsonb
        ),

      checkout_generation =
        v_generation,

      checkout_state =
        'creating',

      checkout_attempted_at =
        now(),

      checkout_finalized_at =
        null,

      checkout_error =
        null

    where id = v_payment.id

    returning *
    into v_payment;
  else
    insert into public.payments (
      customer_id,
      booking_id,
      service_visit_id,

      amount,
      service_amount,
      tip_amount,
      total_amount,
      tip_source,

      currency,
      status,
      provider,

      stripe_customer_id,

      description,
      payment_type,
      metadata,

      checkout_generation,
      checkout_state,
      checkout_attempted_at
    )
    values (
      p_customer_id,
      p_booking_id,
      p_service_visit_id,

      v_amount,
      v_amount,
      0,
      v_amount,
      null,

      lower(
        trim(
          p_currency
        )
      ),
      'pending',
      'stripe',

      p_stripe_customer_id,

      nullif(
        trim(
          p_description
        ),
        ''
      ),
      p_payment_type,
      coalesce(
        p_metadata,
        '{}'::jsonb
      ),

      1,
      'creating',
      now()
    )
    returning *
    into v_payment;

    v_generation := 1;
  end if;

  return jsonb_build_object(
    'paymentId',
      v_payment.id,
    'generation',
      v_generation,
    'reuseExisting',
      false,
    'inProgress',
      false
  );
end;
$$;


create or replace function
  public.payment_finalize_stripe_checkout_atomic(
    p_payment_id uuid,
    p_generation integer,
    p_stripe_customer_id text,
    p_checkout_session_id text,
    p_payment_intent_id text,
    p_subscription_id text,
    p_checkout_url text,
    p_metadata jsonb
  )
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
begin
  select *
  into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message =
        'payment_integrity:payment_missing';
  end if;

  if v_payment.checkout_generation <>
    p_generation
  then
    raise exception using
      errcode = 'P0001',
      message =
        'payment_integrity:stale_generation';
  end if;

  if v_payment.checkout_state = 'ready'
    and v_payment.stripe_checkout_session_id =
      p_checkout_session_id
    and v_payment.checkout_url =
      p_checkout_url
  then
    return jsonb_build_object(
      'alreadyFinalized',
        true,
      'paymentId',
        v_payment.id,
      'checkoutUrl',
        v_payment.checkout_url
    );
  end if;

  update public.payments
  set
    status = 'pending',

    stripe_customer_id =
      p_stripe_customer_id,

    stripe_checkout_session_id =
      p_checkout_session_id,

    stripe_payment_intent_id =
      nullif(
        trim(
          p_payment_intent_id
        ),
        ''
      ),

    stripe_subscription_id =
      nullif(
        trim(
          p_subscription_id
        ),
        ''
      ),

    checkout_url =
      p_checkout_url,

    metadata =
      coalesce(
        metadata,
        '{}'::jsonb
      )
      || coalesce(
        p_metadata,
        '{}'::jsonb
      ),

    checkout_state =
      'ready',

    checkout_finalized_at =
      now(),

    checkout_error =
      null

  where id = v_payment.id

  returning *
  into v_payment;

  if v_payment.booking_id is not null then
    update public.bookings
    set
      payment_status =
        case
          when payment_status = 'paid'
            then payment_status
          else 'pending'
        end,

      payment_provider =
        'stripe',

      payment_link =
        p_checkout_url,

      checkout_started_at =
        now(),

      stripe_customer_id =
        p_stripe_customer_id,

      stripe_checkout_session_id =
        p_checkout_session_id,

      stripe_payment_intent_id =
        nullif(
          trim(
            p_payment_intent_id
          ),
          ''
        ),

      stripe_subscription_id =
        nullif(
          trim(
            p_subscription_id
          ),
          ''
        )

    where id =
      v_payment.booking_id;
  end if;

  return jsonb_build_object(
    'alreadyFinalized',
      false,
    'paymentId',
      v_payment.id,
    'checkoutUrl',
      v_payment.checkout_url
  );
end;
$$;


create or replace function
  public.payment_fail_stripe_checkout_atomic(
    p_payment_id uuid,
    p_generation integer,
    p_error text,
    p_metadata jsonb
  )
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
begin
  select *
  into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    return jsonb_build_object(
      'changed',
        false,
      'reason',
        'missing'
    );
  end if;

  if v_payment.checkout_generation <>
    p_generation
  then
    return jsonb_build_object(
      'changed',
        false,
      'reason',
        'stale_generation'
    );
  end if;

  if v_payment.status in (
    'paid',
    'refunded'
  ) then
    return jsonb_build_object(
      'changed',
        false,
      'reason',
        'settled'
    );
  end if;

  update public.payments
  set
    status = 'failed',

    checkout_state =
      'failed',

    checkout_error =
      left(
        coalesce(
          p_error,
          'Stripe checkout creation failed.'
        ),
        1500
      ),

    metadata =
      coalesce(
        metadata,
        '{}'::jsonb
      )
      || coalesce(
        p_metadata,
        '{}'::jsonb
      )
      || jsonb_build_object(
        'checkout_failed_at',
          now()
      )

  where id = v_payment.id;

  return jsonb_build_object(
    'changed',
      true,
    'paymentId',
      v_payment.id
  );
end;
$$;


create or replace function
  public.field_record_manual_payment_atomic(
    p_route_stop_id uuid,
    p_actor_profile_id uuid,
    p_service_amount numeric,
    p_tip_amount numeric,
    p_method text,
    p_notes text
  )
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stop public.route_stops%rowtype;
  v_visit public.service_visits%rowtype;
  v_booking public.bookings%rowtype;
  v_payment public.payments%rowtype;

  v_actor_role text;

  v_service_amount numeric(12, 2) :=
    round(
      p_service_amount,
      2
    );

  v_tip_amount numeric(12, 2) :=
    round(
      coalesce(
        p_tip_amount,
        0
      ),
      2
    );

  v_total_amount numeric(12, 2);

  v_paid_at timestamptz :=
    now();

  v_provider text;
  v_payment_preference text;
  v_payment_method_label text;
  v_verification_status text;
begin
  if p_route_stop_id is null
    or p_actor_profile_id is null
  then
    raise exception using
      errcode = 'P0001',
      message =
        'payment_integrity:invalid_input';
  end if;

  if v_service_amount is null
    or v_service_amount <= 0
    or v_service_amount > 5000
    or v_tip_amount < 0
    or v_tip_amount > 5000
  then
    raise exception using
      errcode = 'P0001',
      message =
        'payment_integrity:invalid_amount';
  end if;

  if p_method not in (
    'cash',
    'venmo_business',
    'zelle',
    'other'
  ) then
    raise exception using
      errcode = 'P0001',
      message =
        'payment_integrity:invalid_manual_method';
  end if;

  if p_method = 'other'
    and nullif(
      trim(
        p_notes
      ),
      ''
    ) is null
  then
    raise exception using
      errcode = 'P0001',
      message =
        'payment_integrity:manual_notes_required';
  end if;

  select role
  into v_actor_role
  from public.profiles
  where id =
    p_actor_profile_id;

  if not found
    or v_actor_role not in (
      'technician',
      'admin',
      'owner'
    )
  then
    raise exception using
      errcode = 'P0001',
      message =
        'payment_integrity:not_authorized';
  end if;

  select *
  into v_stop
  from public.route_stops
  where id =
    p_route_stop_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message =
        'payment_integrity:stop_missing';
  end if;

  if not public.field_actor_can_manage_route(
    v_stop.route_day_id,
    p_actor_profile_id
  ) then
    raise exception using
      errcode = 'P0001',
      message =
        'payment_integrity:not_assigned';
  end if;

  if v_stop.service_visit_id is null
    or v_stop.booking_id is null
  then
    raise exception using
      errcode = 'P0001',
      message =
        'payment_integrity:missing_relationship';
  end if;

  select *
  into v_visit
  from public.service_visits
  where id =
    v_stop.service_visit_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message =
        'payment_integrity:visit_missing';
  end if;

  select *
  into v_booking
  from public.bookings
  where id =
    v_stop.booking_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message =
        'payment_integrity:booking_missing';
  end if;

  if v_visit.booking_id is distinct from
    v_booking.id
  then
    raise exception using
      errcode = 'P0001',
      message =
        'payment_integrity:booking_mismatch';
  end if;

  if v_booking.payment_status = 'paid' then
    select *
    into v_payment
    from public.payments
    where booking_id =
      v_booking.id
      and status = 'paid'
    order by received_at desc nulls last,
      created_at desc
    limit 1;

    return jsonb_build_object(
      'alreadyPaid',
        true,
      'paymentId',
        v_payment.id,
      'serviceAmount',
        coalesce(
          v_payment.service_amount,
          v_payment.amount
        ),
      'tipAmount',
        coalesce(
          v_payment.tip_amount,
          0
        ),
      'totalAmount',
        coalesce(
          v_payment.total_amount,
          v_payment.amount
        )
    );
  end if;

  if v_actor_role = 'technician'
    and not (
      v_booking.payment_due_at_service
      and v_booking.payment_preference in (
        'cash_in_person',
        'venmo_business',
        'zelle',
        'manual_other'
      )
    )
  then
    raise exception using
      errcode = 'P0001',
      message =
        'payment_integrity:admin_override_required';
  end if;

  v_total_amount =
    round(
      v_service_amount +
      v_tip_amount,
      2
    );

  v_provider =
    case p_method
      when 'cash'
        then 'cash'
      when 'venmo_business'
        then 'venmo'
      when 'zelle'
        then 'zelle'
      else 'manual'
    end;

  v_payment_preference =
    case p_method
      when 'cash'
        then 'cash_in_person'
      when 'venmo_business'
        then 'venmo_business'
      when 'zelle'
        then 'zelle'
      else 'manual_other'
    end;

  v_payment_method_label =
    case p_method
      when 'cash'
        then 'Cash'
      when 'venmo_business'
        then 'Venmo Business'
      when 'zelle'
        then 'Zelle'
      else 'Other'
    end;

  v_verification_status =
    case
      when p_method = 'cash'
        then 'not_required'
      else 'verified'
    end;

  insert into public.payments (
    customer_id,
    booking_id,
    service_visit_id,

    amount,
    service_amount,
    tip_amount,
    total_amount,
    tip_source,

    received_at,
    recorded_by_user_id,

    currency,
    status,
    provider,

    description,
    payment_type,
    metadata,

    checkout_state
  )
  values (
    v_booking.customer_id,
    v_booking.id,
    v_visit.id,

    v_total_amount,
    v_service_amount,
    v_tip_amount,
    v_total_amount,

    case
      when v_tip_amount > 0
        then 'in_person'
      else null
    end,

    v_paid_at,
    p_actor_profile_id,

    'usd',
    'paid',
    v_provider,

    v_payment_method_label
      || ' collected during service visit',

    'service_payment',

    jsonb_build_object(
      'source',
        'field_app',
      'route_stop_id',
        v_stop.id,
      'service_visit_id',
        v_visit.id,
      'payment_method',
        p_method,
      'service_amount',
        v_service_amount,
      'tip_amount',
        v_tip_amount,
      'total_amount',
        v_total_amount,
      'notes',
        nullif(
          trim(
            p_notes
          ),
          ''
        ),
      'collected_by',
        p_actor_profile_id,
      'collected_at',
        v_paid_at
    ),

    'paid'
  )
  returning *
  into v_payment;

  update public.bookings
  set
    payment_status =
      'paid',

    payment_preference =
      v_payment_preference,

    payment_due_at_service =
      false,

    payment_verification_status =
      v_verification_status,

    payment_verified_at =
      case
        when v_verification_status =
          'verified'
        then v_paid_at
        else null
      end,

    payment_verified_by_user_id =
      case
        when v_verification_status =
          'verified'
        then p_actor_profile_id
        else null
      end,

    payment_method =
      v_payment_method_label,

    payment_provider =
      v_provider,

    payment_reference =
      'field:'
      || v_stop.id::text,

    paid_at =
      v_paid_at,

    payment_failed_at =
      null,

    payment_failure_code =
      null,

    payment_failure_message =
      null

  where id =
    v_booking.id;

  update public.route_stops
  set
    payment_collection_required =
      false,

    payment_collection_status =
      'collected',

    payment_collected_at =
      v_paid_at,

    payment_collected_by_user_id =
      p_actor_profile_id,

    payment_collected_amount =
      v_service_amount,

    payment_collected_method =
      p_method,

    payment_collection_notes =
      nullif(
        trim(
          p_notes
        ),
        ''
      ),

    tip_collected_amount =
      v_tip_amount

  where id =
    v_stop.id;

  insert into public.service_events (
    actor_profile_id,
    booking_id,
    service_visit_id,
    route_stop_id,
    event_type,
    message,
    metadata
  )
  values (
    p_actor_profile_id,
    v_booking.id,
    v_visit.id,
    v_stop.id,
    'field_payment_collected',

    v_payment_method_label
      || ' payment of $'
      || to_char(
        v_total_amount,
        'FM999999990.00'
      )
      || ' collected in the field.',

    jsonb_build_object(
      'paymentId',
        v_payment.id,
      'method',
        p_method,
      'serviceAmount',
        v_service_amount,
      'tipAmount',
        v_tip_amount,
      'totalAmount',
        v_total_amount,
      'notes',
        nullif(
          trim(
            p_notes
          ),
          ''
        )
    )
  );

  insert into public.admin_notifications (
    type,
    title,
    message,
    href,
    customer_id,
    booking_id,
    severity,
    metadata
  )
  values (
    'field_payment_collected',
    'Field payment collected',

    trim(
      v_booking.first_name
      || ' '
      || v_booking.last_name
    )
      || ': $'
      || to_char(
        v_service_amount,
        'FM999999990.00'
      )
      || ' service'
      || case
        when v_tip_amount > 0
        then
          ' + $'
          || to_char(
            v_tip_amount,
            'FM999999990.00'
          )
          || ' tip'
        else ''
      end
      || '.',

    '/admin/bookings?q='
      || v_booking.id::text,

    v_booking.customer_id,
    v_booking.id,
    'info',

    jsonb_build_object(
      'paymentId',
        v_payment.id,
      'visitId',
        v_visit.id,
      'routeStopId',
        v_stop.id,
      'method',
        p_method,
      'serviceAmount',
        v_service_amount,
      'tipAmount',
        v_tip_amount,
      'totalAmount',
        v_total_amount
    )
  );

  return jsonb_build_object(
    'alreadyPaid',
      false,
    'paymentId',
      v_payment.id,
    'serviceAmount',
      v_service_amount,
    'tipAmount',
      v_tip_amount,
    'totalAmount',
      v_total_amount
  );
end;
$$;


create or replace function
  public.field_mark_payment_email_sent_atomic(
    p_payment_id uuid,
    p_route_stop_id uuid,
    p_service_visit_id uuid,
    p_actor_profile_id uuid
  )
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_stop public.route_stops%rowtype;
  v_sent_at timestamptz :=
    now();
begin
  select *
  into v_payment
  from public.payments
  where id =
    p_payment_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message =
        'payment_integrity:payment_missing';
  end if;

  select *
  into v_stop
  from public.route_stops
  where id =
    p_route_stop_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message =
        'payment_integrity:stop_missing';
  end if;

  if not public.field_actor_can_manage_route(
    v_stop.route_day_id,
    p_actor_profile_id
  ) then
    raise exception using
      errcode = 'P0001',
      message =
        'payment_integrity:not_assigned';
  end if;

  if v_stop.booking_id is distinct from
    v_payment.booking_id
    or v_stop.service_visit_id is distinct from
      p_service_visit_id
    or (
      v_payment.service_visit_id is not null
      and v_payment.service_visit_id is distinct from
        p_service_visit_id
    )
  then
    raise exception using
      errcode = 'P0001',
      message =
        'payment_integrity:relationship_mismatch';
  end if;

  update public.payments
  set
    status =
      case
        when status = 'paid'
          then status
        else 'pending'
      end,

    last_payment_email_sent_at =
      v_sent_at,

    metadata =
      coalesce(
        metadata,
        '{}'::jsonb
      )
      || jsonb_build_object(
        'field_payment_email_sent_at',
          v_sent_at,
        'route_stop_id',
          p_route_stop_id,
        'service_visit_id',
          p_service_visit_id,
        'sent_by',
          p_actor_profile_id
      )

  where id =
    v_payment.id;

  if v_payment.booking_id is not null then
    update public.bookings
    set
      payment_status =
        case
          when payment_status = 'paid'
            then payment_status
          else 'pending'
        end,

      payment_provider =
        'stripe'

    where id =
      v_payment.booking_id;
  end if;

  insert into public.service_events (
    actor_profile_id,
    booking_id,
    service_visit_id,
    route_stop_id,
    event_type,
    message,
    metadata
  )
  values (
    p_actor_profile_id,
    v_payment.booking_id,
    p_service_visit_id,
    p_route_stop_id,
    'field_payment_email_sent',
    'Payment email sent from the field app.',
    jsonb_build_object(
      'paymentId',
        v_payment.id,
      'sentAt',
        v_sent_at
    )
  );

  return jsonb_build_object(
    'paymentId',
      v_payment.id,
    'sentAt',
      v_sent_at
  );
end;
$$;


revoke all on function
  public.payment_reserve_stripe_checkout_atomic(
    uuid,
    uuid,
    uuid,
    uuid,
    numeric,
    text,
    text,
    text,
    text,
    jsonb
  )
  from public, anon, authenticated;

revoke all on function
  public.payment_finalize_stripe_checkout_atomic(
    uuid,
    integer,
    text,
    text,
    text,
    text,
    text,
    jsonb
  )
  from public, anon, authenticated;

revoke all on function
  public.payment_fail_stripe_checkout_atomic(
    uuid,
    integer,
    text,
    jsonb
  )
  from public, anon, authenticated;

revoke all on function
  public.field_record_manual_payment_atomic(
    uuid,
    uuid,
    numeric,
    numeric,
    text,
    text
  )
  from public, anon, authenticated;

revoke all on function
  public.field_mark_payment_email_sent_atomic(
    uuid,
    uuid,
    uuid,
    uuid
  )
  from public, anon, authenticated;

grant execute on function
  public.payment_reserve_stripe_checkout_atomic(
    uuid,
    uuid,
    uuid,
    uuid,
    numeric,
    text,
    text,
    text,
    text,
    jsonb
  )
  to service_role;

grant execute on function
  public.payment_finalize_stripe_checkout_atomic(
    uuid,
    integer,
    text,
    text,
    text,
    text,
    text,
    jsonb
  )
  to service_role;

grant execute on function
  public.payment_fail_stripe_checkout_atomic(
    uuid,
    integer,
    text,
    jsonb
  )
  to service_role;

grant execute on function
  public.field_record_manual_payment_atomic(
    uuid,
    uuid,
    numeric,
    numeric,
    text,
    text
  )
  to service_role;

grant execute on function
  public.field_mark_payment_email_sent_atomic(
    uuid,
    uuid,
    uuid,
    uuid
  )
  to service_role;
