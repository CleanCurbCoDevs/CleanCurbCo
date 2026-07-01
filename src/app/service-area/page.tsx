import type { Metadata } from "next";
import { ServiceAreaSection } from "@/components/sections/home-sections";

export const metadata: Metadata = {
  title: "Service Area",
  description:
    "Clean Curb Co. is now serving Cane Bay and nearby Summerville communities with route-based bin cleaning.",
};

export default function ServiceAreaPage() {
  return (
    <main>
      <section className="page-hero">
        <div className="container section-header">
          <p className="section-kicker">Service Area</p>
          <h1>Now serving Cane Bay.</h1>
          <p>
            We are starting with Cane Bay and nearby Summerville communities,
            then expanding route by route. Close by but not sure? Use the
            instant checker below for a quick yes or no before booking.
          </p>
        </div>
      </section>
      <ServiceAreaSection />
    </main>
  );
}
