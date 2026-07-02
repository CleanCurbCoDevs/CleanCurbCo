import { NextResponse } from "next/server";
import { hashClaimToken } from "@/lib/booking-claims";
import { isSupabaseConfigured } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cleanString, isValidEmail } from "@/lib/validation";

type AccountSetupPayload = {
  bookingId?: unknown;
  token?: unknown;
  email?: unknown;
  password?: unknown;
};

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Account setup is being connected. Please contact us directly." },
      { status: 503 },
    );
  }

  let body: AccountSetupPayload;

  try {
    body = (await request.json()) as AccountSetupPayload;
  } catch {
    return NextResponse.json({ error: "Invalid account setup request." }, { status: 400 });
  }

  const bookingId = cleanString(body.bookingId, 80);
  const token = cleanString(body.token, 200);
  const email = cleanString(body.email, 120).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";

  if (!bookingId || !token || !isValidEmail(email) || password.length < 8) {
    return NextResponse.json(
      { error: "Please use a valid setup link and an 8+ character password." },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdmin();
  const tokenHash = hashClaimToken(token);
  const now = new Date().toISOString();

  const { data: claim } = await admin
    .from("booking_claims")
    .select("*")
    .eq("booking_id", bookingId)
    .eq("token_hash", tokenHash)
    .is("used_at", null)
    .gt("expires_at", now)
    .maybeSingle();

  if (!claim || claim.email.toLowerCase() !== email) {
    return NextResponse.json(
      { error: "That setup link is expired or no longer valid." },
      { status: 400 },
    );
  }

  const { data: booking } = await admin
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking || booking.email.toLowerCase() !== email) {
    return NextResponse.json(
      { error: "We could not find the booking for that setup link." },
      { status: 404 },
    );
  }

  const { data: createdUser, error: createUserError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: booking.first_name,
        last_name: booking.last_name,
        phone: booking.phone,
      },
    });

  if (createUserError || !createdUser.user) {
    const message = createUserError?.message ?? "Account could not be created.";

    return NextResponse.json(
      {
        error: message.toLowerCase().includes("already")
          ? "An account already exists for this email. Please log in instead."
          : message,
      },
      { status: message.toLowerCase().includes("already") ? 409 : 500 },
    );
  }

  const userId = createdUser.user.id;

  await admin.from("profiles").upsert(
    {
      id: userId,
      role: "customer",
      first_name: booking.first_name,
      last_name: booking.last_name,
      phone: booking.phone,
      email,
      preferred_contact_method: "email",
      referred_by_profile_id: booking.referred_by_profile_id,
      stripe_customer_id: booking.stripe_customer_id,
      payment_method_on_file: booking.payment_method_on_file,
      payment_setup_completed_at: booking.payment_setup_completed_at,
    },
    { onConflict: "id" },
  );

  const { data: serviceAddress } = await admin
    .from("service_addresses")
    .insert({
      customer_id: userId,
      label: "Home",
      street_address: booking.street_address,
      city: booking.city,
      state: booking.state,
      zip_code: booking.zip_code,
      neighborhood: booking.neighborhood,
      notes: booking.customer_notes,
      is_primary: true,
    })
    .select("id")
    .single();

  await admin
    .from("bookings")
    .update({
      customer_id: userId,
      service_address_id: serviceAddress?.id ?? null,
    })
    .eq("id", booking.id);

  if (booking.referral_code) {
    await admin
      .from("referrals")
      .update({ referred_profile_id: userId })
      .eq("referred_booking_id", booking.id);
  }

  await admin
    .from("booking_claims")
    .update({ used_at: now })
    .eq("id", claim.id);

  const supabase = await createServerSupabaseClient();
  await supabase.auth.signInWithPassword({ email, password });

  return NextResponse.json({ redirectTo: "/portal" });
}
