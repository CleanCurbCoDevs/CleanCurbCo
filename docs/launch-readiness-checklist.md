# Clean Curb Co. Launch Readiness Checklist

## Resend and DNS

Verify these items in Resend before public launch:

- `cleancurbco.com` is added and verified in Resend.
- DKIM records for `cleancurbco.com` show as passing.
- SPF records allow the configured email provider.
- A DMARC TXT record exists for `cleancurbco.com`.
- Transactional sender matches the verified domain, for example `Clean Curb Co. <no-reply@cleancurbco.com>`.
- Customer replies route to `cleancurbco@stonebranchcapital.com`.
- Internal admin notifications route to `cleancurbco@stonebranchcapital.com` or another intentionally configured admin inbox.

## Vercel Monitoring

Verify these items in the Vercel project dashboard:

- Web Analytics is enabled for the Clean Curb Co. project.
- Speed Insights is enabled for the Clean Curb Co. project.
- The production domain is configured as `cleancurbco.com`.
- `NEXT_PUBLIC_SITE_URL` is set to `https://cleancurbco.com` for production.

## Environment Variables

Production should define:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_REPLY_TO_EMAIL`
- `ADMIN_NOTIFICATION_EMAIL`
- `NEXT_PUBLIC_SITE_URL`
