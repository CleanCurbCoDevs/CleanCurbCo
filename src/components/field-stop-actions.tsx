"use client";

import { AlertTriangle, ArrowRight, CalendarClock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  markStopFollowUpAction,
  requestFieldRescheduleAction,
  updateStopStatusAction,
} from "@/app/field/actions";
import {
  ActionSubmitButton,
  FeedbackForm,
  useActionFeedback,
} from "@/components/action-feedback";
import { humanizeStatus } from "@/lib/booking-utils";
import type { FieldStopStatus } from "@/types/database";

type FieldStopActionsProps = {
  clearance: {
    cleared: boolean;
    label: string;
    action: string;
    tone: string;
  };
  initialStatus: FieldStopStatus;
  visitId: string;
};

type ModalMode = "follow_up" | "reschedule" | null;

const terminalStatuses: FieldStopStatus[] = [
  "completed",
  "skipped",
  "needs_follow_up",
  "rescheduled",
  "cancelled",
];

export function FieldStopActions({
  clearance,
  initialStatus,
  visitId,
}: FieldStopActionsProps) {
  const router = useRouter();
  const feedback = useActionFeedback();

  const [status, setStatus] = useState(initialStatus);
  const [modal, setModal] = useState<ModalMode>(null);
  const [pendingStatus, setPendingStatus] =
    useState<FieldStopStatus | null>(null);
  const [isPending, startTransition] = useTransition();

  const completed = terminalStatuses.includes(status);

  const nextAction = useMemo(
    () => getNextAction(status, clearance.cleared),
    [clearance.cleared, status],
  );

  function runStatus(nextStatus: FieldStopStatus) {
    const formData = new FormData();

    formData.set("visitId", visitId);
    formData.set("status", nextStatus);

    setPendingStatus(nextStatus);

    startTransition(async () => {
      const result = await updateStopStatusAction(formData);

      setPendingStatus(null);

      if (!result.ok) {
        feedback.error(
          result.error ?? "Could not update stop status.",
        );
        return;
      }

      setStatus(nextStatus);

      feedback.success(
        result.message ??
          `Stop marked ${humanizeStatus(nextStatus)}.`,
      );

      router.refresh();
    });
  }

  return (
    <section className="field-next-action-card">
      <div className="field-next-action-heading">
        <div>
          <p className="section-kicker">Next Action</p>

          <h2>{nextAction.heading}</h2>

          <p>{nextAction.description}</p>
        </div>

        <span className={`status-badge status-${status}`}>
          {humanizeStatus(status)}
        </span>
      </div>

      {!clearance.cleared && !completed ? (
        <div className="field-action-clearance-warning">
          <AlertTriangle size={22} aria-hidden="true" />

          <div>
            <strong>{clearance.label}</strong>
            <p>{clearance.action}</p>
          </div>
        </div>
      ) : null}

      {nextAction.status ? (
        <button
          className="field-next-action-button"
          disabled={
            isPending ||
            completed ||
            !nextAction.enabled
          }
          onClick={() => runStatus(nextAction.status!)}
          type="button"
        >
          <span>
            {pendingStatus === nextAction.status
              ? nextAction.pendingLabel
              : nextAction.buttonLabel}
          </span>

          <ArrowRight size={24} aria-hidden="true" />
        </button>
      ) : (
        <div className="field-next-action-complete">
          <span aria-hidden="true">✓</span>

          <div>
            <strong>{nextAction.buttonLabel}</strong>
            <small>{nextAction.description}</small>
          </div>
        </div>
      )}

      {!completed ? (
        <div className="field-exception-actions">
          <button
            type="button"
            onClick={() => setModal("follow_up")}
          >
            <AlertTriangle size={19} aria-hidden="true" />
            Report a Problem
          </button>

          <button
            type="button"
            onClick={() => setModal("reschedule")}
          >
            <CalendarClock size={19} aria-hidden="true" />
            Request Reschedule
          </button>
        </div>
      ) : null}

      {modal === "follow_up" ? (
        <div
          className="modal-panel"
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-card">
            <div className="admin-row-heading">
              <div>
                <p className="section-kicker">
                  Report a Problem
                </p>

                <h2>What happened at this stop?</h2>

                <p className="muted">
                  This closes the stop from the active route and
                  sends it to admin for review.
                </p>
              </div>

              <button
                className="button button-outline"
                type="button"
                onClick={() => setModal(null)}
              >
                Close
              </button>
            </div>

            <FeedbackForm
              action={markStopFollowUpAction}
              className="field-form"
              onSuccess={() => {
                setStatus("needs_follow_up");
                setModal(null);
              }}
              pendingMessage="Saving issue..."
              successMessage="Stop sent for follow-up."
            >
              <input
                type="hidden"
                name="visitId"
                value={visitId}
              />

              <label>
                What is the problem?

                <select
                  name="reason"
                  defaultValue="access_issue"
                >
                  <option value="access_issue">
                    Cannot access bins or property
                  </option>

                  <option value="payment_not_confirmed">
                    Payment not confirmed
                  </option>

                  <option value="customer_issue">
                    Customer issue
                  </option>

                  <option value="equipment_issue">
                    Equipment issue
                  </option>

                  <option value="safety_concern">
                    Safety concern
                  </option>

                  <option value="weather_delay">
                    Weather delay
                  </option>

                  <option value="vehicle_issue">
                    Vehicle issue
                  </option>

                  <option value="other">Other</option>
                </select>
              </label>

              <label>
                What should admin know?

                <textarea
                  name="notes"
                  placeholder="Gate locked, bins missing, dog loose, customer asked to reschedule, equipment failure, etc."
                />
              </label>

              <ActionSubmitButton
                className="button button-dark"
                pendingLabel="Saving..."
              >
                Send to Admin
              </ActionSubmitButton>
            </FeedbackForm>
          </div>
        </div>
      ) : null}

      {modal === "reschedule" ? (
        <div
          className="modal-panel"
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-card">
            <div className="admin-row-heading">
              <div>
                <p className="section-kicker">
                  Reschedule Request
                </p>

                <h2>Move this stop to another day.</h2>

                <p className="muted">
                  This sends a request to admin. The route is not
                  silently changed.
                </p>
              </div>

              <button
                className="button button-outline"
                type="button"
                onClick={() => setModal(null)}
              >
                Close
              </button>
            </div>

            <FeedbackForm
              action={requestFieldRescheduleAction}
              className="field-form"
              onSuccess={() => {
                setStatus("rescheduled");
                setModal(null);
              }}
              pendingMessage="Sending request..."
              successMessage="Reschedule request sent."
            >
              <input
                type="hidden"
                name="visitId"
                value={visitId}
              />

              <label>
                Requested date

                <input
                  name="requestedRouteDay"
                  type="date"
                />
              </label>

              <label>
                Reason or instructions

                <textarea
                  name="notes"
                  placeholder="Customer requested another date, bins were not out, access problem, weather delay, etc."
                />
              </label>

              <ActionSubmitButton
                className="button button-dark"
                pendingLabel="Sending..."
              >
                Send Reschedule Request
              </ActionSubmitButton>
            </FeedbackForm>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function getNextAction(
  status: FieldStopStatus,
  cleared: boolean,
): {
  heading: string;
  description: string;
  buttonLabel: string;
  pendingLabel: string;
  status: FieldStopStatus | null;
  enabled: boolean;
} {
  if (status === "completed") {
    return {
      heading: "Service complete",
      description:
        "This stop has been completed and recorded.",
      buttonLabel: "Stop Complete",
      pendingLabel: "",
      status: null,
      enabled: false,
    };
  }

  if (status === "needs_follow_up") {
    return {
      heading: "Waiting for admin",
      description:
        "This stop was marked for follow-up.",
      buttonLabel: "Follow-Up Required",
      pendingLabel: "",
      status: null,
      enabled: false,
    };
  }

  if (status === "rescheduled") {
    return {
      heading: "Reschedule requested",
      description:
        "Admin will review and move this stop.",
      buttonLabel: "Request Sent",
      pendingLabel: "",
      status: null,
      enabled: false,
    };
  }

  if (status === "scheduled") {
    return {
      heading: "Head to the customer",
      description:
        "This sends the customer an on-the-way notification.",
      buttonLabel: "Mark On The Way",
      pendingLabel: "Marking On The Way...",
      status: "on_the_way",
      enabled: true,
    };
  }

  if (status === "on_the_way") {
    return {
      heading: "Arrived at the property?",
      description:
        "Arrival is recorded internally. The customer is not notified again.",
      buttonLabel: "I’ve Arrived",
      pendingLabel: "Marking Arrived...",
      status: "arrived",
      enabled: true,
    };
  }

  if (status === "arrived") {
    return {
      heading: cleared
        ? "Ready to begin"
        : "Service clearance required",
      description: cleared
        ? "Start the service timer and begin before photos."
        : "Resolve payment or service clearance before starting.",
      buttonLabel: cleared
        ? "Start Service"
        : "Service Not Cleared",
      pendingLabel: "Starting Service...",
      status: "in_progress",
      enabled: cleared,
    };
  }

  if (status === "in_progress") {
    return {
      heading: "Service in progress",
      description:
        "Complete before photos, the checklist, and after photos below.",
      buttonLabel: "Continue Service Below",
      pendingLabel: "",
      status: null,
      enabled: false,
    };
  }

  return {
    heading: "Review this stop",
    description:
      "Check the stop information before continuing.",
    buttonLabel: humanizeStatus(status),
    pendingLabel: "",
    status: null,
    enabled: false,
  };
}
