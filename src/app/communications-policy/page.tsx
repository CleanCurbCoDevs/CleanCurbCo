import type { Metadata } from "next";
import { brand } from "@/lib/site";

export const metadata: Metadata = {
  title: "Communications Policy",
  description: "Clean Curb Co. text, phone, and email communications policy.",
};

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
          <p className="muted">Effective date: July 2, 2026</p>

          <h2>1. Service-related communications</h2>
          <p>
            By submitting a booking request, creating an account, requesting a
            quote, contacting us, saving a payment method, or receiving service,
            you agree that Clean Curb Co. may contact you by text message,
            phone call, voicemail, email, or customer portal message about your
            booking, route timing, launch timing, reminders, payment links,
            service status, before/after updates, account access, billing,
            support, cancellations, refunds, and policy updates.
          </p>

          <h2>2. Message frequency</h2>
          <p>
            Message frequency varies based on your booking activity, route
            status, recurring service, support requests, payment status, and
            account activity. A typical service visit may involve booking
            confirmation, route reminders, day-of-service updates, proof of
            service, billing notices, and follow-up.
          </p>

          <h2>3. Text message charges</h2>
          <p>
            Message and data rates may apply. Carriers are not responsible for
            delayed or undelivered messages. Delivery is not guaranteed because
            it may depend on your carrier, device, service area, and network
            conditions.
          </p>

          <h2>4. Marketing messages</h2>
          <p>
            If we offer promotional texts or emails, we should ask for marketing
            consent separately where required or appropriate. Consent to receive
            marketing messages is not required to book service. You may opt out
            of marketing messages at any time.
          </p>

          <h2>5. Opting out</h2>
          <p>
            You may opt out of marketing texts by replying STOP where supported,
            or by contacting us. You may request help by replying HELP where
            supported, or by contacting us directly. If you opt out of marketing
            messages, we may still send transactional or service-related
            messages needed to complete, confirm, bill, support, or document
            your service, account, or legal relationship with us.
          </p>

          <h2>6. Phone number and email accuracy</h2>
          <p>
            You confirm that the phone number and email address you provide are
            yours or that you have permission to provide them. You agree to keep
            your contact information accurate and to notify us if your phone
            number or email address changes.
          </p>

          <h2>7. Recording and documentation</h2>
          <p>
            We may keep records of texts, emails, calls, voicemails, support
            notes, route confirmations, payment messages, and customer portal
            activity for customer support, service documentation, billing,
            quality control, dispute resolution, legal compliance, and business
            records. Calls are not routinely recorded unless disclosed or
            permitted by law.
          </p>

          <h2>8. Emergency and urgent notices</h2>
          <p>
            We may contact you about urgent route changes, safety issues,
            access problems, payment problems, service delays, account security,
            or legal notices even if you have opted out of marketing messages,
            where permitted by law.
          </p>

          <h2>9. Contact</h2>
          <p>
            Communication questions or opt-out requests can be sent to{" "}
            <a href={brand.emailHref}>{brand.email}</a> or handled by calling{" "}
            <a href={brand.phoneHref}>{brand.phone}</a>.
          </p>

          <p className="muted">{brand.legalNote}</p>
        </div>
      </section>
    </main>
  );
}
