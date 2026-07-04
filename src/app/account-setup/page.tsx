import type { Metadata } from "next";
import Link from "next/link";
import { AccountSetupForm } from "@/components/account-setup-form";
import { hashClaimToken } from "@/lib/booking-claims";
import { isSupabaseConfigured } from "@/lib/env";
import { brand } from "@/lib/site";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { BookingRow } from "@/types/database";

export const metadata: Metadata = {
  title: "Account Setup",
  description: "Set up your Clean Curb Co. customer account after booking.",
};

type AccountSetupPageProps = {
  searchParams: Promise<{
    booking?: string;
    token?: string;
  }>;
};

export default async function AccountSetupPage({
  searchParams,
}: AccountSetupPageProps) {
  const params = await searchParams;
  const bookingId = params.booking ?? "";
  const token = params.token ?? "";
  const setupContext = await getSetupContext(bookingId, token);

  return (
    <main>
      <section className="page-hero">
        <div className="container section-header">
          <p className="section-kicker">Customer Account</p>
          <h1>Fresh starts are easier with an account.</h1>
          <p>
            Manage booking status, route updates, service details, and service
            photos once your account is connected.
          </p>
        </div>
      </section>
      <section className="section section-cream">
        <div className="container auth-layout">
          {setupContext.status === "ok" ? (
            <AccountSetupForm
              bookingId={bookingId}
              token={token}
              email={setupContext.email}
              customerName={setupContext.customerName}
            />
          ) : (
            <section className="placeholder-panel">
              <p className="section-kicker">Setup Link Needed</p>
              <h2>{setupContext.title}</h2>
              <p>{setupContext.message}</p>
              <div className="hero-actions">
                <Link className="button button-dark" href="/book">
                  Book a Cleaning
                </Link>
                <a className="button button-outline" href={brand.emailHref}>
                  Contact Us
                </a>
              </div>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}

async function getSetupContext(bookingId: string, token: string) {
  if (!isSupabaseConfigured()) {
    return {
      status: "unavailable" as const,
      title: "Account setup is being connected.",
      message:
        "Your booking can still be handled directly. Contact Clean Curb Co. and we will help.",
    };
  }

  if (!bookingId || !token) {
    return {
      status: "missing" as const,
      title: "Start with a booking request.",
      message:
        "For launch, accounts are created after a booking request so the right service details can be linked.",
    };
  }

  const admin = getSupabaseAdmin();
  const { data: claimData } = await admin
    .from("booking_claims")
    .select("*")
    .eq("booking_id", bookingId)
    .eq("token_hash", hashClaimToken(token))
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  const claim = claimData as { email: string } | null;

  if (!claim) {
    return {
      status: "invalid" as const,
      title: "That setup link is no longer active.",
      message:
        "Setup links expire for security. Send us a note and we can help reconnect the account.",
    };
  }

  const { data: bookingData } = await admin
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();
  const booking = bookingData as BookingRow | null;

  if (!booking || booking.email.toLowerCase() !== claim.email.toLowerCase()) {
    return {
      status: "invalid" as const,
      title: "We could not match that setup link.",
      message:
        "Send us a note and we will help connect the right booking to your account.",
    };
  }

  return {
    status: "ok" as const,
    email: booking.email,
    customerName: `${booking.first_name} ${booking.last_name}`,
  };
}
