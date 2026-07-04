import {
  BookingForm,
  type InitialBookingCustomer,
} from "@/components/booking/booking-form";
import { publicPageMetadata } from "@/lib/seo";
import {
  bookingBillingAfterLaunchNotice,
  neighborhoods,
} from "@/lib/site";
import type { ServiceFrequency } from "@/types/booking";
import { LaunchStatusCard } from "@/components/launch-status-card";

export const metadata = publicPageMetadata({
  title: "Book Garbage Bin Cleaning",
  description:
    "Request garbage bin cleaning for Cane Bay and nearby Summerville communities.",
  path: "/book",
});

type BookPageProps = {
  searchParams: Promise<{
    ref?: string;
    frequency?: string;
    streetAddress?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    neighborhood?: string;
    serviceAreaChecked?: string;
  }>;
};

export default async function BookPage({ searchParams }: BookPageProps) {
  const params = await searchParams;

  return (
    <main>
      <section className="page-hero">
        <div className="container section-header">
          <p className="section-kicker">Book in under 2 minutes</p>
          <h1>Join a local route.</h1>
          <p>
            Tell us what needs cleaning. We will confirm your route day, final
            price, and payment timing by email or text when available before
            service. Launch bookings reserve your spot without an immediate charge.
          </p>
        </div>
      </section>
      <section className="section section-cream">
        <div className="container">
          <div className="booking-launch-grid">
            <LaunchStatusCard variant="card" className="launch-info-card" />
            <article className="launch-info-card">
              <p className="section-kicker">Billing after launch</p>
              <h2>August billing rhythm.</h2>
              <p>{bookingBillingAfterLaunchNotice}</p>
            </article>
          </div>
          <BookingForm
            initialCustomer={parseCustomerParams(params)}
            initialFrequency={parseFrequencyParam(params.frequency)}
            initialReferralCode={params.ref ?? ""}
            serviceAreaChecked={params.serviceAreaChecked === "yes"}
            turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""}
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

function parseCustomerParams(
  params: Awaited<BookPageProps["searchParams"]>,
): InitialBookingCustomer {
  const initialCustomer: InitialBookingCustomer = {};
  const streetAddress = cleanParam(params.streetAddress);
  const city = cleanParam(params.city);
  const state = cleanParam(params.state);
  const zipCode = cleanParam(params.zipCode);
  const neighborhood = cleanNeighborhoodParam(params.neighborhood);

  if (streetAddress) initialCustomer.streetAddress = streetAddress;
  if (city) initialCustomer.city = city;
  if (state) initialCustomer.state = state;
  if (zipCode) initialCustomer.zipCode = zipCode;
  if (neighborhood) initialCustomer.neighborhood = neighborhood;

  return initialCustomer;
}

function cleanParam(value?: string) {
  return value?.trim().slice(0, 180) ?? "";
}

function cleanNeighborhoodParam(value?: string) {
  const cleanValue = cleanParam(value);
  if (!cleanValue) {
    return "";
  }

  return neighborhoods.includes(cleanValue) ? cleanValue : "Other / Not sure";
}
