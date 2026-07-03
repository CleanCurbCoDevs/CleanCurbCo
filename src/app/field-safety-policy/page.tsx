import { brand } from "@/lib/site";
import { publicPageMetadata } from "@/lib/seo";

export const metadata = publicPageMetadata({
  title: "Field Safety Policy",
  description: "Clean Curb Co. employee and contractor field safety policy.",
  path: "/field-safety-policy",
});

export default function FieldSafetyPolicyPage() {
  return (
    <main>
      <section className="page-hero">
        <div className="container section-header">
          <p className="section-kicker">Internal Safety</p>
          <h1>Employee & Contractor Field Safety Policy</h1>
          <p>
            Safety expectations for Clean Curb Co. route work, equipment use,
            heat, traffic, chemicals, customers, property, and incident reporting.
          </p>
        </div>
      </section>

      <section className="section section-white">
        <div className="container legal-copy">
          <p className="muted">Effective date: July 2, 2026</p>

          <h2>1. Purpose</h2>
          <p>
            Clean Curb Co. expects all employees, contractors, helpers, owners,
            operators, and other field personnel to work safely, follow training,
            use common sense, and stop work when conditions are unsafe. This
            policy is intended to support safe operations and does not replace
            any required training, equipment manual, OSHA requirement, workers&apos;
            compensation rule, insurance requirement, or site-specific safety
            plan.
          </p>

          <h2>2. Stop-work authority</h2>
          <p>
            Every field worker has authority to pause, refuse, or stop work if
            they reasonably believe a task, location, customer interaction,
            weather condition, bin contents, equipment issue, traffic condition,
            animal, chemical, or other hazard may be unsafe. No worker should be
            punished for making a good-faith safety stop.
          </p>

          <h2>3. Training and instructions</h2>
          <p>
            Workers must complete assigned training before operating equipment,
            handling chemicals, driving for routes, interacting with wastewater
            systems, performing add-on services, or working without direct
            supervision. Workers must follow manufacturer instructions, safety
            labels, company procedures, route notes, and supervisor directions.
          </p>

          <h2>4. Personal protective equipment</h2>
          <p>
            Workers must use required personal protective equipment for the task,
            which may include gloves, eye protection, hearing protection,
            non-slip footwear, high-visibility clothing or vest, sun protection,
            respiratory protection when required, and any other equipment
            assigned by Clean Curb Co. Damaged, missing, or inadequate PPE must
            be reported before work continues.
          </p>

          <h2>5. Heat, hydration, and weather</h2>
          <p>
            Field work may involve heat, humidity, sun exposure, storms,
            lightning, slippery surfaces, or cold conditions. Workers should
            hydrate, take breaks, watch for heat illness symptoms, use shade or
            cooling when possible, and report weather-related concerns. Work
            must stop during lightning, severe weather, or conditions that make
            safe service impractical.
          </p>

          <h2>6. Traffic, parking, and route safety</h2>
          <p>
            Workers must park legally and safely, use hazard awareness around
            traffic, avoid blocking roads or driveways unless authorized, follow
            traffic laws, and use high-visibility gear when working near roads,
            curbs, parking lots, loading zones, or multi-family properties.
            Workers should never step into traffic or create a hazard to finish
            a stop.
          </p>

          <h2>7. Equipment safety</h2>
          <p>
            Equipment must be inspected before use. Workers must not bypass
            guards, ignore leaks, use damaged hoses, operate malfunctioning
            pumps, run unsafe pressure settings, exceed equipment limits, or use
            equipment they have not been trained to use. Equipment defects,
            unusual sounds, leaks, electrical issues, pressure problems, or fuel
            concerns must be reported immediately.
          </p>

          <h2>8. Chemicals and hazardous materials</h2>
          <p>
            Workers must only use approved cleaning products and must follow
            label directions, dilution instructions, storage rules, and safety
            data sheet guidance. Workers must not service bins containing
            hazardous materials, needles, medical waste, chemicals, fuel, oil,
            paint, human waste, dead animals, explosives, or unknown substances
            unless management has reviewed and approved a safe plan.
          </p>

          <h2>9. Wastewater and environmental handling</h2>
          <p>
            Workers must follow company procedures for wastewater capture,
            disposal, containment, spill prevention, and environmental
            compliance. Do not knowingly discharge wastewater, chemicals, trash,
            or contaminants in a way that violates company procedures,
            applicable law, property rules, or environmental requirements.
          </p>

          <h2>10. Customer, pet, and public interaction</h2>
          <p>
            Workers should be professional, calm, and respectful with customers,
            residents, pedestrians, HOA staff, property managers, and the public.
            Workers should avoid arguments, leave if threatened, and report
            aggressive behavior. Do not enter fenced areas, garages, homes,
            backyards, or restricted areas unless specifically authorized and
            safe. Avoid contact with unknown animals.
          </p>

          <h2>11. Property protection</h2>
          <p>
            Workers should take reasonable care around vehicles, landscaping,
            driveways, decorative surfaces, gates, fences, mailboxes, utilities,
            lighting, cameras, and other property. Pre-existing damage or unsafe
            property conditions should be documented when noticed. Report any
            suspected property damage immediately.
          </p>

          <h2>12. Drugs, alcohol, fatigue, and fitness for duty</h2>
          <p>
            Workers may not perform field work while impaired by alcohol,
            illegal drugs, misused medication, extreme fatigue, illness, or any
            condition that prevents safe work. Workers should report when they
            are not fit for duty so routes can be adjusted safely.
          </p>

          <h2>13. Incidents, injuries, near misses, and complaints</h2>
          <p>
            Workers must promptly report injuries, illnesses, vehicle incidents,
            equipment failures, property damage, spills, customer complaints,
            threats, aggressive animals, near misses, or unsafe conditions.
            Serious injuries, emergencies, fires, chemical exposure, traffic
            hazards, or threats to life or safety require immediate emergency
            response first, then company reporting as soon as safe.
          </p>

          <h2>14. No employment contract</h2>
          <p>
            This policy does not create an employment contract, guarantee of
            work, independent contractor relationship, benefit, or specific
            disciplinary process. Clean Curb Co. may revise safety rules,
            training, equipment requirements, route procedures, and operational
            controls as business needs and legal requirements change.
          </p>

          <h2>15. Contact</h2>
          <p>
            Safety questions or incident reports can be sent to{" "}
            <a href={brand.emailHref}>{brand.email}</a> or handled by calling{" "}
            <a href={brand.phoneHref}>{brand.phone}</a>. Emergencies should be
            directed to 911 or the appropriate emergency service first.
          </p>

          <p className="muted">{brand.legalNote}</p>
        </div>
      </section>
    </main>
  );
}
