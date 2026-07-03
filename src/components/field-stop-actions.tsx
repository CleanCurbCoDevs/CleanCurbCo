"use client";

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
  const [pendingStatus, setPendingStatus] = useState<FieldStopStatus | null>(null);
  const [isPending, startTransition] = useTransition();
  const completed = terminalStatuses.includes(status);
  const recommendation = useMemo(
    () => getRecommendedStep(status, clearance.cleared, clearance.label),
    [clearance.cleared, clearance.label, status],
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
        feedback.error(result.error ?? "Could not update stop status.");
        return;
      }
      setStatus(nextStatus);
      feedback.success(result.message ?? `Stop marked ${humanizeStatus(nextStatus)}.`);
      router.refresh();
    });
  }

  const canGoOnTheWay = status === "scheduled";
  const canMarkArrived = ["scheduled", "on_the_way"].includes(status);
  const canStartService = ["arrived", "on_the_way"].includes(status) && clearance.cleared;

  return (
    <section className="field-card">
      <div className="field-card-top">
        <div>
          <p className="section-kicker">Operational Flow</p>
          <h2>Current status: {humanizeStatus(status)}</h2>
          <p className="muted">
            <strong>Next recommended action:</strong> {recommendation}
          </p>
        </div>
        <span className={`status-badge status-${status}`}>{humanizeStatus(status)}</span>
      </div>

      <div className="field-step-list" aria-label="Recommended stop flow">
        {["scheduled", "on_the_way", "arrived", "in_progress", "completed"].map(
          (step) => (
            <span
              className={
                step === status ? "field-step is-current" : "field-step"
              }
              key={step}
            >
              {humanizeStatus(step)}
            </span>
          ),
        )}
      </div>

      <div className="field-actions">
        <button
          className={canGoOnTheWay ? "button button-primary" : "button button-outline"}
          disabled={isPending || completed || !canGoOnTheWay}
          onClick={() => runStatus("on_the_way")}
          type="button"
        >
          {pendingStatus === "on_the_way" ? "Marking..." : "Mark On The Way"}
        </button>
        <button
          className={canMarkArrived ? "button button-primary" : "button button-outline"}
          disabled={isPending || completed || !canMarkArrived}
          onClick={() => runStatus("arrived")}
          type="button"
        >
          {pendingStatus === "arrived" ? "Marking..." : "Mark Arrived Internally"}
        </button>
        <button
          className={canStartService ? "button button-primary" : "button button-outline"}
          disabled={isPending || completed || !canStartService}
          onClick={() => runStatus("in_progress")}
          type="button"
        >
          {pendingStatus === "in_progress" ? "Starting..." : "Start Service"}
        </button>
        <button
          className="button button-outline"
          disabled={isPending || completed}
          onClick={() => setModal("follow_up")}
          type="button"
        >
          Skip / Needs Follow-Up
        </button>
        <button
          className="button button-outline"
          disabled={isPending || completed}
          onClick={() => setModal("reschedule")}
          type="button"
        >
          Reschedule Request
        </button>
      </div>

      {!clearance.cleared ? (
        <p className="form-status-message form-status-error" role="status">
          Payment/service clearance is not confirmed. Request payment or mark
          follow-up before starting service.
        </p>
      ) : null}
      <p className="muted">
        Arrival is tracked internally only. Customer communication only happens
        through configured Clean Curb Co email paths.
      </p>

      {modal === "follow_up" ? (
        <div className="modal-panel" role="dialog" aria-modal="true">
          <div className="modal-card">
            <div className="admin-row-heading">
              <div>
                <p className="section-kicker">Follow-Up</p>
                <h2>Why are we skipping this stop?</h2>
                <p className="muted">
                  Notes are required when the reason needs admin context.
                </p>
              </div>
              <button className="button button-outline" type="button" onClick={() => setModal(null)}>
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
              pendingMessage="Saving follow-up..."
              successMessage="Stop marked for follow-up."
            >
              <input type="hidden" name="visitId" value={visitId} />
              <label>
                Reason
                <select name="reason" defaultValue="payment_not_confirmed">
                  <option value="payment_not_confirmed">Payment not confirmed</option>
                  <option value="access_issue">Access issue</option>
                  <option value="customer_issue">Customer issue</option>
                  <option value="equipment_issue">Equipment issue</option>
                  <option value="safety_concern">Safety concern</option>
                  <option value="weather_delay">Weather delay</option>
                  <option value="vehicle_issue">Vehicle issue</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label>
                Notes
                <textarea
                  name="notes"
                  placeholder="Required for access, customer, equipment, safety, weather, vehicle, or other reasons."
                />
              </label>
              <ActionSubmitButton
                className="button button-dark"
                pendingLabel="Saving..."
              >
                Mark Follow-Up Required
              </ActionSubmitButton>
            </FeedbackForm>
          </div>
        </div>
      ) : null}

      {modal === "reschedule" ? (
        <div className="modal-panel" role="dialog" aria-modal="true">
          <div className="modal-card">
            <div className="admin-row-heading">
              <div>
                <p className="section-kicker">Reschedule</p>
                <h2>Send reschedule request to admin.</h2>
                <p className="muted">
                  This creates an admin request. It does not silently move the
                  route stop.
                </p>
              </div>
              <button className="button button-outline" type="button" onClick={() => setModal(null)}>
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
              successMessage="Reschedule request sent to admin."
            >
              <input type="hidden" name="visitId" value={visitId} />
              <label>
                Requested date
                <input name="requestedRouteDay" type="date" />
              </label>
              <label>
                Note for admin
                <textarea
                  name="notes"
                  placeholder="Why this needs to move, customer request, access issue, timing note, etc."
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

function getRecommendedStep(
  status: FieldStopStatus,
  cleared: boolean,
  clearanceLabel: string,
) {
  if (status === "completed") return "This stop is complete.";
  if (status === "needs_follow_up") return "Admin follow-up is required before this stop proceeds.";
  if (status === "rescheduled") return "A reschedule request is waiting for admin review.";
  if (!cleared) return `${clearanceLabel}. Request payment or follow-up before service.`;
  if (status === "scheduled") return "Next step: mark On The Way when you are headed there.";
  if (status === "on_the_way") return "Next step: mark arrived when you reach the property.";
  if (status === "arrived") return "Next step: start service.";
  if (status === "in_progress") return "Finish checklist, photos, notes, then complete the stop.";
  return "Review this stop before continuing.";
}
