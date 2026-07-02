import type { Metadata } from "next";
import { brand } from "@/lib/site";

export const metadata: Metadata = {
  title: "Cookie & Analytics Policy",
  description: "Clean Curb Co. cookie and analytics policy.",
};

export default function CookieAnalyticsPolicyPage() {
  return (
    <main>
      <section className="page-hero">
        <div className="container section-header">
          <p className="section-kicker">Cookies & Analytics</p>
          <h1>Cookie & Analytics Policy</h1>
          <p>
            How Clean Curb Co. may use cookies, logs, analytics, and similar
            technologies on its website.
          </p>
        </div>
      </section>

      <section className="section section-white">
        <div className="container legal-copy">
          <p className="muted">Effective date: July 2, 2026</p>

          <h2>1. What this policy covers</h2>
          <p>
            This policy explains how Clean Curb Co. may use cookies, pixels,
            local storage, server logs, analytics tools, and similar
            technologies on our website, booking forms, customer portal, and
            related online services.
          </p>

          <h2>2. Types of technologies we may use</h2>
          <p>
            We may use essential cookies or local storage to make the website
            work, remember basic preferences, maintain sessions, protect forms,
            prevent fraud, and support account access. We may also use analytics
            tools, server logs, or performance monitoring tools to understand
            website usage and fix technical issues.
          </p>

          <h2>3. Analytics information</h2>
          <p>
            Analytics may include pages visited, buttons clicked, booking form
            steps, approximate location derived from IP address, browser type,
            device type, operating system, referring pages, timestamps, error
            logs, and general usage patterns. We use this information to improve
            the website, understand demand by neighborhood, diagnose errors,
            measure route-request performance, prevent abuse, and improve
            customer experience.
          </p>

          <h2>4. No sale of personal information</h2>
          <p>
            We do not sell personal information. We do not use website analytics
            to sell customer lists or service information. If we ever add
            advertising tools, our goal is to avoid personalized ad targeting
            based on sensitive customer details, service notes, payment details,
            or private account records.
          </p>

          <h2>5. Third-party tools</h2>
          <p>
            Analytics, hosting, payment, database, communications, security,
            and customer support tools may collect limited technical information
            to provide services to us. Those providers may process information
            under their own terms, privacy policies, and security practices.
          </p>

          <h2>6. Your choices</h2>
          <p>
            You can usually control cookies through your browser settings. Some
            settings may limit website functionality, booking forms, customer
            portal access, saved preferences, security checks, or payment tools.
            You may also contact us with privacy questions or requests.
          </p>

          <h2>7. Do Not Track</h2>
          <p>
            Some browsers offer “Do Not Track” signals. Because there is not a
            single industry-standard response for all websites, our website may
            not automatically respond to those signals. You can still contact us
            with privacy requests or use browser-level controls where available.
          </p>

          <h2>8. Changes to this policy</h2>
          <p>
            We may update this policy as our website, analytics setup, customer
            portal, or business operations change. The updated version will be
            posted on this page with a new effective date.
          </p>

          <h2>9. Contact</h2>
          <p>
            Questions can be sent to{" "}
            <a href="mailto:privacy@cleancurbco.com">
              privacy@cleancurbco.com
            </a>{" "}
            or to <a href={brand.emailHref}>{brand.email}</a>.
          </p>

          <p className="muted">{brand.legalNote}</p>
        </div>
      </section>
    </main>
  );
}
