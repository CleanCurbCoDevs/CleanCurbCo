"use client";

import { useActionState, useState } from "react";
import {
  changeCustomerEmailAdminAction,
  type AdminEmailChangeState,
} from "@/app/admin/actions";

const initialState: AdminEmailChangeState = {
  status: "idle",
  message: "",
};

type AdminCustomerEmailFormProps = {
  profileId: string;
  currentEmail: string | null;
  stripeCustomerId: string | null;
};

export function AdminCustomerEmailForm({
  profileId,
  currentEmail,
  stripeCustomerId,
}: AdminCustomerEmailFormProps) {
  const [state, formAction, isPending] = useActionState(
    changeCustomerEmailAdminAction,
    initialState,
  );
  const [email, setEmail] = useState(currentEmail ?? "");
  const [confirmEmail, setConfirmEmail] = useState(currentEmail ?? "");
  const [note, setNote] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const canConfirm =
    email.trim().length > 0 &&
    confirmEmail.trim().length > 0 &&
    email.trim().toLowerCase() === confirmEmail.trim().toLowerCase() &&
    email.trim().toLowerCase() !== (currentEmail ?? "").trim().toLowerCase();

  return (
    <section className="form-section admin-email-change-section">
      <div>
        <p className="section-kicker">High-impact account change</p>
        <h2>Change login email</h2>
        <p className="muted">
          This updates Supabase Auth login email, Clean Curb Co. customer
          records, booking contact records, and Stripe customer email when
          linked.
        </p>
      </div>
      <form action={formAction} className="admin-email-change-form">
        <input type="hidden" name="profileId" value={profileId} />
        <div className="form-grid">
          <label className="field">
            <span>Current login email</span>
            <span className="readonly-field-value">
              {currentEmail ?? "No email"}
            </span>
          </label>
          <label className="field">
            <span>New login email</span>
            <input
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Confirm new email</span>
            <input
              name="confirmEmail"
              type="email"
              value={confirmEmail}
              onChange={(event) => setConfirmEmail(event.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Admin note / reason</span>
            <input
              name="note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional internal note"
            />
          </label>
        </div>
        <div className="action-row">
          <button
            className="button button-dark"
            type="button"
            disabled={!canConfirm || isPending}
            onClick={() => setConfirmOpen(true)}
          >
            Update Customer Email
          </button>
          {stripeCustomerId ? (
            <span className="status-badge">Stripe customer linked</span>
          ) : (
            <span className="status-badge">No Stripe customer linked</span>
          )}
        </div>
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
        {confirmOpen ? (
          <div className="modal-backdrop" role="presentation">
            <div
              aria-labelledby="admin-email-change-title"
              aria-modal="true"
              className="policy-modal"
              role="dialog"
            >
              <h2 id="admin-email-change-title">Confirm email change</h2>
              <p>
                Changing this email may affect customer login, future customer
                communications, booking contact matching, and Stripe customer
                matching.
              </p>
              <div className="mini-record">
                <strong>New login email</strong>
                <span>{email}</span>
              </div>
              <div className="action-row">
                <button
                  className="button button-dark"
                  type="submit"
                  disabled={isPending}
                  onClick={() => setConfirmOpen(false)}
                >
                  {isPending ? "Updating..." : "Confirm Change"}
                </button>
                <button
                  className="button button-outline"
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </form>
    </section>
  );
}
