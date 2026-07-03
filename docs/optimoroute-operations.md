# OptimoRoute Operations Guide

Clean Curb Co. remains the customer-facing app, admin app, field/iPad app, and source of truth for customers, bookings, route stops, service status, payment status, notes, photos, checklists, and follow-up.

OptimoRoute is only a supplemental routing brain. It receives eligible Clean Curb Co. stops, optimizes route order/timing, and sends scheduling data back for admin review and field display.

## Customer Notifications

The first-pass integration does not enable OptimoRoute customer-facing tools.

Clean Curb Co. does not trigger OptimoRoute customer texts, emails, tracking links, proof-of-delivery messages, feedback requests, or a driver-app workflow. Synced orders are sent with `notificationPreference: "dont_notify"`.

## Expected Environment

`OPTIMOROUTE_API_KEY` must be set server-side only. The app trims leading/trailing whitespace before using it.

If OptimoRoute returns `AUTH_KEY_UNKNOWN`, check the Vercel environment value and confirm the key is enabled in OptimoRoute under Settings -> WS API.

## Required OptimoRoute Account Setup

Before a route can optimize successfully, verify OptimoRoute has:

- At least one driver available for the route date.
- Driver work hours for that date.
- Correct account timezone.
- Driver start/depot location and end location where required.
- Vehicle/route settings that allow the planned work.
- A route date that is schedulable, preferably a future date rather than today after the workday has passed.

If Clean Curb Co. imports `0 scheduled / N unscheduled`, the most likely cause is OptimoRoute resource/date setup rather than API authentication.

## Sync Eligibility Rules

A route stop is eligible by default when:

- It belongs to the selected route day.
- It has a linked booking and service visit.
- It has a usable service address.
- The booking is approved/ready for routing.
- The booking/stop/service visit is not cancelled.
- The stop/service visit is not already completed.
- Clean Curb Co. payment/service clearance says it is cleared for service.

A stop is skipped when it is missing an address, missing booking/visit, cancelled, already completed, not approved, payment required, payment pending, payment failed, or outside the selected route date.

Admin overrides can intentionally include payment-held or not-approved stops from `/admin/routes`. That sends the stop to OptimoRoute for routing only; Clean Curb Co. still decides whether the customer is serviceable in the field app.

If a duration is not stored on the stop, Clean Curb Co. calculates a service duration from bin count and add-ons, clamped between 15 and 45 minutes.

## Admin Workflow

Use `/admin/routes`:

1. Create or select a route day.
2. Add 3-5 test stops.
3. Prefer a future route date.
4. Include a mix of:
   - Cleared for Service.
   - Payment Required.
   - Payment Link Sent.
   - Follow-Up Required or Payment Failed.
   - Normal ready stop.
5. Click **Test Connection** to confirm OptimoRoute accepts the API key.
6. Review eligibility and skipped reasons.
7. Click **Sync Stops**.
8. Confirm the stops appeared in OptimoRoute with `CCC-{routeStopId}` order numbers.
9. Click **Start Optimization**.
10. Click **Check Status** until status is finished.
11. Click **Import Optimized Route**.
12. Open `/field/today` for that date and confirm optimized order/timing is displayed when available.
13. Confirm each field stop still shows Clean Curb Co. payment/service clearance.

If import is blocked, planning is not finished yet. If import returns unscheduled stops, check driver availability, work hours, route date, timezone, depot/start location, vehicle settings, address quality, and stop constraints.

## Field Fallback Behavior

The field app works without OptimoRoute. Stop ordering fallback is:

1. Imported OptimoRoute optimized stop sequence.
2. Clean Curb Co. manual route stop order.
3. Created-time fallback ordering.

The field app still shows Clean Curb Co. statuses when OptimoRoute is missing, planning fails, import fails, no stops are scheduled, only some stops are scheduled, or the API key is missing.

OptimoRoute never decides whether a customer is cleared for service. Clean Curb Co. continues to show Cleared for Service, Payment Required, Payment Link Sent, Payment Failed, Follow-Up Required, Service Hold, and skipped/payment follow-up states.

## Database Expectations

The integration expects these route-day columns:

- `route_days.optimoroute_planning_id`
- `route_days.optimoroute_planning_status`
- `route_days.optimoroute_planning_error`
- `route_days.optimoroute_last_planned_at`
- `route_days.optimoroute_last_imported_at`

It expects these route-stop columns:

- `route_stops.optimoroute_order_no`
- `route_stops.optimoroute_order_id`
- `route_stops.optimoroute_sync_status`
- `route_stops.optimoroute_sync_error`
- `route_stops.optimoroute_last_synced_at`
- `route_stops.optimoroute_planning_status`
- `route_stops.optimoroute_scheduled_at`
- `route_stops.optimoroute_stop_sequence`
- `route_stops.optimoroute_route_id`
- `route_stops.optimoroute_driver_name`
- `route_stops.optimoroute_eta`
- `route_stops.optimoroute_travel_time_seconds`
- `route_stops.optimoroute_distance_meters`

No additional RLS changes are required if the existing route policies are applied: admins manage route days/stops, field users can read/manage route data for field workflows, and customers do not read route stop metadata directly. Admin-only OptimoRoute API routes also enforce server-side admin/owner authorization, same-origin request guards, and rate limiting.

## Stripe Return Pages

Stripe Checkout and payment setup endpoints return to branded Clean Curb Co. pages:

- Payment setup success/cancel: `/payment-setup/success`
- Billing/payment success/cancel: `/billing/success`

If Stripe shows a generic completion page, update the Stripe Checkout Session success/cancel URLs or any dashboard-hosted Payment Link return configuration to point back to these Clean Curb Co. routes.

## Field PWA

The public manifest remains `/manifest.webmanifest` for Clean Curb Co.

The field app uses `/field/manifest.webmanifest`, app name `CCC Field`, `start_url` `/field/today`, standalone display mode, theme color metadata, Apple web app metadata, and 180/192/512 icons. Install the PWA from `/field/today` on iPad Safari so it saves as `CCC Field`.

## Founding Neighbor Special

The current eligibility rule lives in `src/lib/pricing.ts`.

Current behavior: the special is enabled for qualifying recurring two-bin Cane Bay founding-route customers before the configured cutoff date. Admin/payment views display whether the special is eligible/applied/not eligible and the reason. Josh should confirm the final cutoff date and neighborhood list before launch.

## Analytics and Cookies

The implemented analytics stack is Vercel Analytics and Vercel Speed Insights in `src/app/layout.tsx`.

No Google Analytics, Meta pixel, Nextdoor pixel, or other marketing pixel was found in code during this pass. If marketing pixels are added later, the Cookie & Analytics Policy and consent/preference flow should be revisited.

## Admin MFA / Customer MFA

Customer MFA is intentionally not implemented for launch. Customer login stays simple with rate limits, generic errors, guarded redirects, and secure session handling.

Admin/owner MFA or passkeys should be a future dedicated security project before operational scale. Current launch stance depends on very limited admin users, strong passwords, rate limits, route protection, and session security.
