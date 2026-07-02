import type { Metadata } from "next";
import { brand } from "@/lib/site";

export const metadata: Metadata = {
  title: "Accessibility Statement",
  description: "Clean Curb Co. accessibility statement and support contact information.",
};

export default function AccessibilityStatementPage() {
  return (
    <main>
      <section className="page-hero">
        <div className="container section-header">
          <p className="section-kicker">Accessibility</p>
          <h1>Accessibility Statement</h1>
          <p>
            Our commitment to making Clean Curb Co. services, booking, support,
            and account tools usable for customers with disabilities.
          </p>
        </div>
      </section>

      <section className="section section-white">
        <div className="container legal-copy">
          <p className="muted">Effective date: July 2, 2026</p>

          <h2>1. Our commitment</h2>
          <p>
            Clean Curb Co. wants customers to be able to learn about our
            services, request service, manage bookings, contact support, and use
            customer account features without unnecessary accessibility barriers.
            We are working to make our website, booking forms, customer portal,
            communications, and support processes accessible and user-friendly.
          </p>

          <h2>2. Accessibility goal</h2>
          <p>
            We aim to follow generally recognized accessibility practices,
            including Web Content Accessibility Guidelines principles, where
            reasonably practicable for our business, website, and technology
            stack. Accessibility is an ongoing process, and we may improve,
            correct, or redesign parts of the website over time.
          </p>

          <h2>3. Areas we focus on</h2>
          <p>
            Our accessibility efforts may include readable text, sufficient color
            contrast, keyboard-friendly navigation, form labels and instructions,
            error messages that are understandable, heading structure, alt text
            for meaningful images, mobile usability, and support for assistive
            technologies such as screen readers where reasonably practicable.
          </p>

          <h2>4. Alternative access and support</h2>
          <p>
            If you have trouble using any part of our website, booking system,
            customer portal, or online forms, please contact us. We can assist
            through another reasonable method such as phone, email, text, manual
            booking support, or another format when appropriate.
          </p>

          <h2>5. Third-party tools</h2>
          <p>
            Some parts of our website or services may use third-party tools,
            including payment processors, analytics providers, maps, messaging
            tools, scheduling tools, authentication providers, or embedded
            services. We do not fully control third-party platforms, but we will
            consider accessibility when selecting and configuring vendors where
            reasonably practicable.
          </p>

          <h2>6. Known limitations</h2>
          <p>
            During launch and early development, some features may still be
            improved, replaced, or tested. If we discover an accessibility issue
            or receive a report, we will review it and make a good-faith effort
            to address it within a reasonable timeframe based on severity,
            technical complexity, business resources, and customer impact.
          </p>

          <h2>7. Feedback</h2>
          <p>
            Accessibility feedback can be sent to <a href={brand.emailHref}>{brand.email}</a>{" "}
            or handled by calling <a href={brand.phoneHref}>{brand.phone}</a>.
            Please describe the page, feature, device, browser, assistive
            technology if applicable, and the issue you experienced so we can
            review it more effectively.
          </p>

          <h2>8. No limitation of legal rights</h2>
          <p>
            This statement does not limit any accessibility rights, obligations,
            accommodations, or remedies that may apply under law. We will make
            reasonable efforts to provide access to our services and support in a
            way that works for the customer and our operations.
          </p>

          <p className="muted">{brand.legalNote}</p>
        </div>
      </section>
    </main>
  );
}
