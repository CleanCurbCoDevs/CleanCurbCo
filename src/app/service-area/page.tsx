import { ServiceAreaSection } from "@/components/sections/home-sections";
import { publicPageMetadata } from "@/lib/seo";

export const metadata = publicPageMetadata({
  title: "Garbage Bin Cleaning Service Area",
  description:
    "Clean Curb Co. provides route-based garbage bin cleaning throughout Goose Creek, Summerville, Moncks Corner, Cane Bay, and nearby Lowcountry communities.",
  path: "/service-area",
});

export default function ServiceAreaPage() {
  return (
    <main>
      <section className="page-hero">
        <div className="container section-header">
          <p className="section-kicker">Service Area</p>

          <h1>Local bin cleaning routes across the Lowcountry.</h1>

          <p>
            Clean Curb Co. serves Goose Creek, Summerville, Moncks Corner,
            Cane Bay, Nexton, Carnes Crossroads, and nearby communities when
            route availability and distance allow. Enter your address below
            and we will check the actual route fit.
          </p>
        </div>
      </section>

      <ServiceAreaSection />
    </main>
  );
}
