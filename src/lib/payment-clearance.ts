import type { BookingRow, PaymentRow } from "@/types/database";

export type ServiceClearanceTone =
  | "success"
  | "warning"
  | "danger"
  | "neutral";

export type ServiceClearanceStatus = {
  label: string;
  tone: ServiceClearanceTone;
  cleared: boolean;
  requiresCollection: boolean;
  detail: string;
  action: string;
  paymentStatus: PaymentRow["status"] | BookingRow["payment_status"];
  hasPaymentLink: boolean;
  hasMethodOnFile: boolean;
};

type BookingPaymentLike = Pick<
  BookingRow,
  | "payment_status"
  | "payment_preference"
  | "payment_due_at_service"
  | "payment_verification_status"
  | "payment_failure_code"
  | "payment_failure_message"
  | "payment_link"
  | "payment_method_on_file"
  | "payment_setup_status"
  | "payment_setup_completed_at"
>;

type PaymentLike =
  | Pick<
      PaymentRow,
      "status" | "checkout_url" | "updated_at" | "metadata"
    >
  | null
  | undefined;

export function getServiceClearanceStatus(
  booking?: BookingPaymentLike | null,
  payment?: PaymentLike,
): ServiceClearanceStatus {
  const paymentStatus =
    payment?.status ?? booking?.payment_status ?? "not_sent";

  const hasPaymentLink = Boolean(
    payment?.checkout_url || booking?.payment_link,
  );

  const hasMethodOnFile = Boolean(
    booking?.payment_method_on_file ||
      booking?.payment_setup_status === "completed" ||
      booking?.payment_setup_completed_at,
  );

  const lastStripeEvent =
    typeof payment?.metadata?.last_stripe_event === "string"
      ? payment.metadata.last_stripe_event
      : "";

  const requiresInPersonCollection =
    booking?.payment_preference === "cash_in_person" &&
    booking.payment_due_at_service &&
    paymentStatus !== "paid";

  const usesManualVerification =
    booking?.payment_preference === "venmo_business" ||
    booking?.payment_preference === "zelle" ||
    booking?.payment_preference === "manual_other";

  if (paymentStatus === "paid") {
    return {
      label: "Cleared for Service",
      tone: "success",
      cleared: true,
      requiresCollection: false,
      detail: "Payment is confirmed for this service.",
      action: "Proceed with service.",
      paymentStatus,
      hasPaymentLink,
      hasMethodOnFile,
    };
  }

  if (requiresInPersonCollection) {
    return {
      label: "PAYMENT DUE IN PERSON",
      tone: "warning",
      cleared: true,
      requiresCollection: true,
      detail:
        "The customer chose to pay at the stop. Service may proceed, but payment still needs to be collected.",
      action:
        "Confirm the service amount, collect payment, and record any tip separately before completing the visit.",
      paymentStatus,
      hasPaymentLink,
      hasMethodOnFile,
    };
  }

  if (booking?.payment_verification_status === "rejected") {
    return {
      label: "Payment Not Verified",
      tone: "danger",
      cleared: false,
      requiresCollection: false,
      detail:
        "The reported manual payment could not be verified by an administrator.",
      action:
        "Do not begin service until admin confirms a replacement payment.",
      paymentStatus,
      hasPaymentLink,
      hasMethodOnFile,
    };
  }

  if (
    booking?.payment_verification_status === "awaiting_verification"
  ) {
    return {
      label: "Payment Verification Pending",
      tone: "warning",
      cleared: false,
      requiresCollection: false,
      detail:
        "A Venmo, Zelle, or other manual payment is awaiting administrator verification.",
      action:
        "Contact admin for verification before beginning service.",
      paymentStatus,
      hasPaymentLink,
      hasMethodOnFile,
    };
  }

  if (paymentStatus === "failed") {
    const failureDetail =
      booking?.payment_failure_message ||
      (booking?.payment_failure_code
        ? `Payment provider failure code: ${booking.payment_failure_code}.`
        : "The payment provider reported an unsuccessful transaction attempt.");

    return {
      label: "Payment Failed",
      tone: "danger",
      cleared: false,
      requiresCollection: false,
      detail: failureDetail,
      action:
        "Do not begin service until a successful replacement payment is confirmed.",
      paymentStatus,
      hasPaymentLink,
      hasMethodOnFile,
    };
  }

  if (paymentStatus === "refunded") {
    return {
      label: "Payment Refunded",
      tone: "danger",
      cleared: false,
      requiresCollection: false,
      detail:
        "The payment connected to this service was returned to the customer.",
      action:
        "Contact admin before beginning service. A new payment may be required.",
      paymentStatus,
      hasPaymentLink,
      hasMethodOnFile,
    };
  }

  if (
    paymentStatus === "cancelled" ||
    lastStripeEvent === "checkout.session.expired"
  ) {
    return {
      label: "Checkout Not Completed",
      tone: "warning",
      cleared: false,
      requiresCollection: false,
      detail:
        "The customer did not complete the previous checkout session. This is not a failed transaction.",
      action:
        "Send a new checkout link or contact admin before service.",
      paymentStatus,
      hasPaymentLink,
      hasMethodOnFile,
    };
  }

  if (usesManualVerification) {
    return {
      label: "Manual Payment Needed",
      tone: "warning",
      cleared: false,
      requiresCollection: false,
      detail:
        "The selected payment method has not been received and verified yet.",
      action:
        "Contact admin before service so the payment can be verified.",
      paymentStatus,
      hasPaymentLink,
      hasMethodOnFile,
    };
  }

  if (hasPaymentLink) {
    return {
      label: "Checkout Sent",
      tone: "warning",
      cleared: false,
      requiresCollection: false,
      detail:
        "A checkout option exists, but payment has not been confirmed.",
      action:
        "Confirm payment or contact admin before beginning service.",
      paymentStatus,
      hasPaymentLink,
      hasMethodOnFile,
    };
  }

  if (paymentStatus === "pending") {
    return {
      label: "Payment Pending",
      tone: "warning",
      cleared: false,
      requiresCollection: false,
      detail:
        "Payment has started but has not been confirmed by the payment provider.",
      action:
        "Wait for confirmation or contact admin before beginning service.",
      paymentStatus,
      hasPaymentLink,
      hasMethodOnFile,
    };
  }

  return {
    label: hasMethodOnFile
      ? "Payment Method On File"
      : "Payment Required",
    tone: hasMethodOnFile ? "neutral" : "warning",
    cleared: false,
    requiresCollection: false,
    detail: hasMethodOnFile
      ? "A Stripe payment method is saved, but this visit has not been marked paid."
      : "No confirmed payment is attached to this visit.",
    action: hasMethodOnFile
      ? "Contact admin to confirm the charge before beginning service."
      : "Send checkout instructions or contact admin before service.",
    paymentStatus,
    hasPaymentLink,
    hasMethodOnFile,
  };
}
