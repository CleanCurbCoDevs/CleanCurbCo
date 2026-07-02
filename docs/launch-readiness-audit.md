# Clean Curb Co. Launch Readiness Audit

Date: July 2, 2026

## Scope Audited

Public and authenticated route surfaces were mapped from `src/app`, then smoke-tested locally. Live `https://www.cleancurbco.com` was also checked before remediation for public route availability and authenticated access behavior.

## Route Inventory

Public marketing routes:

- `/`
- `/services`
- `/pricing`
- `/service-area`
- `/faq`
- `/book`
- `/contact`
- `/careers`

Public legal/policy routes:

- `/privacy`
- `/terms`
- `/service-policy`
- `/payment-policy`
- `/cancellation-refund-policy`
- `/cookie-analytics-policy`
- `/communications-policy`
- `/accessibility`
- `/commercial-services-addendum`
- `/door-to-door-cancellation-notice`
- `/field-safety-policy`
- `/photo-media-release`
- `/vulnerability-disclosure`
- `/.well-known/security.txt`

Auth and account routes:

- `/login`
- `/employee-login`
- `/reset-password`
- `/account-setup`
- `/signup`
- `/payment-setup`

Customer portal routes:

- `/portal`
- `/portal/bookings`
- `/portal/manage-service`
- `/portal/subscription`
- `/portal/account`
- `/portal/photos`
- `/portal/billing`
- `/portal/referrals`

Admin routes:

- `/admin`
- `/admin/bookings`
- `/admin/customers`
- `/admin/customers/[id]`
- `/admin/payments`
- `/admin/services`
- `/admin/referrals`
- `/admin/routes`
- `/admin/checklists`
- `/admin/checklists/[visitId]`
- `/admin/settings`
- `/admin/requests`
- `/admin/careers`
- `/admin/reviews`

Field/employee routes:

- `/field` redirects to `/field/today`
- `/field/today`
- `/field/routes`
- `/field/breaks`
- `/field/history`
- `/field/stops/[visitId]`

API routes:

- `/api/auth/login`
- `/api/auth/logout`
- `/api/auth/reset-password`
- `/api/auth/update-password`
- `/api/account-setup`
- `/api/bookings`
- `/api/contact`
- `/api/stripe/create-checkout-session`
- `/api/stripe/create-payment-setup-session`
- `/api/stripe/webhook`

Metadata/system routes:

- `/robots.txt`
- `/sitemap.xml`
- `/manifest.webmanifest`
- Open Graph/Twitter/app icon metadata files under `src/app`

Error/protection routes:

- `forbidden.tsx` for 403 role failures
- `unauthorized.tsx` for 401-style session failures

## Confirmed Issues Found

- Authenticated live smoke before remediation showed a customer session could request `/admin` and `/field/today` and receive HTTP 200 soft-forbidden pages. Local remediation now returns real 403 responses for role failures.
- `/api/auth/login` used a shallow `startsWith("/")` redirect check. It did not centrally reject encoded external URLs, double-encoded external URLs, backslash tricks, unsafe nested redirect params, or dot-segment path normalization.
- `next.config.ts` had no baseline security headers and no `X-Robots-Tag` noindex headers for private/auth/API routes.
- `robots.txt` only disallowed `/admin`, `/portal`, and `/field`, leaving auth, account setup, payment setup, and API paths undisclosed.
- `sitemap.xml` omitted public legal/policy pages and careers.
- Public contact/booking/careers forms lacked a consistent honeypot + rate-limit layer. Booking already had Turnstile server validation.
- Password reset invalid email responses could reveal validation differences instead of always returning the generic reset message.
- The contact API echoed the saved contact record back to the client even though the UI only needed a success message.
- Turnstile widget logged token metadata to the browser console.
- The admin notification dropdown had hidden off-screen action boxes in layout metrics until explicitly hidden when closed.
- A public `security.txt` and vulnerability disclosure page were missing.
- Shared legal footer wording still used inconsistent DBA phrasing.

## Fixes Implemented

- Added a centralized redirect sanitizer in `src/lib/security/redirects.ts`.
- Updated role path checks and Stripe return path handling to use sanitized internal redirects.
- Added reusable server request guards in `src/lib/server/request-guards.ts`.
- Hardened login/reset/update-password/logout/account-setup/contact/booking/Stripe setup/Stripe checkout POST routes with same-origin checks where appropriate.
- Added rate limiting for login, reset, update-password, account setup, contact, booking, and careers submissions.
- Added honeypot fields to booking, contact, and careers forms.
- Made password reset request responses generic for malformed or unknown emails.
- Changed admin/field role failures from soft 200 pages to Next.js `forbidden()` 403 responses.
- Added branded `forbidden.tsx` and `unauthorized.tsx` pages.
- Added baseline security headers and noindex headers in `next.config.ts`.
- Expanded `robots.ts` private disallow rules.
- Expanded `sitemap.ts` public/legal route coverage and kept private/auth routes excluded.
- Added `/.well-known/security.txt`.
- Added `/vulnerability-disclosure`.
- Added footer links for Service Policy, Payment Policy, Cancellation & Refunds, Cookie & Analytics, and Security.
- Removed client-side Turnstile token metadata logging and improved verification loading/failure copy.
- Added login/reset autocomplete hints.
- Added `scripts/launch-readiness-smoke.mjs` and `npm run smoke:launch`.

## Validation Notes

- Local launch smoke passed against `http://localhost:3000`.
- Customer credentials can access customer portal routes locally.
- Customer credentials receive 403 for `/admin`, `/admin/bookings`, and `/field/today` locally.
- Admin credentials can access admin and field routes locally.
- Bad `next` values fall back to `/admin` for admin login locally.
- Responsive DOM metrics showed no page-level horizontal overflow and no visible off-screen action controls at 360, 390, 430, 768, 1024, 1280, and 1440 widths for sampled public, customer, admin, and field pages.
- Browser console check after local visual pass showed no warnings/errors.

## Remaining Manual Review

- MFA/passkey enforcement for admin/owner users is not implemented in this pass. Supabase MFA policy/UX should be planned as a separate auth project.
- Technician data scoping still depends on the current field-role model and RLS policies. A separate technician account was not supplied for this audit, and route assignment-only enforcement should be revisited before adding more field staff.
- Legal pages should receive counsel/business review before launch. Some older legal copy still contains smart-quote encoding artifacts that should be cleaned as a copy-edit pass.
- Cloudflare/Vercel production security headers, robots, sitemap, and 403 behavior must be rechecked after deployment because live production still reflects the previous build until this branch is deployed.
- Vercel Analytics and Speed Insights are present. Cookie/analytics policy language should be reviewed against the final production analytics/consent posture.
- Image optimization warnings remain for field stop photos and portal photos where `<img>` is used for Supabase signed URLs.
