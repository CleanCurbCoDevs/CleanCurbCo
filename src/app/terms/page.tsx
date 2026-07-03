import { brand } from "@/lib/site";
import { publicPageMetadata } from "@/lib/seo";

export const metadata = publicPageMetadata({
  title: "Terms of Service",
  description: "Clean Curb Co. terms of service.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <main>
      <section className="page-hero">
        <div className="container section-header">
          <p className="section-kicker">Terms</p>
          <h1>Terms of Service</h1>
          <p>
            The basic agreement for using the Clean Curb Co. website, booking
            service, customer portal, and bin cleaning services.
          </p>
        </div>
      </section>

      <section className="section section-white">
        <div className="container legal-copy">
          <p className="muted">Effective date: July 2, 2026</p>

          <h2>1. Who we are</h2>
          <p>
            Clean Curb Co. is operated by Stonebranch Capital LLC. These Terms
            apply to Clean Curb Co.&apos;s website, booking forms, customer portal,
            communications, payment tools, and services. In these Terms,
            &quot;Clean Curb Co.,&quot; &quot;we,&quot; &quot;us,&quot; and
            &quot;our&quot; refer to Stonebranch Capital LLC doing business as Clean
            Curb Co.
          </p>

          <h2>2. Agreement to these Terms</h2>
          <p>
            By using our website, submitting a booking request, creating an
            account, saving a payment method, requesting service, accepting a
            route confirmation, or receiving services, you agree to these Terms
            and any policy linked from these Terms, including our Privacy Policy,
            Service Policy, Payment Policy, Cancellation & Refund Policy, Cookie
            & Analytics Policy, and Communications Policy.
          </p>

          <h2>3. Eligibility</h2>
          <p>
            You must be at least 18 years old and able to enter into a binding
            agreement to book service. If you book service for a property you do
            not own, lease, manage, or otherwise control, you confirm that you
            have permission to request the service and authorize access to the
            bins and service area.
          </p>

          <h2>4. Service area and route availability</h2>
          <p>
            Clean Curb Co. is a route-based local service. Submitting a booking
            request does not guarantee that your address is in range or that a
            specific day or time is available. We may accept, decline,
            reschedule, or waitlist requests based on route density, service
            area, safety, staffing, equipment, weather, water restrictions,
            operational readiness, or business needs.
          </p>

          <h2>5. Launch-stage bookings</h2>
          <p>
            During launch periods, we may accept booking requests before regular
            routes are active. Unless clearly stated otherwise at checkout, your
            card should not be charged until your route or service is confirmed.
            If launch timing changes, we may reschedule, waitlist, or cancel a
            booking request. You will not be charged for unperformed service if
            you have not already been charged. If payment has already been
            collected for a visit we cannot confirm or perform, we will either
            issue a full refund for the unperformed visit or communicate with
            you to reschedule service.
          </p>

          <h2>6. Pricing, estimates, and final confirmation</h2>
          <p>
            Website pricing, booking form totals, promotions, and estimates are
            provided for convenience and may depend on bin count, service
            frequency, add-ons, location, accessibility, route timing, taxes,
            fees, and other service details. Your final price may be confirmed
            by text, email, invoice, checkout, or customer portal before we
            charge your payment method or perform the service.
          </p>
          <p>
            Promotional pricing may be limited by date, service area,
            availability, customer type, first-time booking status, route
            density, or other terms disclosed with the offer. We may correct
            pricing errors before confirming a service.
          </p>

          <h2>7. Customer responsibilities</h2>
          <p>
            You are responsible for making sure bins are empty, accessible, and
            placed at the curb or other agreed service location by the scheduled
            route time. You are also responsible for providing accurate contact,
            address, gate, access, parking, HOA, pet, and safety information. If
            bins are full, blocked, missing, inaccessible, unsafe, or not ready,
            we may skip, reschedule, or charge the visit according to our
            Cancellation & Refund Policy and Service Policy.
          </p>

          <h2>8. Service limitations</h2>
          <p>
            Bin cleaning improves cleanliness and odor, but we do not guarantee
            complete removal of all stains, smells, bacteria, mold, mildew,
            insects, paint, tar, oil, chemical residue, scratches, discoloration,
            embedded grime, sun damage, or pre-existing conditions. We may
            refuse or stop service when conditions are unsafe, unsanitary,
            illegal, inaccessible, or outside the scope of our service.
          </p>

          <h2>9. Recurring service</h2>
          <p>
            If you choose a recurring service plan, you authorize us to schedule
            recurring route visits and charge your saved payment method for
            confirmed recurring visits until you cancel or pause the plan. We
            will make cancellation and pause options available through the
            customer portal, by contacting us, or through another method we
            provide. Cancellation timing, late cancellations, inaccessible bins,
            skipped visits, and refunds are handled under our Cancellation &
            Refund Policy.
          </p>

          <h2>10. Payment authorization</h2>
          <p>
            By saving a payment method, authorizing checkout, accepting an
            invoice, or choosing recurring service, you authorize Clean Curb Co.
            and its payment processors to charge your payment method for
            confirmed services, recurring visits, add-ons, taxes, approved fees,
            late cancellation or missed-service charges, and other amounts you
            authorize. More details are provided in our Payment Policy.
          </p>

          <h2>11. Cancellations, rescheduling, pauses, and refunds</h2>
          <p>
            Cancellations, rescheduling, recurring plan pauses, service changes,
            skipped visits, route delays, and refunds are governed by our
            Cancellation & Refund Policy. In general, we try to be reasonable,
            but late changes after a route has been planned, prepared, or
            dispatched may still be charged.
          </p>

          <h2>12. Photos, proof of service, and records</h2>
          <p>
            We may take before/after photos, route notes, checklist records,
            time records, and completion records for customer updates, proof of
            service, quality control, training, dispute resolution, insurance,
            and internal records. Public marketing use of identifiable property
            details should require permission or reasonable de-identification.
          </p>

          <h2>13. Communications</h2>
          <p>
            You agree that we may contact you by text, phone, email, or customer
            portal message about booking requests, route timing, reminders,
            payment links, service updates, billing, support, account access,
            policy updates, and related operational matters. Message and data
            rates may apply. More details are provided in our Communications
            Policy.
          </p>

          <h2>14. Accounts and customer portal</h2>
          <p>
            You are responsible for keeping your account login information
            secure and keeping your contact, address, payment, and service
            information accurate. Requests submitted through the customer portal
            may require review, confirmation, or timing rules before becoming
            effective.
          </p>

          <h2>15. Website use</h2>
          <p>
            You agree not to misuse the website, booking forms, customer portal,
            or communications systems. This includes submitting false
            information, attempting unauthorized access, interfering with the
            website, scraping data, abusing promotions, impersonating another
            person, or using the service in a way that harms Clean Curb Co.,
            customers, workers, service providers, or others.
          </p>

          <h2>16. Third-party services</h2>
          <p>
            Our website and operations may use third-party services for hosting,
            payments, communications, analytics, maps, routing, customer support,
            databases, and related business functions. Those services may have
            their own terms and privacy practices. We are not responsible for
            third-party services we do not control.
          </p>

          <h2>17. Disclaimers</h2>
          <p>
            The website and services are provided on an “as available” and “as
            is” basis to the fullest extent permitted by law. We do not promise
            uninterrupted website access, perfect route timing, exact arrival
            windows, complete stain or odor removal, or that every booking
            request can be accepted. Nothing in these Terms limits rights that
            cannot be waived under applicable law.
          </p>

          <h2>18. Limitation of liability</h2>
          <p>
            To the fullest extent permitted by law, Clean Curb Co. and
            Stonebranch Capital LLC will not be liable for indirect, incidental,
            special, consequential, exemplary, or punitive damages, or for lost
            profits, lost revenue, lost data, loss of goodwill, or business
            interruption. Our total liability for a service issue will not exceed
            the amount you paid for the specific service visit giving rise to
            the claim, except where a different limit is required by law.
          </p>

          <h2>19. Property conditions and damage</h2>
          <p>
            We are not responsible for pre-existing damage, ordinary wear and
            tear, brittle or weakened bins, manufacturer defects, cracked wheels
            or lids, loose hinges, sun damage, staining, discoloration, or damage
            caused by inaccurate access instructions, unsafe conditions,
            customer-provided equipment, third parties, animals, weather, or
            conditions outside our reasonable control. Please report concerns as
            soon as possible after service so we can review them.
          </p>

          <h2>20. Legal compliance and customer rights</h2>
          <p>
            These Terms are not intended to limit any non-waivable consumer
            rights. If a sale is made in a way that gives you a legal
            cooling-off, cancellation, refund, or notice right, we will honor
            applicable non-waivable rights.
          </p>

          <h2>21. Governing law</h2>
          <p>
            These Terms are governed by the laws of Wyoming to the extent
            permitted by law, without limiting any non-waivable consumer
            protection laws or local rules that apply where services are
            performed.
          </p>

          <h2>22. Changes to these Terms</h2>
          <p>
            We may update these Terms from time to time. The updated version
            will be posted on this page with a new effective date. Continued use
            of the website, customer portal, booking tools, or services after an
            update means you accept the updated Terms.
          </p>

          <h2>23. Contact</h2>
          <p>
            Questions about these Terms can be sent to{" "}
            <a href="mailto:legal@cleancurbco.com">
              legal@cleancurbco.com
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
