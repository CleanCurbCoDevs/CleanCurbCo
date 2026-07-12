"use client";

import Link from "next/link";
import {
  CheckCircle2,
  MapPin,
  Search,
  XCircle,
} from "lucide-react";
import {
  useMemo,
  useState,
  type FormEvent,
} from "react";

type ServiceAreaInput = {
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  neighborhood: string;
};

type ServiceAreaCheckResult = {
  status: "covered" | "not_covered" | "unverified";
  message: string;
  latitude?: number;
  longitude?: number;
  distanceMiles?: number;
  maxRadiusMiles: number;
  matchedAddress?: string;
  requestId?: string;
};

const defaultInput: ServiceAreaInput = {
  streetAddress: "",
  city: "Summerville",
  state: "SC",
  zipCode: "",
  neighborhood: "Other / Not sure",
};

const neighborhoods = [
  "Cane Bay Plantation",
  "Lindera Preserve",
  "The Oaks",
  "Old Rice Retreat",
  "Sanctuary Cove",
  "Four Seasons",
  "Lakes of Cane Bay",
  "Downtown Summerville",
  "Nexton",
  "Carnes Crossroads",
  "Sangaree",
  "Goose Creek",
  "Moncks Corner",
  "Other / Not sure",
];

export function ServiceAreaChecker() {
  const [input, setInput] =
    useState<ServiceAreaInput>(defaultInput);
  const [result, setResult] =
    useState<ServiceAreaCheckResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState("");

  const normalizedInput = useMemo(
    () => ({
      streetAddress: input.streetAddress.trim(),
      city: input.city.trim(),
      state: input.state.trim(),
      zipCode: input.zipCode.trim(),
      neighborhood: input.neighborhood.trim(),
    }),
    [input],
  );

  const canCheck =
    normalizedInput.streetAddress.length >= 5 &&
    normalizedInput.city.length >= 2 &&
    normalizedInput.state.length >= 2 &&
    /^\d{5}(?:-\d{4})?$/.test(normalizedInput.zipCode);

  function updateField<K extends keyof ServiceAreaInput>(
    key: K,
    value: ServiceAreaInput[K],
  ) {
    setInput((current) => ({
      ...current,
      [key]: value,
    }));

    setResult(null);
    setError("");
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!canCheck || isChecking) {
      return;
    }

    setIsChecking(true);
    setResult(null);
    setError("");

    try {
      const response = await fetch("/api/service-area", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          streetAddress: normalizedInput.streetAddress,
          city: normalizedInput.city,
          state: normalizedInput.state,
          zipCode: normalizedInput.zipCode,
        }),
      });

      const data = (await response.json()) as
        | ServiceAreaCheckResult
        | {
            error?: string;
            requestId?: string;
          };

      if (!response.ok || !("status" in data)) {
        throw new Error(
          data.error ??
            "We could not check that address. Please try again.",
        );
      }

      setResult(data);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "We could not check that address. Please try again.",
      );
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <div className="address-checker" id="check-address">
      <div className="address-checker-heading">
        <MapPin size={22} aria-hidden="true" />

        <div>
          <h3>Check your address</h3>
          <p>
            We will check your actual distance from our current
            service hub. No booking, no contact form, no weirdness.
          </p>
        </div>
      </div>

      <form
        className="address-checker-form"
        onSubmit={handleSubmit}
      >
        <label className="field">
          <span>Street address *</span>

          <input
            value={input.streetAddress}
            onChange={(event) =>
              updateField(
                "streetAddress",
                event.target.value,
              )
            }
            placeholder="123 Main Street"
            autoComplete="street-address"
            required
          />
        </label>

        <div className="address-checker-grid">
          <label className="field">
            <span>City *</span>

            <input
              value={input.city}
              onChange={(event) =>
                updateField("city", event.target.value)
              }
              autoComplete="address-level2"
              required
            />
          </label>

          <label className="field">
            <span>State *</span>

            <input
              value={input.state}
              onChange={(event) =>
                updateField("state", event.target.value)
              }
              autoComplete="address-level1"
              maxLength={20}
              required
            />
          </label>

          <label className="field">
            <span>ZIP code *</span>

            <input
              value={input.zipCode}
              onChange={(event) =>
                updateField("zipCode", event.target.value)
              }
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="29486"
              maxLength={10}
              pattern="\d{5}(-\d{4})?"
              required
            />
          </label>
        </div>

        <label className="field">
          <span>Neighborhood / subdivision</span>

          <select
            value={input.neighborhood}
            onChange={(event) =>
              updateField(
                "neighborhood",
                event.target.value,
              )
            }
          >
            {neighborhoods.map((neighborhood) => (
              <option
                key={neighborhood}
                value={neighborhood}
              >
                {neighborhood}
              </option>
            ))}
          </select>
        </label>

        <button
          className="button button-primary"
          type="submit"
          disabled={!canCheck || isChecking}
        >
          <Search size={18} aria-hidden="true" />

          {isChecking
            ? "Checking Distance..."
            : "Check My Address"}
        </button>
      </form>

      {error ? (
        <div
          className="address-result address-result-no"
          role="alert"
        >
          <div className="address-result-heading">
            <XCircle size={22} aria-hidden="true" />
            <h4>We could not verify that address.</h4>
          </div>

          <p>{error}</p>
        </div>
      ) : null}

      {result ? (
        <AddressCheckResult
          result={result}
          bookingHref={buildBookingHref(normalizedInput)}
        />
      ) : null}
    </div>
  );
}

function AddressCheckResult({
  result,
  bookingHref,
}: {
  result: ServiceAreaCheckResult;
  bookingHref: string;
}) {
  const isCovered = result.status === "covered";
  const isUnverified = result.status === "unverified";

  return (
    <div
      className={`address-result ${
        isCovered
          ? "address-result-good"
          : "address-result-no"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="address-result-heading">
        {isCovered ? (
          <CheckCircle2 size={22} aria-hidden="true" />
        ) : (
          <XCircle size={22} aria-hidden="true" />
        )}

        <h4>
          {isCovered
            ? "Yes, you are in range."
            : isUnverified
              ? "We need a better address match."
              : "Outside our standard route area."}
        </h4>
      </div>

      <p>{result.message}</p>

      {result.matchedAddress ? (
        <p className="address-result-detail">
          Verified address:{" "}
          <strong>{result.matchedAddress}</strong>
        </p>
      ) : null}

      {typeof result.distanceMiles === "number" ? (
        <p className="address-result-detail">
          Approximate distance from our current route hub:{" "}
          <strong>
            {result.distanceMiles.toFixed(1)} miles
          </strong>
        </p>
      ) : null}

      {isCovered ? (
        <Link
          className="button button-dark"
          href={bookingHref}
        >
          Book Curbside Cleaning
        </Link>
      ) : null}
    </div>
  );
}

function buildBookingHref(input: ServiceAreaInput) {
  const params = new URLSearchParams();

  params.set("serviceAreaChecked", "yes");
  params.set("streetAddress", input.streetAddress);
  params.set("city", input.city);
  params.set("state", input.state);
  params.set("zipCode", input.zipCode);
  params.set("neighborhood", input.neighborhood);

  return `/book?${params.toString()}`;
}
