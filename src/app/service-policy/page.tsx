import type { Metadata } from "next";
import { brand } from "@/lib/site";

export const metadata: Metadata = {
  title: "Service Policy",
  description: "Clean Curb Co. service policy and service limitations.",
};

export default function ServicePolicyPage() {
  return (
    <main>
      <section className="page-hero">
        <div className="container section-header">
          <p className="section-kicker">Service Rules</p>
          <h1>Service Policy & Service Limitations</h1>
          <p>
            What customers should expect before, during, and after a Clean Curb
            Co. bin cleaning visit.
          </p>
        </div>
      </section>

      <section className="section section-white">
        <div className="container legal-copy">
          <p className="muted">Effective date: July 2, 2026</p>

          <h2>1. Route-based service</h2>
          <p>
            Clean Curb Co. provides route-based bin cleaning and related add-on
            services in selected neighborhoods and service areas. We may accept,
            decline, waitlist, reschedule, or modify service based on route
            availability, service density, safety, weather, staffing, equipment,
            water restrictions, operational readiness, and business needs.
          </p>

          <h2>2. Customer preparation requirements</h2>
          <p>
            Unless we agree otherwise in writing, bins must be empty, accessible,
            and placed at the curb or agreed service location by the scheduled
            route time. Bins should not be packed with loose trash, bags,
            yard waste, bulk items, hazardous materials, chemicals, paint, oil,
            fuel, medical waste, needles, dead animals, concrete, construction
            debris, human waste, or anything that would make service unsafe or
            outside our normal scope.
          </p>

          <h2>3. Access and safety</h2>
          <p>
            You are responsible for providing accurate gate codes, parking
            instructions, HOA or neighborhood rules, pet warnings, access notes,
            and safety information. Please keep children, pets, and bystanders
            away from the service area while work is being performed.
          </p>

          <h2>4. Reasons we may skip or refuse service</h2>
          <p>
            We may skip, refuse, stop, or reschedule service if bins or the
            service area are unsafe, inaccessible, unsanitary beyond normal
            household-bin conditions, contaminated, blocked, not empty, not
            present, located somewhere we cannot legally or safely access, or if
            service would violate law, property rules, equipment limitations,
            safety rules, or environmental requirements.
          </p>

          <h2>5. Cleaning results are not guaranteed to be perfect</h2>
          <p>
            Bin cleaning can greatly improve cleanliness and odor, but results
            vary. We do not guarantee complete removal of all stains, odors,
            bacteria, mold, mildew, insects, maggots, scratches, discoloration,
            embedded grime, paint, tar, oil, chemical residue, sun damage,
            manufacturer defects, or pre-existing conditions.
          </p>

          <h2>6. Bin condition and pre-existing damage</h2>
          <p>
            Bins are exposed to weather, trash, collection trucks, and normal
            wear. We are not responsible for pre-existing damage or weakness,
            including cracked plastic, brittle lids, damaged hinges, broken
            wheels, loose handles, faded surfaces, collection-truck damage, or
            manufacturer defects. If we notice obvious damage, we may document
            it in service notes or photos.
          </p>

          <h2>7. Add-on services</h2>
          <p>
            Add-ons such as driveway, sidewalk, curb-area, or exterior surface
            cleaning are limited-scope services unless we expressly agree to a
            larger job in writing. Add-ons are not deep restoration, sealing,
            repair, stain-removal guarantees, mold remediation, pest control,
            landscaping, plumbing, hazardous cleanup, or property maintenance.
          </p>

          <h2>8. Weather and operational delays</h2>
          <p>
            We may reschedule or delay service due to rain, lightning, severe
            heat, freezing conditions, high winds, unsafe roads, equipment
            problems, staffing issues, illness, emergencies, water restrictions,
            route problems, or other conditions outside our reasonable control.
          </p>

          <h2>9. Photos and completion records</h2>
          <p>
            We may use photos, checklists, timestamps, route notes, and service
            records to confirm bin condition, document completion, support
            customer updates, respond to service questions, improve quality, and
            resolve disputes.
          </p>

          <h2>10. Environmental and compliance limits</h2>
          <p>
            We aim to operate responsibly and may adjust service methods to
            comply with applicable rules, wastewater handling requirements,
            water restrictions, local ordinances, property rules, or safety
            requirements. If service cannot be performed responsibly at a
            location, we may decline or reschedule the visit.
          </p>

          <h2>11. Service issues</h2>
          <p>
            If you are unhappy with a completed service, contact us as soon as
            possible with a description and photos if available. Depending on
            the situation, we may offer a re-clean, credit, partial refund, full
            refund, or another reasonable resolution at our discretion and as
            required by law.
          </p>

          <h2>12. Contact</h2>
          <p>
            Service questions can be sent to <a href={brand.emailHref}>{brand.email}</a>{" "}
            or handled by calling <a href={brand.phoneHref}>{brand.phone}</a>.
          </p>

          <p className="muted">{brand.legalNote}</p>
        </div>
      </section>
    </main>
  );
}
