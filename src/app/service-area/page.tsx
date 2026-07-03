import { ServiceAreaSection } from "@/components/sections/home-sections";
import { publicPageMetadata } from "@/lib/seo";

export const metadata = publicPageMetadata({
  title: "Service Area",
  description:
    "Clean Curb Co. is now serving Cane Bay and nearby Summerville communities with route-based bin cleaning.",
  path: "/service-area",
});

export default function ServiceAreaPage() {
  return (
    <main>
      <section className="page-hero">
        <div className="container section-header">
          <p className="section-kicker">Service Area</p>
          <h1>Now serving Cane Bay.</h1>
          <p>
            We are building routes neighborhood by neighborhood across Cane Bay
            and nearby Summerville communities. Close by but not sure? The
            checker below will help.
          </p>
        </div>
      </section>
      <ServiceAreaSection />
    </main>
  );
}
