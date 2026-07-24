export const COMMERCIAL_SCHEDULING_DEPOSIT_PERCENT =
  10;

export const COMMERCIAL_SCHEDULING_DEPOSIT_RATE =
  COMMERCIAL_SCHEDULING_DEPOSIT_PERCENT /
  100;

const LEGACY_COMMERCIAL_PAYMENT_TERMS =
  "Payment terms will be confirmed before service is scheduled.";

export const COMMERCIAL_DEFAULT_PAYMENT_TERMS =
  "After the quote is approved, Clean Curb Co. will send the work agreement and applicable policies for electronic signature. Once both parties have signed, a 10% scheduling deposit is required before service is confirmed. The deposit is credited toward the service price. Unless different written terms are approved, the remaining balance for initial and one-time services is due upon completion. Net 30 is available only to approved recurring commercial accounts or customers operating under separately approved procurement terms.";

export const COMMERCIAL_DEPOSIT_POLICY_SUMMARY =
  "The 10% scheduling deposit is credited toward the service price. It is nonrefundable when service cannot proceed because of customer cancellation or another issue within the customer's responsibility or control. It is fully refundable when Clean Curb Co. cannot perform because of an issue within its responsibility or control. Weather and similar events outside either party's control are ordinarily handled through rescheduling.";

export function calculateCommercialSchedulingDepositCents(
  basePriceCents: number,
) {
  return Math.max(
    0,
    Math.round(
      Math.max(0, basePriceCents) *
        COMMERCIAL_SCHEDULING_DEPOSIT_RATE,
    ),
  );
}

export function calculateCommercialRemainingBalanceCents(
  basePriceCents: number,
) {
  return Math.max(
    0,
    Math.round(basePriceCents) -
      calculateCommercialSchedulingDepositCents(
        basePriceCents,
      ),
  );
}

export function resolveCommercialPaymentTerms(
  value: string | null | undefined,
) {
  const trimmed = value?.trim();

  if (
    !trimmed ||
    trimmed ===
      LEGACY_COMMERCIAL_PAYMENT_TERMS
  ) {
    return COMMERCIAL_DEFAULT_PAYMENT_TERMS;
  }

  return trimmed;
}
