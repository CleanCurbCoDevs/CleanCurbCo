export function getPublicSupabaseEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  };
}

export function isSupabaseConfigured() {
  const { url, anonKey } = getPublicSupabaseEnv();
  return Boolean(url && anonKey && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "https://cleancurbco.com"
  );
}

function splitEmails(value?: string) {
  return (value ?? "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

function uniqueEmails(emails: string[]) {
  return Array.from(new Set(emails.map((email) => email.trim()).filter(Boolean)));
}

const ownerNotificationEmails = [
  "pkarasiewicz@stonebranchcapital.com",
  "bdecker@stonebranchcapital.com",
  "jdoms@stonebranchcapital.com",
];

export function getResendEnv() {
  const replyTo =
    process.env.RESEND_REPLY_TO_EMAIL ??
    process.env.RESEND_REPLY_TO ??
    "contact@cleancurbco.com";
  const adminEmails = uniqueEmails([
    ...splitEmails(process.env.ADMIN_NOTIFICATION_EMAILS),
    ...splitEmails(process.env.ADMIN_NOTIFICATION_EMAIL),
    ...splitEmails(process.env.ADMIN_EMAILS),
    ...ownerNotificationEmails,
  ]);

  return {
    apiKey: process.env.RESEND_API_KEY ?? "",
    from:
      process.env.RESEND_FROM_EMAIL ??
      "Clean Curb Co. <no-reply@cleancurbco.com>",
    replyTo,
    adminEmails: adminEmails.length ? adminEmails : [replyTo],
  };
}

export function isResendConfigured() {
  const { apiKey, from } = getResendEnv();
  return Boolean(apiKey && from);
}

export function getStripeEnv() {
  return {
    secretKey: process.env.STRIPE_SECRET_KEY ?? "",
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
    currency: (process.env.STRIPE_CURRENCY ?? "usd").toLowerCase(),
  };
}

export function isStripeConfigured() {
  const { secretKey, publishableKey } = getStripeEnv();
  return Boolean(secretKey && publishableKey);
}

export function isStripeWebhookConfigured() {
  const { secretKey, webhookSecret } = getStripeEnv();
  return Boolean(secretKey && webhookSecret);
}

export function getTurnstileEnv() {
  return {
    siteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",
    secretKey: process.env.TURNSTILE_SECRET_KEY ?? "",
  };
}
