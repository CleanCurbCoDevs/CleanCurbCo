export function getLaunchStatusCopy() {
  return {
    status: "active" as const,
    kicker: "Route status",
    headline: "Now booking neighborhood route days.",
    body:
      "Submit your booking, choose your preferred payment method, and tell us your normal collection schedule. Your requested service date remains subject to route availability.",
    notice:
      "Now booking local route days. Choose your service and preferred payment method to get started.",
  };
}
