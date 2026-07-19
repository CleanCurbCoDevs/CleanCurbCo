import { CookiePreferenceCenter } from "@/components/cookie-preference-center";
import { publicPageMetadata } from "@/lib/seo";
import { brand } from "@/lib/site";

export const metadata = publicPageMetadata({
  title: "Cookie & Analytics Policy",
  description:
    "Manage cookie preferences and learn how Clean Curb Co. uses analytics and similar technologies.",
  path: "/cookie-analytics-policy",
});

export default function CookieAnalyticsPolicyPage() {
  return (
    <main>
      <section className="page-hero">
        <div className="container section-header">
          <p className="section-kicker">
            Cookies & Analytics
          </p>

          <h1>Cookie & Analytics Policy</h1>

          <p>
            Choose your optional analytics settings and learn
            how Clean Curb Co. uses cookies, browser storage,
            logs, and website measurement tools.
          </p>
        </div>
      </section>

      <section className="section section-white">
        <div className="container legal-copy">
          <CookiePreferenceCenter />

          <p className="muted">
            Effective date: July 19, 2026
          </p>

          <h2>1. What this policy covers</h2>

          <p>
            This policy explains how Clean Curb Co. uses
            cookies, local browser storage, server logs,
            analytics services, performance tools, and similar
            technologies on our website, booking forms,
            customer portal, and related online services.
          </p>

          <h2>2. Essential website storage</h2>

          <p>
            Some storage and technical processing are necessary
            for the website to function. Essential technology
            may support security, account sessions, booking
            features, fraud prevention, payment processing,
            form protection, customer portal access, and the
            storage of your cookie preferences.
          </p>

          <p>
            Essential website functions are not disabled when
            you decline optional analytics. Hosting providers,
            security systems, databases, authentication
            services, and payment providers may also generate
            necessary server logs or technical records while
            providing their services.
          </p>

          <h2>3. Optional analytics categories</h2>

          <h3>Traffic and booking analytics</h3>

          <p>
            If you allow this category, we may use Google
            Analytics and Vercel Analytics to understand pages
            visited, general traffic sources, device and browser
            information, approximate geographic information,
            and non-sensitive interactions with the website or
            booking process.
          </p>

          <h3>Experience and usability insights</h3>

          <p>
            If you allow this category, we may use Microsoft
            Clarity to create heatmaps and masked session
            recordings. These tools help us identify confusing
            navigation, dead clicks, rage clicks, scrolling
            problems, and other website usability issues.
          </p>

          <p>
            We do not intentionally use session recording on
            administrative, employee, field-service, customer
            portal, authentication, billing, or payment setup
            routes. Sensitive form values should not be
            intentionally included in analytics events.
          </p>

          <h3>Website performance monitoring</h3>

          <p>
            If you allow this category, we may use Vercel Speed
            Insights to measure loading performance,
            responsiveness, layout movement, and other technical
            website performance information.
          </p>

          <h2>4. Information we may measure</h2>

          <p>
            Depending on your choices, analytics information may
            include:
          </p>

          <ul>
            <li>Pages visited and general navigation paths</li>
            <li>Referral source and campaign information</li>
            <li>Browser, device, and operating system type</li>
            <li>
              Approximate location derived from technical
              information
            </li>
            <li>Scroll depth and outbound link clicks</li>
            <li>
              Non-sensitive booking steps and service selections
            </li>
            <li>Website performance and error information</li>
            <li>
              General interaction patterns such as dead clicks
              or repeated clicks
            </li>
          </ul>

          <p>
            We do not intentionally send customer names, email
            addresses, phone numbers, street addresses, private
            service notes, card numbers, payment credentials, or
            authentication credentials as analytics event
            parameters.
          </p>

          <h2>5. Advertising and sale of information</h2>

          <p>
            We do not currently load advertising or retargeting
            pixels through this consent system. We do not sell
            customer lists or service information.
          </p>

          <p>
            If we later add advertising technologies or begin
            using information for materially different purposes,
            we will update this policy and the available consent
            choices before activating those technologies.
          </p>

          <h2>6. Third-party providers</h2>

          <p>
            Depending on your choices and how you use the
            website, third-party service providers may include
            Google, Microsoft, Vercel, Stripe, Supabase, and
            other providers supporting hosting, analytics,
            security, authentication, database, payment, or
            communications services.
          </p>

          <p>
            Those providers may process limited information
            under their own terms, privacy notices, retention
            practices, and security procedures.
          </p>

          <h2>7. Changing or withdrawing your choice</h2>

          <p>
            You can return to the Cookie & Analytics page at any
            time using the link in the website footer. You can
            then enable or disable each optional category,
            accept all optional categories, or reject all
            optional categories.
          </p>

          <p>
            When you withdraw consent, we stop intentionally
            loading the disabled analytics tool on future page
            loads and attempt to remove known first-party
            analytics cookies from your browser. Your browser
            settings may also allow you to delete or block
            cookies and other local storage.
          </p>

          <h2>8. How your preference is remembered</h2>

          <p>
            Your preference is stored locally in your browser so
            the website remembers whether you accepted,
            customized, or declined optional analytics. Clearing
            your browser storage may remove this choice and
            cause the consent banner to appear again.
          </p>

          <p>
            We may request a new choice if the available
            analytics categories, providers, or purposes change
            materially.
          </p>

          <h2>9. Do Not Track and privacy signals</h2>

          <p>
            Browsers and privacy tools may offer additional
            controls such as cookie blocking, tracking
            protection, or Do Not Track settings. Support and
            behavior can vary between browsers and providers.
            You can always use the preference controls on this
            page to reject optional analytics.
          </p>

          <h2>10. Changes to this policy</h2>

          <p>
            We may update this policy as our website, analytics
            setup, service providers, or business operations
            change. The updated version will be posted on this
            page with a revised effective date.
          </p>

          <h2>11. Contact</h2>

          <p>
            Privacy questions can be sent to{" "}
            <a href="mailto:privacy@cleancurbco.com">
              privacy@cleancurbco.com
            </a>{" "}
            or to{" "}
            <a href={brand.emailHref}>{brand.email}</a>.
          </p>

          <p className="muted">{brand.legalNote}</p>
        </div>
      </section>
    </main>
  );
}
