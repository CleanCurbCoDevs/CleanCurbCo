export const launchRouteStartIso = "2026-07-13T04:00:00.000Z";

export function getLaunchStatusCopy(now = new Date()) {
  const launchStart = new Date(launchRouteStartIso);
  const beforeLaunch = now < launchStart;

  if (beforeLaunch) {
    return {
      status: "pre_launch" as const,
      kicker: "Route launch timing",
      headline: "First route planned for July 13, 2026.",
      body:
        "Bookings before launch reserve your spot. You will not be charged until we are ready to confirm your route day and service/payment terms.",
      notice:
        "First route planned for July 13. Book now to reserve your spot — no charge until we are ready to confirm your service.",
    };
  }

  return {
    status: "active_launch" as const,
    kicker: "Route status",
    headline: "Now building neighborhood route days.",
    body:
      "Book now to get on the route list. We will confirm your service area, route day, final price, and payment timing before service.",
    notice:
      "Now building local route days. Book to get on the route list — no charge until service/payment terms are confirmed.",
  };
}