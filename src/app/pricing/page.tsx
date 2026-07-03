import { AddOnsSection, PricingSection } from "@/components/sections/home-sections";
import { publicPageMetadata } from "@/lib/seo";

export const metadata = publicPageMetadata({
  title: "Pricing",
  description:
    "Clean Curb Co. garbage bin cleaning pricing for Cane Bay and nearby Summerville communities.",
  path: "/pricing",
});

export default function PricingPage() {
  return (
    <main>
      <section className="page-hero">
        <div className="container section-header">
          <p className="section-kicker">Pricing</p>
          <h1>Simple bin cleaning prices.</h1>
          <p>
            One-time cleans, recurring route service, and practical add-ons for
            dirty outdoor problems. Recurring service keeps the stink from
            getting a comeback tour.
          </p>
        </div>
      </section>
      <PricingSection />
      <AddOnsSection />
    </main>
  );
}
