# Production Logging

Clean Curb Co. emits structured server-side JSON logs through `src/lib/server/logger.ts`.
These logs are written to `console.log`, `console.warn`, and `console.error`, so Vercel
Runtime Logs receive them automatically for server routes, server actions, and webhook
handlers.

The logger is intended for runtime diagnostics. It should include request IDs, action or
route names, safe entity IDs, status, and durations where useful. It must not include
passwords, service-role keys, Stripe secrets, Resend keys, Turnstile secrets, raw
Turnstile tokens, session tokens, full card data, CVC, or unnecessary customer PII.
Emails and phone numbers should be avoided or masked.

Admin/business history is separate from runtime logs. Server-side code writes durable
business audit records to `public.admin_audit_logs` for actions such as customer email
changes, customer profile updates, booking updates, service request handling, and
checklist submission. Customers cannot read those records; the table is selected only by
admin/internal roles and inserted by trusted server-side service-role code.

## Vercel Log Drains

Vercel Log Drains can later forward runtime logs to an external endpoint or integration
if the Vercel account plan supports it. That setup is a platform/account configuration
task, not an app-code requirement.

## Cloudflare Logpush and R2

Cloudflare Logpush can later push traffic, edge request, and security logs to Cloudflare
R2 if the domain is proxied through Cloudflare and the Cloudflare plan/features support
the selected dataset. Cloudflare Logpush to R2 is for Cloudflare edge/security logs; it
does not automatically capture Vercel app runtime logs.

If Clean Curb Co. later needs Vercel runtime logs stored in Cloudflare R2, the likely
architecture is:

1. Vercel Log Drain sends logs to a custom HTTPS endpoint.
2. A Cloudflare Worker receives the logs.
3. The Worker verifies signatures/auth, batches safely, and writes to an R2 bucket.
4. Retention and access policies are configured for the bucket.

That pipeline is intentionally not implemented here because it needs careful signature
verification, endpoint authentication, batching, failure handling, and retention rules.
