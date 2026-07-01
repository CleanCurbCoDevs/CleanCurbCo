"use client";

import Link from "next/link";
import { CheckCircle2, MapPin, Search, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import {
  addressCheckerNeighborhoods,
  checkServiceArea,
  type ServiceAreaCheckInput,
  type ServiceAreaCheckResult,
} from "@/lib/service-area";

const defaultInput: ServiceAreaCheckInput = {
  streetAddress: "",
  city: "Summerville",
  state: "SC",
  zipCode: "",
  neighborhood: "Other / Not sure",
};

export function ServiceAreaChecker() {
  const [input, setInput] = useState<ServiceAreaCheckInput>(defaultInput);
  const [result, setResult] = useState<ServiceAreaCheckResult | null>(null);
  const canCheck = input.streetAddress.trim().length >= 5;

  const normalizedInput = useMemo(
    () => ({
      ...input,
      streetAddress: input.streetAddress.trim(),
      city: input.city.trim(),
      state: input.state.trim(),
      zipCode: input.zipCode.trim(),
      neighborhood: input.neighborhood.trim(),
    }),
    [input],
  );

  function updateField<K extends keyof ServiceAreaCheckInput>(
    key: K,
    value: ServiceAreaCheckInput[K],
  ) {
    setInput((current) => ({ ...current, [key]: value }));
    setResult(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCheck) {
      return;
    }
    setResult(checkServiceArea(normalizedInput));
  }

  return (
    <div className="address-checker" id="check-address">
      <div className="address-checker-heading">
        <MapPin size={22} aria-hidden="true" />
        <div>
          <h3>Check your address</h3>
          <p>
            Quick route check only. No booking, no contact form, no weirdness.
          </p>
        </div>
      </div>

      <form className="address-checker-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Street address *</span>
          <input
            value={input.streetAddress}
            onChange={(event) =>
              updateField("streetAddress", event.target.value)
            }
            placeholder="123 Cane Bay Blvd"
            required
          />
        </label>

        <div className="address-checker-grid">
          <label className="field">
            <span>City</span>
            <input
              value={input.city}
              onChange={(event) => updateField("city", event.target.value)}
            />
          </label>
          <label className="field">
            <span>State</span>
            <input
              value={input.state}
              onChange={(event) => updateField("state", event.target.value)}
              maxLength={20}
            />
          </label>
          <label className="field">
            <span>ZIP</span>
            <input
              value={input.zipCode}
              onChange={(event) => updateField("zipCode", event.target.value)}
              inputMode="numeric"
              placeholder="29486"
            />
          </label>
        </div>

        <label className="field">
          <span>Neighborhood / subdivision</span>
          <select
            value={input.neighborhood}
            onChange={(event) => updateField("neighborhood", event.target.value)}
          >
            {addressCheckerNeighborhoods.map((neighborhood) => (
              <option key={neighborhood}>{neighborhood}</option>
            ))}
          </select>
        </label>

        <button
          className="button button-primary"
          type="submit"
          disabled={!canCheck}
        >
          <Search size={18} aria-hidden="true" />
          Check My Address
        </button>
      </form>

      {result ? <AddressCheckResult result={result} /> : null}
    </div>
  );
}

function AddressCheckResult({ result }: { result: ServiceAreaCheckResult }) {
  const isCovered = result.status === "covered";

  return (
    <div
      className={`address-result ${isCovered ? "address-result-good" : "address-result-no"}`}
      role="status"
      aria-live="polite"
    >
      <div className="address-result-heading">
        {isCovered ? (
          <CheckCircle2 size={22} aria-hidden="true" />
        ) : (
          <XCircle size={22} aria-hidden="true" />
        )}
        <h4>{isCovered ? "Yes, you are in range." : "Not yet, neighbor."}</h4>
      </div>
      <p>{result.message}</p>
      {isCovered ? (
        <>
          <p className="address-result-detail">
            Matched route area: <strong>{result.matchedArea}</strong>
          </p>
          <Link className="button button-dark" href={result.bookingHref}>
            Book My Bin Cleaning
          </Link>
        </>
      ) : null}
    </div>
  );
}
