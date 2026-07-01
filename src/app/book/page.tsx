import type { Metadata } from "next";
import { BookingForm } from "@/components/booking/booking-form";

export const metadata: Metadata = {
  title: "Book Garbage Bin Cleaning",
  description:
    "Request garbage bin cleaning for Cane Bay and nearby Summerville communities.",
};

type BookPageProps = {
  searchParams: Promise<{ ref?: string }>;
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
            price, and payment link by text.
          </p>
        </div>
      </section>
      <section className="section section-cream">
        <div className="container">
          <BookingForm initialReferralCode={params.ref ?? ""} />
        </div>
      </section>
    </main>
  );
}
