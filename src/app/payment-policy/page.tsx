import type { Metadata } from "next";
import { brand } from "@/lib/site";

export const metadata: Metadata = {
  title: "Payment Policy",
  description: "Clean Curb Co. payment authorization and billing policy.",
};

export default function PaymentPolicyPage() {
  return (
    <main>
      <section className="page-hero">
        <div className="container section-header">
          <p className="section-kicker">Payments</p>
          <h1>Payment Authorization & Billing Policy</h1>
          <p>
            How Clean Curb Co. handles cards on file, route confirmation,
            recurring billing, failed payments, and payment disputes.
          </p>
        </div>
      </section>

      <section className="section section-white">
        <div className="container legal-copy">
          <p className="muted">Effective date: July 2, 2026</p>

          <h2>1. Card on file and launch-stage bookings</h2>
          <p>
            Clean Curb Co. may allow or require customers to save a payment
            method when submitting a booking request. Unless clearly stated
            otherwise at checkout, saving a card during launch-stage booking is
            an authorization for future confirmed service, not an immediate
            charge. Your card should not be charged until your route or service
            is confirmed.
          </p>

          <h2>2. Authorization to charge</h2>
          <p>
            By submitting payment information, approving checkout, accepting an
            invoice, choosing recurring service, or otherwise authorizing
            payment, you authorize Clean Curb Co., Stonebranch Capital LLC, and
            our payment processors to charge your payment method for confirmed
            services, recurring visits, add-ons, taxes, approved fees, late
            cancellation or missed-service charges, and other amounts you
            authorize under our Terms and policies.
          </p>

          <h2>3. Payment processors</h2>
          <p>
            Payments may be processed by Stripe or another payment provider. We
            do not store full card numbers on our own servers. Payment
            processors may store payment tokens, card details, billing details,
            transaction records, fraud signals, and related information under
            their own terms and privacy practices.
          </p>

          <h2>4. Estimates and final pricing</h2>
          <p>
            Booking form totals and website prices may be estimates. Final
            pricing may depend on bin count, service frequency, add-ons, access,
            service area, route availability, promotions, taxes, fees, and
            service details confirmed by text, email, invoice, checkout, or the
            customer portal. We may correct obvious pricing errors before
            charging or performing service.
          </p>

          <h2>5. Recurring service billing</h2>
          <p>
            If you enroll in monthly, every-other-month, quarterly, or another
            recurring plan, you authorize us to charge your saved payment method
            for each confirmed recurring visit until the plan is canceled or
            paused. Charges may occur before, on, or after the scheduled service
            date depending on the billing method used, but we will not knowingly
            charge for a visit we cannot confirm or perform unless the charge is
            allowed under our Cancellation & Refund Policy. If we collect
            payment for a confirmed visit that we later cancel or cannot perform
            for our own operational reasons, we will handle the payment under
            our refund-or-reschedule process.
          </p>

          <h2>6. Failed payments</h2>
          <p>
            If a payment fails, we may ask you to update your payment method,
            retry the payment, pause service, cancel future visits, withhold
            future service, or pursue collection of unpaid amounts. You are
            responsible for keeping your payment information current.
          </p>

          <h2>7. Chargebacks and payment disputes</h2>
          <p>
            If you believe a charge is incorrect, please contact us first so we
            can review the issue quickly. We may use booking records, route
            confirmations, service photos, service checklists, communications,
            invoices, and payment records to respond to chargebacks, disputes,
            fraud claims, or collection issues.
          </p>

          <h2>8. Taxes and fees</h2>
          <p>
            Prices may be subject to applicable taxes, card processing fees,
            platform fees, local charges, or other amounts where permitted or
            required. Any required taxes or fees may be shown at checkout,
            invoice, confirmation, or receipt.
          </p>

          <h2>9. Refunds and credits</h2>
          <p>
            Refunds, credits, re-cleans, skipped visits, late cancellations, and
            missed-service charges are handled under our Cancellation & Refund
            Policy. Approved refunds are generally issued to the original
            payment method when possible.
          </p>

          <h2>10. Contact</h2>
          <p>
            Payment or billing questions can be sent to{" "}
            <a href="mailto:billing@cleancurbco.com">
              billing@cleancurbco.com
            </a>{" "}
            or to <a href={brand.emailHref}>{brand.email}</a>. You may also call{" "}
            <a href={brand.phoneHref}>{brand.phone}</a>.
          </p>

          <p className="muted">{brand.legalNote}</p>
        </div>
      </section>
    </main>
  );
}
