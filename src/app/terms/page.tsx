import type { Metadata } from "next";
import { brand } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Clean Curb Co. service terms.",
};

export default function TermsPage() {
  return (
    <main>
      <section className="page-hero">
        <div className="container section-header">
          <p className="section-kicker">Terms</p>
          <h1>Terms of Service</h1>
          <p>
            Friendly service, clear expectations, and clean bins without the
            mystery.
          </p>
        </div>
      </section>
      <section className="section section-white">
        <div className="container legal-copy">
          <h2>Booking requests and confirmation</h2>
          <p>
            Submitting a booking request does not guarantee a specific service
            date or time. Clean Curb Co. will confirm your route day, service
            details, final price, and payment link before service whenever
            practical.
          </p>
          <h2>Launch Timing and Billing</h2>
          <p>
            Clean Curb Co&apos;s first route is planned for July 13, 2026.
            Bookings submitted before that date are reservation requests and
            do not guarantee immediate service. Customers who book before
            launch will not be charged until Clean Curb Co. is ready to confirm
            service details, route timing, and payment instructions.
          </p>
          <p>
            During the launch period, recurring service billing may be
            collected at the beginning of the applicable service month.
            Starting August 1, 2026, new bookings may be charged when submitted
            or confirmed. Recurring plans will then bill on the same calendar
            day according to the customer&apos;s selected frequency, unless
            otherwise adjusted with notice.
          </p>
          <p>
            Clean Curb Co. may change billing or payment dates with customer
            notification when needed for routing, payment processing, service
            scheduling, or operational reasons.
          </p>
          <h2>Route-day scheduling</h2>
          <p>
            We schedule by neighborhood routes to keep service affordable,
            reliable, and efficient. Route days may change because of weather,
            equipment issues, staffing, unsafe conditions, or route
            adjustments.
          </p>
          <h2>Estimated and final pricing</h2>
          <p>
            Prices shown on the website are estimates based on bin count,
            frequency, and selected add-ons. Starting-at services, heavy grime,
            unsafe conditions, extra bins, or unusual access needs may change
            the final price. We will confirm the final price before service or
            before additional work is performed.
          </p>
          <h2>Payment</h2>
          <p>
            Payment may be due at booking, before service, or after completion
            depending on the service selected. Payment links may be sent by
            email or text. Manual payment options may be accepted when
            arranged with Clean Curb Co.
          </p>
          <h2>Recurring service</h2>
          <p>
            Recurring service is designed to keep bins fresh without rebooking
            every visit. Route timing may vary by neighborhood. Customers are
            responsible for keeping bins empty and accessible on scheduled
            service days.
          </p>
          <h2>Cancellations and rescheduling</h2>
          <p>
            Please request cancellations, pauses, or rescheduling as early as
            possible. Last-minute changes may require review and may be subject
            to a cancellation fee or the original scheduled charge when routes,
            prep work, supplies, and scheduling have already been planned.
          </p>
          <h2>Service access</h2>
          <p>
            Bins must be empty, safe to clean, and accessible at the scheduled
            service time. Please place bins where they are visible and
            reachable, such as curbside, driveway, side of garage, or another
            agreed location.
          </p>
          <h2>Full, blocked, or unsafe bins</h2>
          <p>
            Full bins, blocked bins, hazardous waste, wet paint, chemicals,
            concrete, human or animal remains, unsafe materials, severe odors
            beyond normal service conditions, broken bins, loose trash, or
            unsafe property conditions may be rescheduled, refused, or subject
            to additional fees.
          </p>
          <h2>Water use</h2>
          <p>
            At launch, Clean Curb Co. may use an exterior water spigot at the
            service address when needed. Water usage is minimal and may be
            recorded with an inline meter.
          </p>
          <h2>Wastewater</h2>
          <p>
            We use reasonable efforts to collect, manage, or redirect
            wastewater when appropriate and avoid intentional discharge into
            storm drains.
          </p>
          <h2>Weather, access, and equipment</h2>
          <p>
            Service may be delayed or rescheduled due to weather, equipment
            issues, inaccessible bins, or unsafe conditions.
          </p>
          <h2>Add-ons</h2>
          <p>
            Add-ons must be selected or approved before service. Some add-ons
            are listed as starting-at prices because the final effort depends
            on the condition, size, and access of the area.
          </p>
          <h2>Service photos</h2>
          <p>
            Clean Curb Co. may take before/after photos for service
            verification, completion updates, customer records, and quality
            control. We do not identify your address publicly without
            permission.
          </p>
          <h2>Service limits</h2>
          <p>
            We work to clean, sanitize, deodorize, and freshen bins, but some
            permanent stains, deep scratches, old embedded odors, sun damage,
            prior chemical exposure, or damaged bin surfaces may not fully come
            out. We do not guarantee removal of every stain or odor.
          </p>
          <h2>The Fresh Start Promise</h2>
          <p>
            If you are not happy, let us know within 24 hours and we will come
            back and make it right at no additional charge.
          </p>
          <h2>Contact</h2>
          <p>
            Questions about service terms can be sent to{" "}
            <a href={brand.emailHref}>{brand.email}</a> or by calling{" "}
            <a href={brand.phoneHref}>{brand.phone}</a>.
          </p>
          <p className="muted">{brand.legalNote}</p>
        </div>
      </section>
    </main>
  );
}
