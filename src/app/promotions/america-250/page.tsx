import type { Metadata } from "next";
import Link from "next/link";
import { america250Promotion } from "@/lib/promotions";
import { brand } from "@/lib/site";

export const metadata: Metadata = {
  title: "America 250 Deal Promotion Details",
  description:
    "Full terms and details for the Clean Curb Co. America 250 Deal.",
};

export default function America250PromotionPage() {
  return (
    <main>
      <section className="page-hero">
        <div className="container section-header">
          <p className="section-kicker">Promotion Details</p>
          <h1>{america250Promotion.name}</h1>
          <p>
            Full terms for the limited Clean Curb Co. America 250 promotion.
            Please read carefully before booking.
          </p>

          <div className="action-row">
            <Link className="button button-primary" href={america250Promotion.bookingHref}>
              Book with America 250 Deal
            </Link>
            <Link className="button button-outline" href="/pricing">
              View Regular Pricing
            </Link>
          </div>
        </div>
      </section>

      <section className="section section-cream">
        <div className="container promo-terms-layout">
          <article className="promo-terms-card promo-terms-featured">
            <p className="section-kicker">Offer Summary</p>
            <h2>Save 25% on eligible recurring service.</h2>
            <p>
              The America 250 Deal gives eligible customers{" "}
              <strong>{america250Promotion.discountPercent}% off eligible recurring base visit pricing</strong>{" "}
              for the first{" "}
              <strong>{america250Promotion.recurringVisitLimit} paid recurring visits</strong>.
              This promotion may stack with the Founding Neighbor Special when
              the customer and booking qualify for both promotions.
            </p>
          </article>

          <article className="promo-terms-card">
            <h2>Promotion window</h2>
            <ul>
              <li>
                The promotion is available only for eligible booking requests
                submitted during <strong>{america250Promotion.validDatesLabel}</strong>.
              </li>
              <li>
                Booking request must be submitted by{" "}
                <strong>{america250Promotion.deadlineLabel}</strong>.
              </li>
              <li>
                Clean Curb Co. uses Eastern Time for the promotion deadline.
              </li>
              <li>
                Submitting a booking request does not guarantee service,
                route availability, or final promotional eligibility until Clean
                Curb Co. confirms the booking.
              </li>
            </ul>
          </article>

          <article className="promo-terms-card">
            <h2>Eligible services</h2>
            <ul>
              <li>Eligible recurring residential bin-cleaning services only.</li>
              <li>
                Eligible recurring frequencies may include monthly,
                every-other-month, or quarterly residential service.
              </li>
              <li>
                One-time cleanings are not eligible for the America 250 recurring
                discount.
              </li>
              <li>
                Commercial services, municipal services, HOA contract pricing,
                custom jobs, full pressure washing, and starting-at services are
                excluded unless Clean Curb Co. approves otherwise in writing.
              </li>
            </ul>
          </article>

          <article className="promo-terms-card">
            <h2>How the 25% discount works</h2>
            <ul>
              <li>
                The discount applies to eligible recurring base visit pricing only.
              </li>
              <li>
                The discount applies to the first{" "}
                <strong>{america250Promotion.recurringVisitLimit} paid recurring visits</strong>{" "}
                after the booking is confirmed.
              </li>
              <li>
                The discount does not apply to add-ons, extra bins beyond the
                base included amount, taxes, processing fees, late fees,
                cancellation fees, special trip fees, urgent service fees, custom
                services, or other non-base-service charges.
              </li>
              <li>
                Final price, discount amount, route day, and payment timing are
                confirmed before service/payment terms are finalized.
              </li>
            </ul>
          </article>

          <article className="promo-terms-card">
            <h2>Stacking with the Founding Neighbor Special</h2>
            <ul>
              <li>
                The America 250 Deal may stack with the Founding Neighbor Special
                when the booking qualifies for both.
              </li>
              <li>
                The Founding Neighbor Special is a separate launch promotion for
                eligible first-route recurring residential customers.
              </li>
              <li>
                The Founding Neighbor Special may provide a special first
                two-bin recurring cleaning price when eligibility requirements
                are met.
              </li>
              <li>
                The America 250 discount applies to eligible recurring base visit
                pricing as described above. It does not turn excluded charges
                into discounted charges.
              </li>
              <li>
                If both promotions apply, Clean Curb Co. will confirm how the
                promotions appear before charging.
              </li>
            </ul>
          </article>

          <article className="promo-terms-card">
            <h2>Service area and route availability</h2>
            <ul>
              <li>
                Clean Curb Co. currently serves Cane Bay and nearby Summerville,
                South Carolina communities.
              </li>
              <li>
                Service is route-based. A booking may be declined, delayed, or
                moved to a future route if the address is outside the active
                service area or route capacity is full.
              </li>
              <li>
                Route density, technician availability, weather, equipment,
                safety, water access, and bin accessibility may affect service
                timing.
              </li>
            </ul>
          </article>

          <article className="promo-terms-card">
            <h2>Payment and charging</h2>
            <ul>
              <li>
                During launch, Clean Curb Co. may accept booking requests before
                charging.
              </li>
              <li>
                Customers will not be charged until Clean Curb Co. is ready to
                confirm service/payment terms.
              </li>
              <li>
                Payment information may be collected securely through Stripe.
                Clean Curb Co. does not store full card numbers or CVCs.
              </li>
              <li>
                If payment fails, is declined, is disputed, or cannot be
                collected, promotional pricing may be paused or removed until the
                issue is resolved.
              </li>
            </ul>
          </article>

          <article className="promo-terms-card">
            <h2>Limits and restrictions</h2>
            <ul>
              <li>Limit one America 250 Deal per household/service address.</li>
              <li>
                Promotion has no cash value and cannot be redeemed for cash,
                credit, gift cards, or non-service consideration.
              </li>
              <li>
                Promotion is not transferable unless Clean Curb Co. approves in
                writing.
              </li>
              <li>
                Promotion cannot be combined with other promotions, credits, or
                discounts except the Founding Neighbor Special when eligible, or
                unless Clean Curb Co. approves otherwise in writing.
              </li>
              <li>
                Clean Curb Co. may correct obvious pricing, eligibility,
                typographical, technical, or system errors.
              </li>
              <li>
                Clean Curb Co. may refuse, revoke, or adjust promotional pricing
                for fraud, abuse, duplicate submissions, ineligible addresses,
                unsafe service conditions, or policy violations.
              </li>
            </ul>
          </article>

          <article className="promo-terms-card">
            <h2>Changes, cancellation, and expiration</h2>
            <ul>
              <li>
                If a customer cancels recurring service before receiving the
                eligible promotional recurring visits, unused promotional value is
                forfeited.
              </li>
              <li>
                If service is paused, rescheduled, or delayed, Clean Curb Co. may
                determine whether remaining promotional visits carry forward.
              </li>
              <li>
                If a customer changes from recurring service to one-time service,
                the America 250 recurring discount no longer applies.
              </li>
              <li>
                Clean Curb Co. may end, modify, clarify, or extend this promotion
                where permitted, but the posted terms control unless Clean Curb Co.
                provides a written exception.
              </li>
            </ul>
          </article>

          <article className="promo-terms-card">
            <h2>Questions</h2>
            <p>
              Questions about promotion eligibility, booking status, route
              timing, or pricing can be sent to{" "}
              <a href={brand.emailHref}>{brand.email}</a>.
            </p>
            <p>
              Clean Curb Co. is operated by Stonebranch Capital LLC. This
              promotion is subject to Clean Curb Co. Terms and Conditions,
              service availability, and final booking confirmation.
            </p>
          </article>

          <div className="promo-terms-cta">
            <Link className="button button-primary" href={america250Promotion.bookingHref}>
              Book Now
            </Link>
            <Link className="button button-outline" href="/terms">
              Terms & Conditions
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}