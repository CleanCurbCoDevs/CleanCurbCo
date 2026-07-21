import {
  BookingForm,
  type InitialBookingCustomer,
} from "@/components/booking/booking-form";
import { publicPageMetadata } from "@/lib/seo";
import { neighborhoods } from "@/lib/site";
import type { ServiceFrequency } from "@/types/booking";

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
          <p className="section-kicker">
            Now booking local routes
          </p>

          <h1>Let’s get those bins handled.</h1>

          <p>
            Trash cans get gross. We clean, sanitize, and deodorize
            them right at the curb—starting at $25.
          </p>

          <div className="hero-actions">
            <a
              className="button button-dark"
              href="#booking-form"
            >
              Start My Booking
            </a>
          </div>

          <p className="muted">
            No need to be home • Secure checkout • Completion photos included
          </p>
        </div>
      </section>

      <section className="section section-cream">
        <div className="container">
          <div className="booking-launch-grid">
            <div
              className="form-status-message form-status-success"
              role="status"
            >
              <strong>Now booking neighborhood routes.</strong>{" "}
              Tell us your normal collection day and we’ll coordinate
              the cleaning around when your bins are emptied.
            </div>
          </div>

          <BookingForm
            initialCustomer={parseCustomerParams(params)}
            initialFrequency={parseFrequencyParam(params.frequency)}
            initialReferralCode={params.ref ?? ""}
            serviceAreaChecked={params.serviceAreaChecked === "yes"}
            turnstileSiteKey={
              process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""
            }
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
