import { FAQSection } from "@/components/sections/home-sections";
import { publicPageMetadata } from "@/lib/seo";

export const metadata = publicPageMetadata({
  title: "FAQ",
  description:
    "Answers about Clean Curb Co. garbage bin cleaning, water use, wastewater, recurring service, and route scheduling.",
  path: "/faq",
});

export default function FAQPage() {
  return (
    <main>
      <section className="page-hero">
        <div className="container section-header">
          <p className="section-kicker">FAQ</p>
          <h1>Quick answers before trash day.</h1>
          <p>
            The short version: empty bins, accessible location, clear route-day
            texts, cleaner curb.
          </p>
        </div>
      </section>
      <FAQSection />
    </main>
  );
}
