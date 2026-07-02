import type { Metadata } from "next";
import { brand } from "@/lib/site";

export const metadata: Metadata = {
  title: "Photo & Media Release",
  description: "Clean Curb Co. photo, video, before-and-after, and marketing media policy.",
};

export default function PhotoMediaReleasePage() {
  return (
    <main>
      <section className="page-hero">
        <div className="container section-header">
          <p className="section-kicker">Photos & Media</p>
          <h1>Photo & Media Release</h1>
          <p>
            How Clean Curb Co. handles service photos, before-and-after images,
            marketing photos, videos, testimonials, and customer permission.
          </p>
        </div>
      </section>

      <section className="section section-white">
        <div className="container legal-copy">
          <p className="muted">Effective date: July 2, 2026</p>

          <h2>1. Service documentation photos</h2>
          <p>
            Clean Curb Co. may take photos, short videos, timestamps, route
            notes, and service records to document bin condition, customer
            readiness, access issues, before-and-after results, service
            completion, safety concerns, property limitations, missed service,
            damage concerns, quality control, billing disputes, or customer
            support issues.
          </p>

          <h2>2. Privacy-first approach</h2>
          <p>
            When taking service documentation photos, we aim to avoid capturing
            faces, children, license plates, house numbers, sensitive property
            details, security systems, open garages, personal items, or anything
            unrelated to the service whenever reasonably practicable.
          </p>

          <h2>3. Internal and operational use</h2>
          <p>
            Service documentation may be used internally for customer support,
            route records, employee or contractor training, quality review,
            payment disputes, safety review, insurance or legal issues, and
            business records. These operational photos are handled under our
            Privacy Policy and are not automatically approved for public
            marketing use.
          </p>

          <h2>4. Marketing use requires permission or de-identification</h2>
          <p>
            We will not intentionally use clearly identifiable customer homes,
            people, private property details, or personal information in public
            marketing without permission. We may use de-identified or cropped
            service images that do not reasonably identify a customer, address,
            person, vehicle, or private property detail.
          </p>

          <h2>5. Optional media release</h2>
          <p>
            If you give Clean Curb Co. permission to use photos, videos,
            testimonials, reviews, or before-and-after images for marketing, you
            authorize Clean Curb Co. and Stonebranch Capital LLC to use,
            reproduce, edit, crop, publish, display, and share the approved
            content in websites, social media, ads, brochures, emails, route
            updates, and other business materials without additional payment,
            unless we agree otherwise in writing.
          </p>

          <h2>6. No endorsement unless stated</h2>
          <p>
            Use of a photo, video, review, or testimonial does not mean the
            customer endorses every Clean Curb Co. product, service, statement,
            or future campaign. We may edit content for length, clarity,
            formatting, privacy, or presentation, but we will not knowingly
            change a testimonial in a way that materially misrepresents the
            customer&apos;s experience.
          </p>

          <h2>7. Permission can be withdrawn for future use</h2>
          <p>
            You may contact us to withdraw permission for future marketing use
            of identifiable photos, videos, or testimonials. We will make a
            reasonable effort to stop future use after processing the request,
            but we may not be able to remove content already printed,
            distributed, cached, shared by others, or used in completed
            campaigns.
          </p>

          <h2>8. Customer-submitted content</h2>
          <p>
            If you send us photos, videos, reviews, testimonials, screenshots,
            or other content, you confirm that you have the right to share it
            with us and that it does not violate another person&apos;s privacy,
            intellectual property, or legal rights. Do not send us content that
            includes private information you do not want us to receive.
          </p>

          <h2>9. Minors and sensitive situations</h2>
          <p>
            Clean Curb Co. does not seek to photograph children, private family
            activities, medical information, sensitive locations, or unrelated
            personal matters. Please notify us if a service location has special
            privacy concerns so we can make reasonable efforts to avoid or limit
            photos beyond what is necessary for service records.
          </p>

          <h2>10. Contact</h2>
          <p>
            Photo, media, or marketing permission questions can be sent to{" "}
            <a href={brand.emailHref}>{brand.email}</a> or handled by calling{" "}
            <a href={brand.phoneHref}>{brand.phone}</a>.
          </p>

          <p className="muted">{brand.legalNote}</p>
        </div>
      </section>
    </main>
  );
}
