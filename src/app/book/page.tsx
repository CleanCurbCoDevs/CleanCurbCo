import type { Metadata } from "next";
import { BookingForm } from "@/components/booking/booking-form";
import type { ServiceFrequency } from "@/types/booking";

export const metadata: Metadata = {
  title: "Book Garbage Bin Cleaning",
  description:
    "Request garbage bin cleaning for Cane Bay and nearby Summerville communities.",
};

type BookPageProps = {
  searchParams: Promise<{ ref?: string; frequency?: string }>;
};

export default async function BookPage({ searchParams }: BookPageProps) {
  const params = await searchParams;

  return (
    <main>
      <section className="page-hero">
        <div className="container section-header">
          <p className="section-kicker">Book in under 2 minutes</p>
          <h1>Join the Cane Bay route.</h1>
          <p>
            Tell us what needs cleaning. We will confirm your route day, final
            price, and payment link by text before service.
          </p>
        </div>
      </section>
      <section className="section section-cream">
        <div className="container">
          <BookingForm
            initialFrequency={parseFrequencyParam(params.frequency)}
            initialReferralCode={params.ref ?? ""}
          />
        </div>
      </section>
    </main>
  );
}

function parseFrequencyParam(value?: string): ServiceFrequency | undefined {
  const frequencies: Record<string, ServiceFrequency> = {
    "one-time": "one_time",
    one_time: "one_time",
    monthly: "monthly",
    "every-other-month": "every_other_month",
    every_other_month: "every_other_month",
    quarterly: "quarterly",
  };

  return value ? frequencies[value.toLowerCase()] : undefined;
}
