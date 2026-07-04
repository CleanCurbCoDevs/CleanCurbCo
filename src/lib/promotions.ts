export const america250Promotion = {
  id: "america250",
  code: "AMERICA250",
  name: "America 250 Deal",
  shortName: "America 250",
  headline:
    "Today and tomorrow only: save 25% on eligible recurring service.",
  banner:
    "America 250 Deal: Save 25% on eligible recurring service — and yes, it stacks with the Founding Neighbor Special.",
  detailsHref: "/promotions/america-250",
  bookingHref: "/book?promo=america250",
  discountPercent: 25,
  recurringVisitLimit: 3,
  timezone: "America/New_York",
  startsAtIso: "2026-07-04T04:00:00.000Z",
  endsAtIso: "2026-07-06T03:59:59.999Z",
  validDatesLabel: "July 4–5, 2026",
  deadlineLabel: "July 5, 2026 at 11:59 PM ET",
};

export function isAmerica250PromoActive(now = new Date()) {
  const startsAt = new Date(america250Promotion.startsAtIso);
  const endsAt = new Date(america250Promotion.endsAtIso);

  return now >= startsAt && now <= endsAt;
}

export function america250PromoInternalNote(now = new Date()) {
  if (!isAmerica250PromoActive(now)) return null;

  return [
    `${america250Promotion.code} promo claimed.`,
    `Submitted during ${america250Promotion.validDatesLabel}.`,
    `${america250Promotion.discountPercent}% off eligible recurring base visit pricing for first ${america250Promotion.recurringVisitLimit} paid recurring visits.`,
    "Stacks with Founding Neighbor Special when eligible.",
    "Confirm final promo eligibility before charging.",
  ].join(" ");
}