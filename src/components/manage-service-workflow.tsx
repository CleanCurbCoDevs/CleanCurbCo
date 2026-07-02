"use client";

import { startTransition, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createCustomerRequestAction } from "@/app/portal/actions";
import { humanizeStatus, validFrequencies } from "@/lib/booking-utils";
import { formatFrequency } from "@/lib/pricing";
import {
  evaluatePolicyWindow,
  getBookingServiceDate,
  namesMatch,
  policyReasoningText,
  policyWindowLabels,
  requestTypeLabels,
  requiresTypedAcknowledgment,
} from "@/lib/service-policy";
import { addOns } from "@/lib/site";
import type {
  BookingRow,
  CustomerRequestRow,
  RequestType,
  ServiceAddressRow,
  ServiceVisitRow,
} from "@/types/database";

type ManageServiceWorkflowProps = {
  profileName: string;
  bookings: BookingRow[];
  visits: ServiceVisitRow[];
  requests: CustomerRequestRow[];
  primaryAddress?: ServiceAddressRow | null;
};

type ModalState = {
  title: string;
  body: string;
  acknowledgment: string | null;
  buttonLabel: string;
  requiresName: boolean;
  formData: FormData;
  validNames: string[];
};

const requestCards: Array<{
  title: string;
  type: RequestType;
  helper: string;
}> = [
  {
    title: "Pause Service",
    type: "pause_service",
    helper: "Need a temporary break? Send the dates and we will keep the route tidy.",
  },
  {
    title: "Cancel Service",
    type: "cancel_service",
    helper: "Cancel without the awkward phone call. Last-minute policies still apply.",
  },
  {
    title: "Reschedule",
    type: "reschedule_service",
    helper: "Pick a requested date. We will confirm the route fit.",
  },
  {
    title: "Change Frequency",
    type: "change_frequency",
    helper: "Move between monthly, every other month, or quarterly.",
  },
  {
    title: "Add Services",
    type: "add_service",
    helper: "Add deodorizer, pad refresh, grime cleanup, spot clean, or pet waste help.",
  },
  {
    title: "Drop Services",
    type: "drop_service",
    helper: "Remove add-ons from a future visit. Last-minute drops may still be charged.",
  },
  {
    title: "Update Address",
    type: "update_address",
    helper: "New house, gate code, HOA note, or bin location details.",
  },
  {
    title: "Ask a Billing / Service Question",
    type: "billing_question",
    helper: "Payment links, credits, service details, or anything account-ish.",
  },
];

