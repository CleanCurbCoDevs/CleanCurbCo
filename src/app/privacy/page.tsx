import { brand } from "@/lib/site";
import { publicPageMetadata } from "@/lib/seo";

export const metadata = publicPageMetadata({
  title: "Privacy Policy",
  description: "Clean Curb Co. privacy policy.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <main>
      <section className="page-hero">
        <div className="container section-header">
          <p className="section-kicker">Privacy</p>
          <h1>Privacy Policy</h1>
          <p>
            How Clean Curb Co. collects, uses, protects, and shares customer and
            website information.
          </p>
        </div>
      </section>

      <section className="section section-white">
        <div className="container legal-copy">
          <p className="muted">Effective date: July 2, 2026</p>

          <h2>Who we are</h2>
          <p>
            Clean Curb Co. is operated by Stonebranch Capital LLC. In this
            Privacy Policy, &quot;Clean Curb Co.,&quot; &quot;we,&quot;
            &quot;us,&quot; and &quot;our&quot; refer to Stonebranch Capital LLC
            doing business as Clean Curb Co.
          </p>

          <h2>Information we collect</h2>
          <p>
            We collect information you provide through booking, quote, contact,
            account, customer portal, employment, and support forms. This may
            include your name, phone number, email address, service address,
            neighborhood, bin count, selected services, add-ons, route or
            scheduling preferences, gate or access instructions, service notes,
            customer account details, and payment-status information.
          </p>
          <p>
            Please do not include sensitive personal information in service
            notes unless it is necessary for us to safely access or perform the
            service.
          </p>

          <h2>Service location and route details</h2>
          <p>
            We use address and neighborhood information to confirm whether your
            location is in range, group stops into efficient routes, schedule
            route days, send service updates, verify service completion, and
            improve future route planning. If you join a waitlist or ask about a
            future route, we may keep your area information so we can follow up
            if routes expand.
          </p>

          <h2>How we use information</h2>
          <p>
            We use customer information to process booking requests, confirm
            route timing, send launch and service updates, send reminders,
            provide before/after service updates, send payment links, process
            billing, manage recurring service, handle cancellation or pause
            requests, answer questions, provide customer support, maintain
            accurate records, improve the website and route operations, prevent
            fraud, and comply with legal, accounting, tax, safety, and business
            obligations.
          </p>

          <h2>Texts, calls, emails, and service updates</h2>
          <p>
            Clean Curb Co. may contact you by text message, phone, or email
            about booking requests, launch timing, route-day confirmations,
            reminders, payment links, service updates, billing notices, customer
            support, account access, policy changes, and follow-up. Message and
            data rates may apply for text messages. Marketing texts or emails,
            if offered, should use a separate opt-in where required or
            appropriate.
          </p>

          <h2>Photos and proof of service</h2>
          <p>
            Before/after service photos may be taken for proof of service,
            customer updates, quality control, training, dispute resolution, and
            internal service records. We do not publicly identify your address
            without permission. We may use photos in a non-identifying way, such
            as close-up bin photos that do not reveal your name, address, house
            number, people, vehicles, license plates, or other identifying
            details.
          </p>

          <h2>Payments</h2>
          <p>
            Payment links, card-on-file tools, checkout, invoices, and billing
            may be handled by payment processors such as Stripe or another
            provider. We do not store full card numbers on our own servers. A
            payment processor may collect and process the information needed to
            authorize, verify, complete, refund, or dispute a transaction under
            its own terms and privacy practices.
          </p>

          <h2>Website analytics, cookies, and logs</h2>
          <p>
            We use essential cookies or storage, server logs, Vercel Analytics,
            Vercel Speed Insights, and similar operational technologies to
            understand website traffic, measure booking form performance,
            diagnose technical issues, prevent abuse, remember basic
            preferences, and improve the customer experience. Analytics may
            include pages visited, approximate location derived from IP address,
            browser or device type, referring pages, form events, and general
            usage patterns. We do not currently use Google Analytics, Meta
            pixel, Nextdoor pixel, or other marketing pixels in the app code,
            and we do not use analytics to sell personal information.
          </p>

          <h2>Who we share information with</h2>
          <p>
            We may share information with service providers that help run the
            business, including website hosting, database hosting, email
            delivery, text or phone communication tools, payment processors,
            customer support tools, route operations tools, analytics providers,
            fraud prevention tools, professional advisors, insurers, and legal
            or compliance providers. We share only what is reasonably needed for
            the provider to perform services for us.
          </p>
          <p>
            We may also disclose information if required by law, subpoena,
            court order, governmental request, safety need, collection dispute,
            business transfer, insurance claim, or to protect the rights,
            safety, property, or operations of Clean Curb Co., Stonebranch
            Capital LLC, customers, workers, or others.
          </p>

          <h2>No selling personal information</h2>
          <p>
            We do not sell personal information. We use customer information to
            operate Clean Curb Co., communicate clearly, provide service, and
            improve our website and operations.
          </p>

          <h2>Data retention</h2>
          <p>
            We keep information for as long as reasonably needed for the
            purposes described in this policy, including service records,
            customer support, route history, warranty or dispute records,
            accounting, tax, insurance, legal, safety, fraud prevention, and
            business operations. When information is no longer reasonably needed,
            we may delete, de-identify, or archive it where practical.
          </p>

          <h2>Your choices</h2>
          <p>
            You may ask to update, correct, access, or delete information tied
            to your account or booking by contacting us. We may need to verify
            your request and may keep certain information where required or
            permitted for legal, accounting, safety, service, fraud prevention,
            dispute, or business-record purposes.
          </p>
          <p>
            You may opt out of marketing messages where offered. Transactional
            service messages may still be sent when needed to complete or
            support a booking, payment, route visit, customer account, or legal
            notice.
          </p>

          <h2>Children</h2>
          <p>
            Our services are intended for adults who can enter into a service
            agreement. We do not knowingly collect personal information from
            children under 13. If you believe a child provided information to us,
            please contact us so we can review it.
          </p>

          <h2>Security</h2>
          <p>
            We use reasonable administrative, technical, and organizational
            safeguards designed to protect customer information. No website,
            database, payment system, or internet transmission can be guaranteed
            to be completely secure.
          </p>

          <h2>Changes to this policy</h2>
          <p>
            We may update this Privacy Policy from time to time. The updated
            version will be posted on this page with a new effective date. If a
            change is material, we may provide additional notice where
            appropriate.
          </p>

          <h2>Contact</h2>
          <p>
            Questions about privacy can be sent to{" "}
            <a href="mailto:privacy@cleancurbco.com">
              privacy@cleancurbco.com
            </a>{" "}
            or to <a href={brand.emailHref}>{brand.email}</a>. You may also
            call <a href={brand.phoneHref}>{brand.phone}</a>.
          </p>

          <p className="muted">{brand.legalNote}</p>
        </div>
      </section>
    </main>
  );
}
