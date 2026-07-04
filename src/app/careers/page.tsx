import Link from "next/link";
import { submitCareerApplicationAction } from "@/app/careers/actions";
import { publicPageMetadata } from "@/lib/seo";

export const metadata = publicPageMetadata({
  title: "Careers",
  description:
    "Join the Clean Curb Co. career interest list for future local service roles in Cane Bay and nearby Summerville communities.",
  path: "/careers",
});

type CareersPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

const traits = [
  "Reliable and on time",
  "Comfortable working outdoors",
  "Friendly with customers",
  "Detail-oriented",
  "Able to follow checklists",
  "Comfortable using a mobile web app",
  "Ready for water, bins, hoses, tools, and outdoor conditions",
];

const roles = [
  {
    title: "Field Service Technician",
    copy:
      "Runs residential bin cleaning stops, follows service checklists, uploads before/after photos, communicates route status, and keeps each stop professional.",
  },
  {
    title: "Route Lead",
    copy:
      "Helps organize route days, supports technicians, handles field quality, and coordinates service issues.",
  },
  {
    title: "Customer Support / Scheduling Support",
    copy:
      "Helps with booking questions, route confirmations, customer messages, service changes, and follow-up.",
  },
  {
    title: "Part-Time Launch Help",
    copy:
      "Flexible support for route days, flyers, local outreach, prep work, cleaning support, and customer follow-up.",
  },
];

const standards = [
  "Show up when scheduled",
  "Treat customers and property respectfully",
  "Keep routes clean and documented",
  "Follow the checklist",
  "Communicate issues early",
  "Leave every stop better than we found it",
];

const availabilityOptions = [
  "Weekdays",
  "Weekends",
  "Mornings",
  "Afternoons",
  "Flexible",
  "Not sure yet",
];

