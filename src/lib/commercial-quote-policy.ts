export const COMMERCIAL_TAX_CENTS =
  0;

export const COMMERCIAL_SCHEDULING_DEPOSIT_PERCENT =
  10;

export const COMMERCIAL_SCHEDULING_DEPOSIT_RATE =
  COMMERCIAL_SCHEDULING_DEPOSIT_PERCENT /
  100;

export const COMMERCIAL_ADDITIONAL_PRE_SERVICE_DUE_BUSINESS_DAYS =
  3;

export const commercialTotalPreServicePercents = [
  10,
  30,
  40,
  50,
] as const;

export type CommercialTotalPreServicePercent =
  (typeof commercialTotalPreServicePercents)[number];

export type CommercialDepositTierSource =
  | "automatic"
  | "override";

export type CommercialPaymentSchedule = {
  basePriceCents: number;

  schedulingDepositPercent: 10;
  totalPreServicePercent:
    CommercialTotalPreServicePercent;

  additionalPreServicePercent: number;
  completionBalancePercent: number;

  schedulingDepositCents: number;
  additionalPreServiceCents: number;
  totalPreServiceCents: number;
  completionBalanceCents: number;

  additionalPreServiceDueBusinessDays:
    number;

  fullPaymentAllowed: true;
  source: CommercialDepositTierSource;
};

const LEGACY_COMMERCIAL_PAYMENT_TERMS =
  "Payment terms will be confirmed before service is scheduled.";

export const COMMERCIAL_DEFAULT_PAYMENT_TERMS =
  "After the quote is approved, Clean Curb Co. will provide the Commercial Work Agreement and applicable policies through DocuSign. After both parties sign, the customer may pay the 10% scheduling deposit, the full required pre-service amount shown in this quote, or the entire quoted price. Any additional pre-service payment is due no later than three business days before service begins. If service is scheduled to begin fewer than three business days after signing, the full required pre-service amount is due at signing. All payments are credited toward the quoted price and are not additional fees. Net 30 is available only to approved recurring commercial accounts or customers operating under separately approved procurement terms.";

export const COMMERCIAL_PAYMENT_AND_REFUND_SUMMARY =
  "The first 10% of the quoted price is the scheduling deposit required to reserve service. It is generally nonrefundable when cancellation or failure to proceed is caused by the customer, but it is refunded when Clean Curb Co. cannot perform for a reason within its responsibility or control. Amounts paid above the first 10% remain refundable until service begins. Once service begins, any refund is determined from the work performed, customer-specific costs already incurred, and the portion of the accepted scope affected.";

export const COMMERCIAL_SERVICE_CONCERN_SUMMARY =
  "Completed services are generally nonrefundable. Customers should report service concerns within three business days and must give Clean Curb Co. a reasonable opportunity to inspect and correct verified issues within its responsibility and control. Depending on the circumstances, an appropriate remedy may include corrective service, a service credit, or a partial or full refund. A complaint does not automatically create a right to a refund.";

export const COMMERCIAL_FULL_TERMS_NOTICE =
  "This quote summarizes the proposed scope, pricing, payment schedule, and key policies. Before any scheduling deposit is required, the complete Commercial Work Agreement, Commercial Service Policies, accepted quote, and any applicable addenda will be provided through DocuSign for review and signature.";

export const COMMERCIAL_PROJECT_SUPPORT_FOOTNOTE =
  "Project support and mobilization includes standard chemicals and consumable supplies, equipment use, travel, service preparation, administrative coordination, and other operating resources necessary to complete the quoted scope.";

export const COMMERCIAL_DEFAULT_PAYMENT_TERMS =
  "After the quote is approved, Clean Curb Co. will provide the Commercial Work Agreement and applicable policies through DocuSign. After both parties sign, the customer may pay the 10% scheduling deposit, the full required pre-service amount shown in this quote, or the entire quoted price. Any additional pre-service payment is due no later than three business days before service begins. If service is scheduled to begin fewer than three business days after signing, the full required pre-service amount is due at signing. All payments are credited toward the quoted price and are not additional fees. Net 30 is available only to approved recurring commercial accounts or customers operating under separately approved procurement terms.";

