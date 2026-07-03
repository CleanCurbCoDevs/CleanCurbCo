import { brand } from "@/lib/site";
import { publicPageMetadata } from "@/lib/seo";

export const metadata = publicPageMetadata({
  title: "Cancellation & Refund Policy",
  description: "Clean Curb Co. cancellation, rescheduling, and refund policy.",
  path: "/cancellation-refund-policy",
});

export default function CancellationRefundPolicyPage() {
  return (
    <main>
      <section className="page-hero">
        <div className="container section-header">
          <p className="section-kicker">Cancellations & Refunds</p>
          <h1>Cancellation, Rescheduling & Refund Policy</h1>
          <p>
            Clear rules for booking changes, recurring plan pauses, skipped
            visits, late cancellations, and refunds.
          </p>
        </div>
      </section>

      <section className="section section-white">
        <div className="container legal-copy">
          <p className="muted">Effective date: July 2, 2026</p>

          <h2>1. Purpose</h2>
          <p>
            Clean Curb Co. is a route-based service. Route planning, staffing,
            equipment prep, travel time, water use, and service windows are
            affected when a customer cancels, reschedules, changes services, or
            does not have bins ready. This policy explains how we handle those
            situations.
          </p>

          <h2>2. No charge before route confirmation</h2>
          <p>
            During normal launch-stage booking, saving a card or submitting a
            booking request does not mean you are immediately charged. Unless we
            clearly disclose otherwise at checkout, your card should not be
            charged until your route or service is confirmed. If we cannot serve
            your area, cannot confirm your route, or delay launch before
            confirmation, we will not charge you for unperformed service. If a
            payment has already been collected for a visit we cannot confirm or
            perform, we will either issue a full refund for that unperformed
            visit or communicate with you to reschedule service.
          </p>

          <h2>3. How to cancel or reschedule</h2>
          <p>
            You may request a cancellation, reschedule, service change, pause,
            or frequency change through the customer portal, by replying to our
            service message, by emailing us, or by calling us. A request is not
            fully effective until received and processed by us, unless the
            customer portal confirms the change automatically.
          </p>

          <h2>4. Before a route is confirmed</h2>
          <p>
            You may cancel a pending booking request before route confirmation
            without a cancellation fee. If no charge has been made, there is
            nothing to refund.
          </p>

          <h2>5. More than 24 hours before confirmed service</h2>
          <p>
            If your service has been confirmed and you cancel or reschedule more
            than 24 hours before the scheduled route window, we generally will
            not charge a cancellation or rescheduling fee. If you prepaid, we
            may issue a refund, credit, or reschedule depending on the payment
            terms shown at checkout.
          </p>

          <h2>6. Within 24 hours of confirmed service</h2>
          <p>
            If you cancel, reschedule, pause, reduce service, or change a
            confirmed visit within 24 hours of the scheduled route window, we
            may charge up to the full original visit price. This is because the
            route may already be planned, staffing and equipment may already be
            prepared, and your stop may affect the entire route.
          </p>
          <p>
            We may choose to waive or reduce a late-cancellation charge at our
            discretion, especially for emergencies or launch-stage situations,
            but we are not required to do so unless required by law.
          </p>

          <h2>7. Bins not ready, inaccessible, or unsafe</h2>
          <p>
            If we arrive or prepare to serve your stop and bins are full,
            blocked, missing, locked behind a gate, not at the agreed location,
            unsafe to clean, contaminated with hazardous materials, or otherwise
            inaccessible, the visit may be treated as a late cancellation or
            missed service. We may charge up to the full visit price and, if
            appropriate, offer a paid or complimentary reschedule at our
            discretion.
          </p>

          <h2>8. Weather, safety, equipment, or company delays</h2>
          <p>
            We may delay, reschedule, or cancel service due to severe weather,
            lightning, unsafe road conditions, equipment issues, staffing,
            water restrictions, route problems, illness, emergencies, or other
            operational reasons. If we cancel or reschedule for our own
            operational reasons before performing service, you will not be
            charged for that unperformed visit if you have not already been
            charged. If payment has already been collected for that visit, we
            will either issue a full refund for the unperformed visit or
            communicate with you to reschedule service. If we cannot reach you,
            cannot reasonably reschedule, or you decline rescheduling, we will
            refund the amount paid for that unperformed visit unless a different
            resolution is required or allowed by law.
          </p>

          <h2>9. Recurring plans</h2>
          <p>
            You may request to cancel, pause, or change a recurring plan through
            the customer portal or by contacting us. A recurring plan change
            generally applies to future visits. If the request is received
            within 24 hours of a confirmed visit, the current visit may still be
            charged under this policy.
          </p>
          <p>
            Canceling a recurring plan does not automatically refund completed
            services, missed visits caused by inaccessible bins, late
            cancellations, or prior amounts owed.
          </p>

          <h2>10. Refunds after service is performed</h2>
          <p>
            Because bin cleaning is a completed service once performed, refunds
            are not automatic after service is completed. If you believe there
            was a service issue, please contact us as soon as possible with a
            description and any photos. We may, at our discretion, offer a
            re-clean, service credit, partial refund, full refund, or another
            reasonable resolution.
          </p>

          <h2>11. Promotions and launch specials</h2>
          <p>
            Promotional offers, launch specials, coupons, credits, and discounts
            may have separate terms. Unless required by law or stated in the
            offer, promotional credits have no cash value and may not be
            refundable or transferable.
          </p>

          <h2>12. Refund processing</h2>
          <p>
            Approved refunds are usually returned to the original payment
            method. Processing times depend on the payment processor, card
            network, and bank. Processor fees, if any, may not always be
            returned to us and may affect refund handling where permitted by
            law.
          </p>

          <h2>13. Legal cancellation rights</h2>
          <p>
            This policy does not limit any non-waivable consumer cancellation,
            refund, cooling-off, or notice rights that may apply to a specific
            transaction. If a sale is made in a way that gives you a legal right
            to cancel, we will honor applicable non-waivable rights.
          </p>

          <h2>14. Contact</h2>
          <p>
            Cancellation, rescheduling, refund, or billing questions can be sent
            to <a href={brand.emailHref}>{brand.email}</a> or handled by calling{" "}
            <a href={brand.phoneHref}>{brand.phone}</a>.
          </p>

          <p className="muted">{brand.legalNote}</p>
        </div>
      </section>
    </main>
  );
}
