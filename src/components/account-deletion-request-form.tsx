"use client";

import { useActionState, useState } from "react";
import {
  requestAccountDeletionAction,
  type AccountDeletionRequestState,
} from "@/app/portal/actions";

const initialState: AccountDeletionRequestState = {
  status: "idle",
  message: "",
};

export function AccountDeletionRequestForm({
  hasPendingRequest,
}: {
  hasPendingRequest: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    requestAccountDeletionAction,
    initialState,
  );
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const canSubmit = confirmation === "DELETE" && !isPending && !hasPendingRequest;

  return (
    <section className="form-section danger-zone">
      <div>
        <p className="section-kicker">Account deletion</p>
        <h2>Request account deletion</h2>
        <p className="muted">
          Account deletion is reviewed by Clean Curb Co. first because booking,
          service history, payment references, checklist PDFs, and legal records
          may need to be retained.
        </p>
      </div>

      {hasPendingRequest ? (
        <p className="confirmation-panel">
          Your account deletion request is pending admin review.
        </p>
      ) : (
        <button
          className="button button-outline button-danger"
          type="button"
          onClick={() => setOpen(true)}
        >
          Request Account Deletion
        </button>
      )}

      {state.message ? (
        <p
          className={`form-status-message form-status-${state.status}`}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
          {state.requestId ? (
            <>
              <br />
              Request ID: {state.requestId}
            </>
          ) : null}
        </p>
      ) : null}

      {open ? (
        <div className="modal-backdrop" role="presentation">
          <form
            action={formAction}
            aria-labelledby="account-delete-title"
            aria-modal="true"
            className="policy-modal"
            role="dialog"
          >
            <p className="section-kicker">Confirm request</p>
            <h2 id="account-delete-title">Request account deletion</h2>
            <p>
              This does not immediately erase operational records or Stripe
              records. Clean Curb Co. will review the request, disable portal
              access when appropriate, and preserve records needed for service,
              accounting, disputes, or legal retention.
            </p>
            <label className="field">
              <span>Reason, optional</span>
              <textarea
                name="reason"
                placeholder="Anything you want us to know."
              />
            </label>
            <label className="field">
              <span>Confirm your password</span>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <label className="field">
              <span>Type DELETE to continue</span>
              <input
                name="confirmation"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                required
              />
            </label>
            <div className="action-row">
              <button
                className="button button-dark"
                type="submit"
                disabled={!canSubmit}
                onClick={() => setOpen(false)}
              >
                {isPending ? "Submitting..." : "Submit Deletion Request"}
              </button>
              <button
                className="button button-outline"
                type="button"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
