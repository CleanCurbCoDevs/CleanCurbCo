import { brand } from "@/lib/site";
import { publicPageMetadata } from "@/lib/seo";

export const metadata = publicPageMetadata({
  title: "Payment Policy",
  description:
    "Clean Curb Co. payment methods, checkout, recurring-service, refund, and billing policy.",
  path: "/payment-policy",
});

export default function PaymentPolicyPage() {
  return (
    <main>
      <section className="page-hero">
        <div className="container section-header">
          <p className="section-kicker">Payments</p>
          <h1>Payment & Billing Policy</h1>
          <p>
            How Clean Curb Co. handles card checkout, manual payment methods,
            recurring-service requests, adjustments, failed payments, and
            payment disputes.
          </p>
        </div>
      </section>

      <section className="section section-white">
        <div className="container legal-copy">
          <p className="muted">Effective date: July 18, 2026</p>

          <h2>1. Payment methods</h2>
          <p>
            Clean Curb Co. may offer payment by card through Stripe, Venmo
            Business, Zelle, pay-in-person, invoice, or another payment method
            expressly approved by us. Availability may vary by booking, service
            type, location, customer account, or operational needs.
          </p>

          <h2>2. Card payments and Stripe Checkout</h2>
          <p>
            When card payment is selected during booking, the estimated booking
            total is collected through secure Stripe Checkout after the booking
            details are saved. Clean Curb Co. does not receive or store your full
            card number or card security code on its own servers.
          </p>
          <p>
            Digital-wallet options such as Apple Pay or Google Pay may appear
            when supported by Stripe, your device, browser, account, and payment
            method. Their availability is not guaranteed.
          </p>

          <h2>3. Manual payment methods</h2>
          <p>
            Venmo Business, Zelle, pay-in-person, and other externally handled
            payments require manual confirmation. Selecting one of these methods
            does not mean that payment has been received. A booking remains
            unpaid until Clean Curb Co. receives and verifies the payment.
          </p>

          <h2>4. Booking date and route confirmation</h2>
          <p>
            Payment does not guarantee the exact service date requested.
            Service dates depend on collection schedules, route availability,
            weather, equipment availability, access, safety, and other
            operational factors. We may propose a different service date or
            route window.
          </p>
          <p>
            If we cannot reasonably provide the purchased service, we may offer
            rescheduling, account credit, modification of the booking, or a
            refund as appropriate under this policy and our Cancellation &
            Refund Policy.
          </p>

          <h2>5. Estimates and final pricing</h2>
          <p>
            Booking-form totals are based on the information submitted by the
            customer. The total may include the selected bin count, service
            frequency, fixed-price add-ons, and an applicable promotion.
          </p>
          <p>
            Services marked as “starting at,” conditions requiring additional
            labor, inaccurate bin counts, excessive buildup, inaccessible
            service areas, or customer-requested changes may affect the final
            price. We will not knowingly add an additional amount to the
            original booking charge without customer approval, except where a
            charge was already clearly disclosed and authorized under the
            booking terms or Cancellation & Refund Policy.
          </p>

          <h2>6. Recurring-service requests</h2>
          <p>
            Selecting Monthly, Every Other Month, Quarterly, or another
            recurring frequency tells us how often you are requesting service.
            The initial Stripe Checkout transaction is payment for the initial
            booking or service visit shown during checkout. Selecting a
            recurring frequency does not, by itself, guarantee a particular
            future route date.
          </p>
          <p>
            Future recurring visits may be billed through a saved payment
            method, a Stripe payment link, an invoice, a manually verified
            payment, or another billing arrangement separately confirmed with
            the customer. Before initiating future automatic charges, we may
            require additional payment-method setup or recurring-payment
            authorization.
          </p>
          <p>
            Customers may request to pause or cancel future recurring service
            through the customer portal when available, by email, or by phone.
            Cancellation of future service does not automatically reverse a
            payment for a visit that has already occurred or a charge otherwise
            permitted by the Cancellation & Refund Policy.
          </p>

          <h2>7. Saved payment methods</h2>
          <p>
            If you separately authorize a payment method to be stored for future
            use, Stripe may retain a token or payment-method identifier under
            Stripe&apos;s security, privacy, and payment-processing practices.
            Clean Curb Co. may receive limited information such as the payment
            method type, brand, expiration date, and last four digits.
          </p>
          <p>
            A saved payment method will be used only for amounts authorized
            under an approved booking, recurring-service arrangement, invoice,
            customer-requested change, or other disclosed payment obligation.
          </p>

          <h2>8. Promotions and discounts</h2>
          <p>
            Promotions may have eligibility rules, expiration dates, service
            requirements, geographic limits, frequency requirements, customer
            limits, and other restrictions. We may correct an incorrectly
            applied promotion before performing service or charging an
            additional amount. We will communicate any material correction to
            the customer.
          </p>

          <h2>9. Failed, cancelled, or incomplete payments</h2>
          <p>
            If checkout is cancelled, expires, or fails, the booking may remain
            saved, but it is not considered paid. We may provide a replacement
            payment link, request another payment method, pause scheduling,
            withhold service, or cancel the unpaid booking.
          </p>
          <p>
            Customers are responsible for providing valid payment information
            and resolving failed or disputed payments associated with completed
            or properly scheduled services.
          </p>

          <h2>10. Refunds, credits, and rescheduling</h2>
          <p>
            Refunds, credits, re-cleans, skipped visits, service-date changes,
            customer cancellations, inaccessible bins, missed service, and
            operational cancellations are handled under our Cancellation &
            Refund Policy.
          </p>
          <p>
            Approved card refunds are generally returned to the original payment
            method. Processing times are controlled by Stripe, the card network,
            and the customer&apos;s financial institution.
          </p>

          <h2>11. Tips</h2>
          <p>
            Tips are optional. A tip is separate from the service amount and
            does not change the scope of service, scheduling priority, or
            satisfaction-policy eligibility. Tips may be recorded separately
            from the underlying service payment.
          </p>

          <h2>12. Taxes and government charges</h2>
          <p>
            Applicable taxes or government-required charges may be added when
            legally required. Any known required amount will be displayed or
            otherwise disclosed through checkout, invoice, confirmation, or
            receipt.
          </p>

          <h2>13. Chargebacks and payment disputes</h2>
          <p>
            If you believe a charge is incorrect, please contact us promptly so
            we can investigate. We may use booking records, customer
            acknowledgments, payment records, communications, route records,
            service checklists, photographs, invoices, and other relevant
            documentation when responding to a chargeback, fraud claim, or
            payment dispute.
          </p>

          <h2>14. Policy changes</h2>
          <p>
            We may update this policy as our payment methods, service offerings,
            or legal obligations change. The effective date shown above
            identifies the current published version. Material changes affecting
            an existing recurring-payment arrangement will be communicated when
            required.
          </p>

          <h2>15. Contact</h2>
          <p>
            Payment or billing questions can be sent to{" "}
            <a href="mailto:billing@cleancurbco.com">
              billing@cleancurbco.com
            </a>{" "}
            or <a href={brand.emailHref}>{brand.email}</a>. You may also call{" "}
            <a href={brand.phoneHref}>{brand.phone}</a>.
          </p>

          <p className="muted">{brand.legalNote}</p>
        </div>
      </section>
    </main>
  );
}
