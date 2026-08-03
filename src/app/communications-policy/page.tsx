import { brand } from "@/lib/site";
import { publicPageMetadata } from "@/lib/seo";

export const metadata = publicPageMetadata({
  title: "Communications Policy",
  description: "Clean Curb Co. text, phone, and email communications policy.",
  path: "/communications-policy",
});

export default function CommunicationsPolicyPage() {
  return (
    <main>
      <section className="page-hero">
        <div className="container section-header">
          <p className="section-kicker">Communications</p>
          <h1>Text, Phone & Email Communications Policy</h1>
          <p>
            How Clean Curb Co. uses texts, calls, emails, and customer portal
            messages for service updates and customer support.
          </p>
        </div>
      </section>

      <section className="section section-white">
        <div className="container legal-copy">
          <p className="muted">Effective date: August 3, 2026</p>

          <aside className="legal-summary-card">
            <p className="section-kicker">Plain-English Summary</p>
            <h2>The messaging rules</h2>
            <ul>
              <li>SMS is optional and requires a separate affirmative opt-in.</li>
              <li>Texts are limited to transactional service updates and customer support unless separate marketing consent is obtained.</li>
              <li>Message frequency varies, typically 2-6 messages per service visit.</li>
              <li>Reply STOP to unsubscribe or HELP for assistance.</li>
              <li>Questions can also be handled at 843-888-4124 or contact@cleancurbco.com.</li>
            </ul>
          </aside>

          <h2>1. Service-related communications</h2>
          <p>
            Clean Curb Co. may contact customers by phone, email, voicemail, or
            customer portal message about bookings, route timing, reminders,
            payment links, service status, before/after updates, account access,
            billing, support, cancellations, refunds, and policy updates.
          </p>

          <h2>2. SMS enrollment and consent</h2>
          <p>
            SMS enrollment is optional and separate from booking or accepting
            general terms. A customer enrolls by entering a mobile number,
            actively selecting the unchecked SMS-consent box, and submitting the
            form. Providing a phone number or requesting service by itself does
            not authorize recurring or automated text messages. Consent is not a
            condition of purchase.
          </p>
          <p>
            The opt-in disclosure identifies Clean Curb Co., the types of
            messages, expected frequency, message and data rate notice, HELP and
            STOP instructions, and links to the Terms of Service and Privacy
            Policy.
          </p>

          <h2>3. SMS message types</h2>
          <p>
            Customers who opt in may receive booking confirmations, appointment
            reminders, route or scheduling updates, estimated-arrival notices,
            service-completion updates, payment-related notices, and
            customer-support messages. These messages are transactional and
            service-oriented.
          </p>

          <h2>4. Message frequency</h2>
          <p>
            Message frequency varies based on booking activity, route status,
            recurring service, support requests, and payment status. A typical
            service visit may involve 2-6 messages. Unusual schedule changes or
            support conversations may result in additional messages.
          </p>

          <h2>5. Charges, delivery, and carriers</h2>
          <p>
            Message and data rates may apply. Wireless carriers are not liable
            for delayed or undelivered messages. Delivery is not guaranteed and
            may depend on the customer&apos;s carrier, device, service area, and
            network conditions.
          </p>

          <h2>6. Opting out</h2>
          <p>
            Reply STOP, UNSUBSCRIBE, END, QUIT, or HALT to end messages from the
            Clean Curb Co. SMS program. After a valid opt-out request, we may
            send one final confirmation and will not send additional SMS program
            messages unless the customer opts in again.
          </p>
          <p>
            SMS opt-out does not cancel a booking, payment obligation,
            recurring-service plan, or service request. We may use email, phone,
            or customer portal messages for service matters where permitted.
          </p>

          <h2>7. Getting help</h2>
          <p>
            Reply HELP, INFO, or SUPPORT for assistance. Customers may also call
            or text <a href={brand.phoneHref}>{brand.phone}</a>, email{" "}
            <a href={brand.emailHref}>{brand.email}</a>, or visit{" "}
            <a href="https://www.cleancurbco.com/contact">
              https://www.cleancurbco.com/contact
            </a>.
          </p>

          <h2>8. Replies and customer support</h2>
          <p>
            Customer replies to the messaging number may be routed to Clean Curb
            Co. systems for support, scheduling, or account assistance. For
            urgent or time-sensitive matters, customers should call or text
            843-888-4124 because automated-message replies may not be reviewed
            immediately.
          </p>

          <h2>9. Marketing messages</h2>
          <p>
            The Clean Curb Co. transactional SMS program does not include
            unsolicited advertising or promotional messages. If we later offer
            promotional texts, we will request separate consent where required.
            Marketing consent will not be required to book or receive service.
          </p>

          <h2>10. Consent records and privacy</h2>
          <p>
            We may retain the phone number, consent selection, consent date and
            time, opt-in source, applicable disclosure version, message records,
            and opt-out history for service administration, customer support,
            dispute resolution, and compliance.
          </p>
          <p>
            SMS consent and mobile opt-in information are handled according to
            our Privacy Policy. They are not sold, rented, transferred, or shared
            for third-party marketing.
          </p>

          <h2>11. Phone number accuracy</h2>
          <p>
            You confirm that the mobile number you provide is yours or that you
            are authorized to provide it. Please update us if your number
            changes. A person who receives messages because a number was
            reassigned may reply STOP or contact us to end them.
          </p>

          <h2>12. Contact</h2>
          <p>
            Communication questions and opt-out requests can be sent to{" "}
            <a href={brand.emailHref}>{brand.email}</a> or handled by calling or
            texting <a href={brand.phoneHref}>{brand.phone}</a>.
          </p>

          <p className="muted">{brand.legalNote}</p>
        </div>
      </section>
    </main>
  );
}
