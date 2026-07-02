import type { Metadata } from "next";
import { brand } from "@/lib/site";

export const metadata: Metadata = {
  title: "Door-to-Door Cancellation Notice",
  description: "Clean Curb Co. notice of cancellation for qualifying home solicitation sales.",
};

export default function DoorToDoorCancellationNoticePage() {
  return (
    <main>
      <section className="page-hero">
        <div className="container section-header">
          <p className="section-kicker">Home Solicitation Sales</p>
          <h1>Door-to-Door / Home Solicitation Cancellation Notice</h1>
          <p>
            A customer cancellation notice for qualifying in-person residential
            sales made at a customer&apos;s home, workplace, or certain temporary
            sales locations.
          </p>
        </div>
      </section>

      <section className="section section-white">
        <div className="container legal-copy">
          <p className="muted">Effective date: July 2, 2026</p>

          <h2>1. When this notice is intended to be used</h2>
          <p>
            This notice is intended for qualifying door-to-door, home
            solicitation, or similar in-person consumer sales where a legal
            cooling-off cancellation right may apply. It is not intended to
            replace transaction-specific notices required by federal, state, or
            local law. Before using in-person residential sales, Clean Curb Co.
            should confirm the final required form, address, timing, and delivery
            method with counsel.
          </p>

          <h2>2. Online, phone, and customer-initiated bookings</h2>
          <p>
            Most Clean Curb Co. bookings are expected to be requested online,
            by phone, by text, by email, or through the customer portal. Those
            transactions may not be the same as a door-to-door or home
            solicitation sale. This notice does not reduce any cancellation or
            refund rights provided in our Terms, Cancellation & Refund Policy,
            or applicable law.
          </p>

          <h2>3. Customer right to cancel qualifying transactions</h2>
          <p>
            If your transaction qualifies for a home solicitation or
            door-to-door cancellation period, you may cancel the transaction by
            sending a written cancellation notice by the applicable deadline.
            Written notice does not need to use a special format as long as it
            clearly states that you do not want to be bound by the transaction.
          </p>

          <h2>4. Notice of cancellation form</h2>
          <div className="legal-card">
            <h3>Notice of Cancellation</h3>
            <p>
              <strong>Transaction date:</strong> ______________________________
            </p>
            <p>
              <strong>Cancel no later than midnight of:</strong>{" "}
              ______________________________
            </p>
            <p>
              <strong>Seller:</strong> Clean Curb Co., operated as a DBA/brand
              of Stonebranch Capital LLC
            </p>
            <p>
              <strong>Seller address for written cancellation:</strong>{" "}
              ________________________________________________
            </p>
            <p>
              You may cancel this transaction, without penalty or obligation,
              within the applicable legal cancellation period. If you cancel, we
              will return payments required to be returned by law within the
              required timeframe after receiving your cancellation notice.
            </p>
            <p>
              To cancel, mail, deliver, or otherwise send a signed and dated
              written notice stating that you are canceling this transaction to
              Clean Curb Co. / Stonebranch Capital LLC at the address above. You
              may also contact us at <a href={brand.emailHref}>{brand.email}</a>{" "}
              or <a href={brand.phoneHref}>{brand.phone}</a>, but if a law
              requires written notice to a specific address, please follow that
              legal requirement.
            </p>
            <p>
              <strong>I hereby cancel this transaction.</strong>
            </p>
            <p>Date: ______________________________</p>
            <p>Customer signature: ______________________________</p>
            <p>Customer printed name: ______________________________</p>
            <p>Service address: ______________________________</p>
          </div>

          <h2>5. Staff instructions</h2>
          <p>
            If Clean Curb Co. conducts an in-person residential sale that may be
            covered by cooling-off rules, the customer should receive a completed
            copy of the agreement or receipt and any required cancellation notice
            at the time of the transaction. Staff should not misstate, waive, or
            discourage any legal cancellation right.
          </p>

          <h2>6. Emergency or immediate-service requests</h2>
          <p>
            Some laws may treat customer-requested emergency or immediate
            services differently when a customer asks for work to begin before a
            cancellation period expires. Do not rely on any waiver or emergency
            exception unless it is documented exactly as required by law and
            approved by management.
          </p>

          <h2>7. Contact</h2>
          <p>
            Questions about this notice can be sent to <a href={brand.emailHref}>{brand.email}</a>{" "}
            or handled by calling <a href={brand.phoneHref}>{brand.phone}</a>.
          </p>

          <p className="muted">{brand.legalNote}</p>
        </div>
      </section>
    </main>
  );
}