export function ManageServiceWorkflow({
  profileName,
  bookings,
  visits,
  requests,
  primaryAddress,
}: ManageServiceWorkflowProps) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState | null>(null);
  const [typedName, setTypedName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);
  const defaultBooking = bookings.find((booking) => booking.frequency !== "one_time") ?? bookings[0];

  const currentServiceText = useMemo(() => {
    if (!defaultBooking) return null;
    const serviceDate = getServiceDate(defaultBooking, visits);
    return `${formatFrequency(defaultBooking.frequency)} | ${defaultBooking.bin_count} ${
      defaultBooking.bin_count === 1 ? "bin" : "bins"
    } | ${defaultBooking.street_address}${
      serviceDate ? ` | Scheduled ${serviceDate}` : ""
    }`;
  }, [defaultBooking, visits]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const formData = new FormData(event.currentTarget);
    const requestType = String(formData.get("requestType") ?? "") as RequestType;
    const booking = bookings.find(
      (item) => item.id === String(formData.get("bookingId") ?? ""),
    );
    const serviceDate = getServiceDate(booking, visits);
    const policyWindow = evaluatePolicyWindow(serviceDate);
    const requiresName = requiresTypedAcknowledgment(requestType, policyWindow);
    const validNames = [
      profileName,
      booking ? `${booking.first_name} ${booking.last_name}` : "",
    ].filter(Boolean);

    formData.set("clientPolicyWindow", policyWindow);

    setTypedName("");
    setModal({
      ...getModalCopy(requestType, policyWindow, requiresName),
      requiresName,
      formData,
      validNames,
    });
  }

  function confirmRequest() {
    if (!modal) return;
    const formData = modal.formData;
    formData.set("policyAcknowledgedName", typedName);
    formData.set("policyAcknowledged", modal.requiresName ? "true" : "false");
    setIsPending(true);

    startTransition(async () => {
      const result = await createCustomerRequestAction(formData);

      if (result?.ok) {
        setModal(null);
        setTypedName("");
        setMessage("Request submitted. We saved the policy details with it.");
        router.refresh();
      } else {
        setError(result?.error ?? "We could not submit that request.");
      }

      setIsPending(false);
    });
  }

  const canConfirm =
    !modal?.requiresName || namesMatch(typedName, modal.validNames);

  return (
    <>
      {currentServiceText ? (
        <div className="card">
          <h3>Current linked service</h3>
          <p>{currentServiceText}</p>
        </div>
      ) : (
        <div className="card">
          <h3>No linked booking yet</h3>
          <p>
            Once your booking is linked, service-change requests can attach
            directly to it.
          </p>
          <a className="button button-dark" href="/book">
            Book a Cleaning
          </a>
        </div>
      )}

      {message ? <p className="confirmation-panel">{message}</p> : null}
      {error ? <p className="confirmation-panel">{error}</p> : null}

      <div className="grid grid-2">
        {requestCards.map((card) => (
          <form className="form-section" key={card.type} onSubmit={handleSubmit}>
            <input type="hidden" name="requestType" value={card.type} />
            <h2>{card.title}</h2>
            <p className="muted">{card.helper}</p>
            <BookingSelect bookings={bookings} defaultBookingId={defaultBooking?.id} />
            <RequestFields type={card.type} primaryAddress={primaryAddress} />
            <label className="field">
              <span>Message</span>
              <textarea
                name="message"
                placeholder="Tell us what you need and any timing details."
                required={["billing_question", "drop_service"].includes(card.type)}
              />
            </label>
            <button className="button button-dark" type="submit">
              Continue
            </button>
          </form>
        ))}
      </div>

      <section className="detail-panel">
        <h2>Your request status</h2>
        {requests.length ? (
          <div className="data-table">
            {requests.map((request) => (
              <article className="data-row" key={request.id}>
                <div>
                  <strong>{requestTypeLabels[request.request_type]}</strong>
                  <span>{request.message ?? "No message"}</span>
                </div>
                <span className={`status-badge status-${request.status}`}>
                  {humanizeStatus(request.status)}
                </span>
                <span className={`status-badge status-${request.policy_window}`}>
                  {policyWindowLabels[request.policy_window]}
                </span>
                <span>{formatDate(request.created_at)}</span>
                <span>{request.admin_notes ?? "Review pending"}</span>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">No service-change requests yet.</p>
        )}
      </section>

      {modal ? (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-labelledby="service-policy-title"
            aria-modal="true"
            className="policy-modal"
            role="dialog"
          >
            <p className="section-kicker">Service policy</p>
            <h2 id="service-policy-title">{modal.title}</h2>
            <p>{modal.body}</p>
            {modal.acknowledgment ? (
              <label className="field">
                <span>{modal.acknowledgment}</span>
                <input
                  value={typedName}
                  onChange={(event) => setTypedName(event.target.value)}
                  placeholder={profileName || "Full name"}
                />
              </label>
            ) : null}
            <div className="action-row">
              <button
                className="button button-dark"
                type="button"
                onClick={confirmRequest}
                disabled={!canConfirm || isPending}
              >
                {isPending ? "Submitting..." : modal.buttonLabel}
              </button>
              <button
                className="button button-outline"
                type="button"
                onClick={() => setModal(null)}
              >
                Go Back
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function BookingSelect({
  bookings,
  defaultBookingId,
}: {
  bookings: BookingRow[];
  defaultBookingId?: string;
}) {
  if (!bookings.length) {
    return <input type="hidden" name="bookingId" value="" />;
  }

  const selectedBookingId = defaultBookingId ?? bookings[0]?.id;

  return (
    <fieldset className="field choice-fieldset booking-choice-group">
      <legend>Linked booking</legend>
      <div className="choice-grid booking-choice-grid">
        {bookings.map((booking) => (
          <label className="choice-card booking-choice-card" key={booking.id}>
            <input
              defaultChecked={booking.id === selectedBookingId}
              name="bookingId"
              required
              type="radio"
              value={booking.id}
            />
            <span>
              {formatFrequency(booking.frequency)} - {booking.street_address}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function RequestFields({
  type,
  primaryAddress,
}: {
  type: RequestType;
  primaryAddress?: ServiceAddressRow | null;
}) {
  if (type === "pause_service") {
    return (
      <div className="form-grid">
        <label className="field">
          <span>Pause start</span>
          <input type="date" name="pauseStart" />
        </label>
        <label className="field">
          <span>Pause end</span>
          <input type="date" name="pauseEnd" />
        </label>
      </div>
    );
  }

  if (type === "reschedule_service") {
    return (
      <label className="field">
        <span>Requested route day</span>
        <input type="date" name="requestedRouteDay" required />
      </label>
    );
  }

  if (type === "change_frequency") {
    return (
      <fieldset className="field choice-fieldset">
        <legend>Requested frequency</legend>
        <div className="choice-grid booking-choice-grid">
          {validFrequencies
            .filter((frequency) => frequency !== "one_time")
            .map((frequency) => (
              <label className="choice-card" key={frequency}>
                <input
                  defaultChecked={frequency === "every_other_month"}
                  name="requestedFrequency"
                  required
                  type="radio"
                  value={frequency}
                />
                <span>{formatFrequency(frequency)}</span>
              </label>
            ))}
        </div>
      </fieldset>
    );
  }

  if (type === "add_service" || type === "drop_service") {
    const fieldName = type === "add_service" ? "requestedAddOns" : "requestedRemovedAddOns";
    return (
      <div>
        <p className="option-label">
          {type === "add_service" ? "Add services" : "Drop services"}
        </p>
        <div className="choice-grid">
          {addOns.map((addOn) => (
            <label className="choice-card" key={addOn.id}>
              <input type="checkbox" name={fieldName} value={addOn.id} />
              <span>
                {addOn.name}
                <small>{addOn.price}</small>
              </span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (type === "update_address") {
    return (
      <div className="form-grid">
        <label className="field">
          <span>Street address</span>
          <input
            name="streetAddress"
            defaultValue={primaryAddress?.street_address ?? ""}
            required
          />
        </label>
        <label className="field">
          <span>City</span>
          <input name="city" defaultValue={primaryAddress?.city ?? "Summerville"} />
        </label>
        <label className="field">
          <span>State</span>
          <input name="state" defaultValue={primaryAddress?.state ?? "SC"} />
        </label>
        <label className="field">
          <span>ZIP</span>
          <input name="zipCode" defaultValue={primaryAddress?.zip_code ?? ""} />
        </label>
        <label className="field">
          <span>Neighborhood</span>
          <input
            name="neighborhood"
            defaultValue={primaryAddress?.neighborhood ?? ""}
          />
        </label>
        <label className="field">
          <span>Address notes</span>
          <textarea
            name="addressNotes"
            defaultValue={primaryAddress?.notes ?? ""}
          />
        </label>
      </div>
    );
  }

  return null;
}

function getModalCopy(
  requestType: RequestType,
  policyWindow: string,
  requiresName: boolean,
) {
  if (policyWindow === "within_24_hours") {
    return {
      title: "Last-minute service change",
      body:
        "Your service is scheduled within the next 24 hours. At this point, routes, prep work, supplies, and scheduling have already been planned.\n\nYou may still request cancellation, rescheduling, or service changes, but you may still be charged the original scheduled service price. If you add services, your invoice may increase. Dropping services may not reduce the original scheduled charge.",
      acknowledgment:
        "Type your full name to confirm that you understand the last-minute service policy.",
      buttonLabel: "I Understand — Submit Request",
    };
  }

  if (policyWindow === "within_48_hours") {
    if (requestType === "cancel_service") {
      return {
        title: "Before you cancel",
        body:
          "Your service is scheduled within the next 48 hours. Because our routes are planned in advance, cancelling now may result in a cancellation fee.\n\nYou can still submit this cancellation request, but it may require review by Clean Curb Co.",
        acknowledgment:
          "Type your full name to acknowledge this cancellation policy.",
        buttonLabel: "Submit Cancellation Request",
      };
    }

    return {
      title: "Before you change service",
      body: `Your service is scheduled within the next 48 hours. ${policyReasoningText}`,
      acknowledgment: requiresName
        ? "Type your full name to acknowledge this service change policy."
        : null,
      buttonLabel: "Submit Service Request",
    };
  }

  return {
    title: "Confirm service change",
    body: "Please confirm you want to submit this service change.",
    acknowledgment: null,
    buttonLabel: "Confirm",
  };
}

function getServiceDate(booking: BookingRow | undefined, visits: ServiceVisitRow[]) {
  if (!booking) return null;
  return getBookingServiceDate(
    booking,
    visits.filter((visit) => visit.booking_id === booking.id),
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
