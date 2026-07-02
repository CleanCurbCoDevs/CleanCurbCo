import type { BookingRow, PaymentRow } from "@/types/database";

export type ServiceClearanceTone = "success" | "warning" | "danger" | "neutral";

type BookingPaymentLike = Pick<
  BookingRow,
  | "payment_status"
  | "payment_link"
  | "payment_method_on_file"
  | "payment_setup_status"
  | "payment_setup_completed_at"
>;

type PaymentLike = Pick<
  PaymentRow,
  "status" | "checkout_url" | "updated_at" | "metadata"
> | null | undefined;

export function getServiceClearanceStatus(
  booking?: BookingPaymentLike | null,
  payment?: PaymentLike,
) {
  const paymentStatus = payment?.status ?? booking?.payment_status ?? "not_sent";
  const hasPaymentLink = Boolean(payment?.checkout_url || booking?.payment_link);
  const hasMethodOnFile = Boolean(
    booking?.payment_method_on_file ||
      booking?.payment_setup_status === "completed" ||
      booking?.payment_setup_completed_at,
  );
  const lastStripeEvent =
    typeof payment?.metadata?.last_stripe_event === "string"
      ? payment.metadata.last_stripe_event
      : "";

  if (paymentStatus === "paid") {
    return {
      label: "Cleared for Service",
      tone: "success" as const,
      cleared: true,
      detail: "Payment is marked paid for this service.",
      action: "Proceed with service.",
      paymentStatus,
      hasPaymentLink,
      hasMethodOnFile,
    };
  }

  if (paymentStatus === "cancelled" || lastStripeEvent === "checkout.session.expired") {
    return {
      label: "Payment Expired",
      tone: "danger" as const,
      cleared: false,
      detail: "The latest payment link is expired or cancelled.",
      action: "Send a new link or mark the stop for admin follow-up.",
      paymentStatus,
      hasPaymentLink,
      hasMethodOnFile,
    };
  }

  if (paymentStatus === "failed" || paymentStatus === "refunded") {
    return {
      label: "Payment Follow-Up Required",
      tone: "danger" as const,
      cleared: false,
      detail: "Payment is not confirmed and needs admin/customer follow-up.",
      action: "Do not mark this as cleared until payment is confirmed.",
      paymentStatus,
      hasPaymentLink,
      hasMethodOnFile,
    };
  }

  if (hasPaymentLink) {
    return {
      label: "Payment Link Sent",
      tone: "warning" as const,
      cleared: false,
      detail: "A payment link exists, but payment is not marked paid yet.",
      action: "Confirm payment or request customer/admin follow-up before service.",
      paymentStatus,
      hasPaymentLink,
      hasMethodOnFile,
    };
  }

  if (paymentStatus === "pending") {
    return {
      label: "Payment Pending",
      tone: "warning" as const,
      cleared: false,
      detail: "Payment is pending but no usable link is attached here.",
      action: "Generate or send a payment link, then confirm before service.",
      paymentStatus,
      hasPaymentLink,
      hasMethodOnFile,
    };
  }

  return {
    label: hasMethodOnFile ? "Payment Method On File" : "Payment Required",
    tone: hasMethodOnFile ? ("neutral" as const) : ("warning" as const),
    cleared: false,
    detail: hasMethodOnFile
      ? "A Stripe payment method is on file, but this service is not marked paid."
      : "No payment link or confirmed payment is attached to this stop yet.",
    action: hasMethodOnFile
      ? "Confirm billing terms before marking the stop cleared."
      : "Send a payment link or ask admin to follow up.",
    paymentStatus,
    hasPaymentLink,
    hasMethodOnFile,
  };
}