export default async function CareersPage({ searchParams }: CareersPageProps) {
  const params = await searchParams;
  const submitted = params.submitted === "1";
  const hasError = Boolean(params.error);

  return (
    <main>
      <section className="page-hero careers-hero">
        <div className="container section-header">
          <p className="section-kicker">Careers</p>
          <h1>Careers at Clean Curb Co.</h1>
          <p>
            Help us bring fresh starts to the curb, one neighborhood route at a
            time.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#interest-form">
              Join the Interest List
            </a>
            <Link className="button button-secondary" href="/contact">
              Ask a Question
            </Link>
          </div>
        </div>
      </section>

      <section className="section section-cream">
        <div className="container careers-layout">
          <section className="placeholder-panel careers-intro">
            <p className="section-kicker">Growing Local Team</p>
            <h2>Built for reliable neighborhood service.</h2>
            <p>
              Clean Curb Co. is a locally owned, veteran-owned curbside
              cleaning service starting in Cane Bay and nearby Summerville
              communities. We&apos;re building a reliable, friendly,
              high-standard service team for residential bin cleaning and
              related exterior cleaning routes.
            </p>
          </section>
          <section className="current-hiring-card">
            <p className="section-kicker">Current hiring status</p>
            <h2>We are collecting interest as routes grow.</h2>
            <p>
              Clean Curb Co. is in launch stage. This page is for future opportunities
              and early interest, not a guarantee that a role is open today.
            </p>
            <ul>
              <li>First opportunities may be part-time, seasonal, contract, or limited launch help.</li>
              <li>Field work may require a valid driver&apos;s license, reliable transportation, outdoor work, and physical route work.</li>
              <li>Pay, schedule, employment type, and start date will be confirmed before any offer.</li>
              <li>Customer-facing and route roles require professionalism, reliability, and comfort using a mobile web app.</li>
            </ul>
          </section>
          <section className="detail-panel">
            <p className="section-kicker">Who We&apos;re Looking For</p>
            <div className="mini-list careers-trait-list">
              {traits.map((trait) => (
                <span key={trait}>{trait}</span>
              ))}
            </div>
          </section>

          <section className="detail-panel">
            <p className="section-kicker">Possible Roles</p>
            <h2>As we grow, we may look for:</h2>
            <div className="grid grid-2">
              {roles.map((role) => (
                <article className="card" key={role.title}>
                  <h3>{role.title}</h3>
                  <p>{role.copy}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="detail-panel">
            <p className="section-kicker">What the Work Is Like</p>
            <h2>Outdoor, route-based, and checklist-driven.</h2>
            <p>
              This is physical but straightforward service work. It can mean
              water, hoses, bins, cleaning tools, outdoor heat, customer
              driveways, before/after photo documentation, and a mobile app
              checklist at each stop. Quality and reliability matter here.
            </p>
          </section>

          <section className="detail-panel">
            <p className="section-kicker">Our Standards</p>
            <div className="mini-list careers-trait-list">
              {standards.map((standard) => (
                <span key={standard}>{standard}</span>
              ))}
            </div>
          </section>

          <section className="detail-panel employee-login-callout">
            <div>
              <p className="section-kicker">Team Access</p>
              <h2>Already part of the Clean Curb Co. team?</h2>
            </div>
            <Link className="button button-dark" href="/employee-login">
              Employee Login
            </Link>
          </section>

          <section className="placeholder-panel" id="interest-form">
            <p className="section-kicker">Interest Form</p>
            <h2>Tell us a little about you.</h2>
            {submitted ? (
              <div className="confirmation-panel">
                <h3>Thanks for your interest in Clean Curb Co.</h3>
                <p>
                  We received your information and will reach out if there is a
                  good fit as we grow.
                </p>
              </div>
            ) : null}
            {hasError ? (
              <p className="form-error">
                Please check the required fields and try again.
              </p>
            ) : null}
            <form action={submitCareerApplicationAction} className="booking-form">
              <label className="form-honeypot" aria-hidden="true">
                <span>Website</span>
                <input name="website" autoComplete="off" tabIndex={-1} />
              </label>
              <div className="form-grid">
                <label className="field">
                  <span>First name</span>
                  <input name="first_name" required />
                </label>
                <label className="field">
                  <span>Last name</span>
                  <input name="last_name" required />
                </label>
                <label className="field">
                  <span>Email</span>
                  <input name="email" required type="email" />
                </label>
                <label className="field">
                  <span>Phone</span>
                  <input name="phone" type="tel" />
                </label>
                <label className="field">
                  <span>City</span>
                  <input name="city" />
                </label>
                <label className="field">
                  <span>State</span>
                  <input name="state" defaultValue="SC" />
                </label>
                <label className="field">
                  <span>ZIP</span>
                  <input name="zip" />
                </label>
                <label className="field">
                  <span>Role interest</span>
                  <select name="role_interest" defaultValue="General Interest">
                    <option>Field Service Technician</option>
                    <option>Route Lead</option>
                    <option>Customer Support / Scheduling</option>
                    <option>Part-Time Launch Help</option>
                    <option>General Interest</option>
                  </select>
                </label>
              </div>

              <fieldset className="choice-grid">
                <legend>Availability</legend>
                {availabilityOptions.map((option) => (
                  <label className="choice-card" key={option}>
                    <input name="availability" type="checkbox" value={option} />
                    <span>{option}</span>
                  </label>
                ))}
              </fieldset>

              <fieldset className="choice-grid">
                <legend>Work basics</legend>
                <label className="choice-card">
                  <input name="has_valid_drivers_license" type="checkbox" />
                  <span>I have a valid driver&apos;s license</span>
                </label>
                <label className="choice-card">
                  <input name="comfortable_outdoors" type="checkbox" />
                  <span>I am comfortable working outdoors</span>
                </label>
                <label className="choice-card">
                  <input name="comfortable_lifting" type="checkbox" />
                  <span>I am comfortable with physical route work</span>
                </label>
              </fieldset>

              <label className="field">
                <span>Relevant experience</span>
                <textarea
                  name="experience"
                  placeholder="Service work, driving/routes, outdoor work, customer support, leadership, military experience, etc."
                />
              </label>
              <label className="field">
                <span>Message</span>
                <textarea name="message" placeholder="Anything else we should know?" />
              </label>

              <div className="choice-grid">
                <label className="choice-card">
                  <input name="understands" required type="checkbox" />
                  <span>
                    I understand this is an interest/application form and does
                    not guarantee employment.
                  </span>
                </label>
                <label className="choice-card">
                  <input name="consent" required type="checkbox" />
                  <span>
                    I consent to Clean Curb Co. contacting me about future
                    opportunities.
                  </span>
                </label>
              </div>

              <button className="button button-primary" type="submit">
                Submit Interest Form
              </button>
            </form>
          </section>
        </div>
      </section>
    </main>
  );
}
