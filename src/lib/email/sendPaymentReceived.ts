import "server-only";

import {
  createAccountSetupLink,
  createClaimToken,
  createLoginClaimLink,
  hashClaimToken,
} from "@/lib/booking-claims";
import { getSiteUrl } from "@/lib/env";
import { sendTransactionalEmail } from "@/lib/email/resend";
import { paymentReceivedTemplate } from "@/lib/email/templates";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { BookingRow } from "@/types/database";

export async function sendPaymentReceived(
  booking: BookingRow,
  amount: number,
) {
  const admin = getSupabaseAdmin();
  const email = booking.email.trim().toLowerCase();

  let hasExistingAccount =
    Boolean(booking.customer_id);

  if (!hasExistingAccount) {
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    hasExistingAccount =
      Boolean(existingProfile?.id);
  }

  const token = createClaimToken();

  const { error: claimError } = await admin
    .from("booking_claims")
    .insert({
      booking_id: booking.id,
      email,
      token_hash: hashClaimToken(token),
    });

  if (claimError) {
    throw new Error(
      `Account access link could not be created: ${claimError.message}`,
    );
  }

  const loginUrl = new URL(
    "/login",
    getSiteUrl(),
  ).toString();

  const accountUrl = hasExistingAccount
    ? createLoginClaimLink(booking.id, token)
    : createAccountSetupLink(booking.id, token);

  const template = paymentReceivedTemplate(
    booking,
    amount,
    {
      accountMode: hasExistingAccount
        ? "existing"
        : "new",
      accountUrl,
      loginUrl,
    },
  );

  return sendTransactionalEmail({
    to: booking.email,
    ...template,
    templateKey: "payment_received",
    relatedBookingId: booking.id,
    idempotencyKey:
      `payment-received-${booking.id}-${amount}`,
  });
}
