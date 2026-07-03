import { brand } from "@/lib/site";
import { publicPageMetadata } from "@/lib/seo";

export const metadata = publicPageMetadata({
  title: "Commercial Services Addendum",
  description: "Clean Curb Co. commercial, HOA, property manager, and multi-bin services addendum.",
  path: "/commercial-services-addendum",
});

export default function CommercialServicesAddendumPage() {
  return (
    <main>
      <section className="page-hero">
        <div className="container section-header">
          <p className="section-kicker">Commercial Accounts</p>
          <h1>Commercial Services Addendum</h1>
          <p>
            Additional terms for HOAs, property managers, apartments,
            businesses, organizations, and other non-standard service accounts.
          </p>
        </div>
      </section>

      <section className="section section-white">
        <div className="container legal-copy">
          <p className="muted">Effective date: July 2, 2026</p>

          <h2>1. Purpose</h2>
          <p>
            This Commercial Services Addendum supplements the Clean Curb Co.
            Terms of Service, Payment Policy, Service Policy, Cancellation &
            Refund Policy, and any written quote, proposal, invoice, statement
            of work, or service agreement for commercial or multi-location
            customers.
          </p>

          <h2>2. Covered customers</h2>
          <p>
            This addendum may apply to homeowners associations, condominium
            associations, apartment communities, property managers, landlords,
            municipalities, small businesses, office parks, contractors,
            nonprofit organizations, event organizers, and any customer booking
            service for multiple bins, multiple addresses, shared property, or a
            non-household account.
          </p>

          <h2>3. Authority to request service</h2>
          <p>
            The person or organization requesting service represents that they
            have authority to approve the service, provide access, authorize
            payment, and bind the customer to the applicable terms. For shared,
            rented, managed, or third-party property, the customer is responsible
            for obtaining owner, tenant, resident, HOA, management, or other
            required approvals before service.
          </p>

          <h2>4. Quotes and scope of work</h2>
          <p>
            Commercial pricing, routes, service windows, bin counts, add-ons,
            service frequency, staffing, access requirements, and payment terms
            should be confirmed in a quote, proposal, invoice, email, portal
            confirmation, or written service agreement. If there is a conflict,
            the written commercial quote or agreement controls for that
            commercial job unless prohibited by law.
          </p>

          <h2>5. Site readiness</h2>
          <p>
            Commercial customers must ensure that bins are empty, accessible,
            safe to service, and located where our team can legally and safely
            operate. The customer is responsible for site maps, gate codes,
            parking instructions, water or wastewater restrictions, loading
            areas, resident notices, traffic control needs, security procedures,
            and any property-specific rules that may affect service.
          </p>

          <h2>6. Route windows and operational changes</h2>
          <p>
            Commercial and multi-bin service may require larger route blocks,
            staged access, or coordination with trash pickup schedules. We may
            adjust the route, staffing, service sequence, or service date due to
            weather, safety, equipment, route density, access issues, water
            restrictions, customer readiness, or operational needs.
          </p>

          <h2>7. Billing and payment</h2>
          <p>
            Commercial accounts may be charged by visit, by bin, by route, by
            location, by recurring plan, by invoice, or under another written
            pricing arrangement. Unless otherwise agreed in writing, invoices
            are due upon receipt. We may pause, withhold, or cancel future
            service for late, failed, disputed, or unpaid invoices.
          </p>

          <h2>8. Cancellations and rescheduling</h2>
          <p>
            Because commercial routes may require additional coordination,
            larger service blocks, staffing, and equipment preparation, a quote
            or written agreement may set a longer cancellation or rescheduling
            window than residential service. If no commercial-specific window is
            stated, our general Cancellation & Refund Policy applies.
          </p>

          <h2>9. Customer communications</h2>
          <p>
            The commercial customer is responsible for communicating with its
            residents, tenants, staff, property owners, board members, vendors,
            or other affected parties unless Clean Curb Co. expressly agrees in
            writing to provide specific notices. We are not responsible for
            fines, resident disputes, towing issues, blocked access, or service
            failures caused by missing or inaccurate customer communications.
          </p>

          <h2>10. Property conditions and limitations</h2>
          <p>
            Commercial service does not include hazardous cleanup, pest control,
            mold remediation, property repairs, restoration, plumbing,
            landscaping, pressure-washing beyond the agreed scope, or removal of
            trash unless specifically agreed in writing. We may refuse or stop
            service if conditions are unsafe, unlawful, inaccessible, or outside
            the agreed scope.
          </p>

          <h2>11. Insurance and additional requirements</h2>
          <p>
            Commercial customers may request certificates, vendor onboarding,
            W-9 forms, special billing instructions, parking credentials, or
            other documentation. Clean Curb Co. will provide available business
            documentation when appropriate, but no insurance, license,
            certification, or vendor requirement is promised unless confirmed in
            writing by Clean Curb Co.
          </p>

          <h2>12. Indemnity and responsibility</h2>
          <p>
            To the fullest extent permitted by law, the commercial customer is
            responsible for claims, costs, delays, damages, fines, or disputes
            caused by inaccurate information, lack of authority, lack of access,
            unsafe site conditions, resident or tenant issues, customer-provided
            instructions, property rules, or materials placed in or around bins
            by the customer or third parties.
          </p>

          <h2>13. Termination</h2>
          <p>
            Either party may end a commercial arrangement according to the
            written agreement or, if no specific term applies, by providing
            reasonable written notice. Amounts owed for completed service,
            late-canceled service, approved fees, or work already prepared under
            the applicable policy remain due unless waived in writing.
          </p>

          <h2>14. Contact</h2>
          <p>
            Commercial account questions can be sent to <a href={brand.emailHref}>{brand.email}</a>{" "}
            or handled by calling <a href={brand.phoneHref}>{brand.phone}</a>.
          </p>

          <p className="muted">{brand.legalNote}</p>
        </div>
      </section>
    </main>
  );
}
