import type { Metadata } from "next";
import { Camera, Droplets, Sparkles, SprayCan, Truck } from "lucide-react";
import {
  AddOnsSection,
  FutureServicesSection,
  HowItWorksSection,
} from "@/components/sections/home-sections";
import { SectionHeader } from "@/components/section-header";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Residential garbage bin cleaning, sanitizing, deodorizing, and supportive outdoor add-ons in Cane Bay, SC.",
};

export default function ServicesPage() {
  const serviceValues = [
    {
      icon: SprayCan,
      title: "Sanitizing",
      copy: "We target the inside walls, rim, lid, handles, and high-touch areas where bin grime builds up.",
    },
    {
      icon: Sparkles,
      title: "Deodorizing",
      copy: "A fresh finish helps knock back the trash-day smell that likes to linger near garages.",
    },
    {
      icon: Droplets,
      title: "Grime removal",
      copy: "High-pressure rinsing helps clear residue, leaked bag mess, and the mystery layer nobody wants to name.",
    },
    {
      icon: Truck,
      title: "Curbside convenience",
      copy: "Leave empty bins accessible on route day. We handle the dirty work outside.",
    },
    {
      icon: Camera,
      title: "Completion photos",
      copy: "After service, customers get a clear update with proof that the bins were cleaned.",
    },
  ];

  return (
    <main>
      <section className="page-hero">
        <div className="container section-header">
          <p className="section-kicker">Services</p>
          <h1>Residential garbage bin cleaning first.</h1>
          <p>
            Cleaner, fresher trash and recycling bins for Cane Bay neighbors.
            Simple route-day service, clear texts, and proof when the job is done.
          </p>
        </div>
      </section>
      <section className="section section-white section-tight">
        <div className="container">
          <SectionHeader
            kicker="Flagship service"
            title="The bin reset your garage has been quietly begging for."
          >
            Our launch focus is residential garbage bin cleaning: sanitizing,
            deodorizing, grime removal, curbside convenience, and completion
            photos after service.
          </SectionHeader>
          <div className="service-value-grid">
            {serviceValues.map((item) => {
              const Icon = item.icon;
              return (
                <article className="service-value-card" key={item.title}>
                  <Icon size={22} aria-hidden="true" />
                  <h3>{item.title}</h3>
                  <p>{item.copy}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>
      <HowItWorksSection />
      <AddOnsSection />
      <FutureServicesSection />
    </main>
  );
}