export const COMMERCIAL_TAX_DISPLAY_LABEL =
  "Tax";

export function isCommercialTotalPreServicePercent(
  value: number,
): value is CommercialTotalPreServicePercent {
  return commercialTotalPreServicePercents.includes(
    value as CommercialTotalPreServicePercent,
  );
}

export function getCommercialAutomaticTotalPreServicePercent(
  basePriceCents: number,
): CommercialTotalPreServicePercent {
  const normalizedBase =
    normalizeCents(basePriceCents);

  if (normalizedBase < 100_000) {
    return 10;
  }

  if (normalizedBase < 250_000) {
    return 30;
  }

  if (normalizedBase < 500_000) {
    return 40;
  }

  return 50;
}

export function calculateCommercialPaymentSchedule(
  basePriceCents: number,
  overridePercent:
    CommercialTotalPreServicePercent | null =
    null,
): CommercialPaymentSchedule {
  const basePrice =
    normalizeCents(basePriceCents);

  const totalPreServicePercent =
    overridePercent ??
    getCommercialAutomaticTotalPreServicePercent(
      basePrice,
    );

  const schedulingDepositCents =
    calculatePercentageCents(
      basePrice,
      COMMERCIAL_SCHEDULING_DEPOSIT_PERCENT,
    );

  const totalPreServiceCents =
    calculatePercentageCents(
      basePrice,
      totalPreServicePercent,
    );

  const additionalPreServiceCents =
    Math.max(
      0,
      totalPreServiceCents -
        schedulingDepositCents,
    );

  const completionBalanceCents =
    Math.max(
      0,
      basePrice -
        totalPreServiceCents,
    );

  return {
    basePriceCents:
      basePrice,

    schedulingDepositPercent:
      COMMERCIAL_SCHEDULING_DEPOSIT_PERCENT,

    totalPreServicePercent,

    additionalPreServicePercent:
      totalPreServicePercent -
      COMMERCIAL_SCHEDULING_DEPOSIT_PERCENT,

    completionBalancePercent:
      100 -
      totalPreServicePercent,

    schedulingDepositCents,
    additionalPreServiceCents,
    totalPreServiceCents,
    completionBalanceCents,

    additionalPreServiceDueBusinessDays:
      COMMERCIAL_ADDITIONAL_PRE_SERVICE_DUE_BUSINESS_DAYS,

    fullPaymentAllowed:
      true,

    source:
      overridePercent === null
        ? "automatic"
        : "override",
  };
}

export function calculateCommercialSchedulingDepositCents(
  basePriceCents: number,
) {
  return calculatePercentageCents(
    normalizeCents(basePriceCents),
    COMMERCIAL_SCHEDULING_DEPOSIT_PERCENT,
  );
}

/**
 * Kept for older callers while the tiered-payment
 * migration is rolled out. This means the amount
 * remaining after only the 10% scheduling deposit.
 */
export function calculateCommercialRemainingBalanceCents(
  basePriceCents: number,
) {
  return Math.max(
    0,
    normalizeCents(basePriceCents) -
      calculateCommercialSchedulingDepositCents(
        basePriceCents,
      ),
  );
}

export function resolveCommercialPaymentTerms(
  value: string | null | undefined,
) {
  const trimmed =
    value?.trim();

  if (
    !trimmed ||
    trimmed ===
      LEGACY_COMMERCIAL_PAYMENT_TERMS
  ) {
    return COMMERCIAL_DEFAULT_PAYMENT_TERMS;
  }

  return trimmed;
}

function calculatePercentageCents(
  basePriceCents: number,
  percent: number,
) {
  return Math.max(
    0,
    Math.round(
      normalizeCents(basePriceCents) *
        percent /
        100,
    ),
  );
}

function normalizeCents(
  value: number,
) {
  return Number.isFinite(value)
    ? Math.max(
        0,
        Math.round(value),
      )
    : 0;
}
