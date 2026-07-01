import type { Metadata } from "next";
import { brand } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Clean Curb Co. privacy policy.",
};

export default function PrivacyPage() {
  return (
    <main>
      <section className="page-hero">
        <div className="container section-header">
          <p className="section-kicker">Privacy</p>
          <h1>Privacy Policy</h1>
          <p>
            Plain-language privacy notes for Clean Curb Co. customers and route
            requests.
          </p>
        </div>
      </section>
      <section className="section section-white">
        <div className="container legal-copy">
          <h2>Information we collect</h2>
          <p>
            We collect the contact details you provide through booking,
            contact, account, and career forms. This can include your name,
            phone number, email address, service address, neighborhood,
            booking details, bin count, add-ons, notes, gate or access
            instructions, and payment-status information.
          </p>
          <h2>Service location and route details</h2>
          <p>
            We use address and neighborhood information to confirm whether you
            are in range, group stops into efficient routes, schedule route
            days, and send service updates. If you join a waitlist or ask about
            a future route, we may keep your area information so we can follow
            up as routes expand.
          </p>
          <h2>How we use it</h2>
          <p>
            We use this information to confirm route days, communicate about
            service, send payment links, provide before/after service updates,
            answer questions, manage recurring service, handle support
            requests, improve neighborhood routes, and keep customer records
            accurate.
          </p>
          <h2>Texts, emails, and service updates</h2>
          <p>
            Clean Curb Co. may contact you by text message, phone, or email
            about booking requests, route-day confirmations, reminders, payment
            links, service updates, customer support, account access, and
            follow-up. Message and data rates may apply for text messages.
          </p>
          <h2>Photos</h2>
          <p>
            Before/after service photos may be taken for proof of service,
            customer updates, quality control, and service records. We do not
            identify your address publicly without permission.
          </p>
          <h2>Payments</h2>
          <p>
            Payment links and checkout may be handled by a payment processor
            such as Stripe or another provider. We do not sell payment
            information. Payment processors may collect and process the
            information needed to complete a transaction under their own terms
            and privacy practices.
          </p>
          <h2>Who we share information with</h2>
          <p>
            We may share information with service providers that help run the
            business, including website hosting, email delivery, text or phone
            communication tools, payment processors, customer support tools,
            route operations tools, and database providers. We share only what
            is reasonably needed to provide and support the service.
          </p>
          <h2>No selling personal information</h2>
          <p>
            We do not sell personal information. We use customer information to
            operate Clean Curb Co., communicate clearly, and provide service.
          </p>
          <h2>Data requests</h2>
          <p>
            If you want to update, correct, or ask about information we have
            connected to your account or booking, contact us and we will help
            where we reasonably can.
          </p>
          <h2>Contact</h2>
          <p>
            Questions about privacy can be sent to{" "}
            <a href={brand.emailHref}>{brand.email}</a> or by calling{" "}
            <a href={brand.phoneHref}>{brand.phone}</a>.
          </p>
          <p className="muted">{brand.legalNote}</p>
        </div>
      </section>
    </main>
  );
}
