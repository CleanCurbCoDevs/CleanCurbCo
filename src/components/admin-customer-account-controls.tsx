"use client";

import { useState } from "react";
import { processCustomerAccountAdminAction } from "@/app/admin/actions";

type AccountAction = "disable_portal" | "pending_deletion" | "complete_deletion";

const actionCopy: Record<
  AccountAction,
  { title: string; confirmation: "DISABLE" | "DELETE"; label: string }
> = {
  disable_portal: {
    title: "Disable portal access",
    confirmation: "DISABLE",
    label: "Disable Portal",
  },
  pending_deletion: {
    title: "Mark pending deletion",
    confirmation: "DISABLE",
    label: "Mark Pending Deletion",
  },
  complete_deletion: {
    title: "Complete deletion/deactivation",
    confirmation: "DELETE",
    label: "Complete Deletion",
  },
};

export function AdminCustomerAccountControls({
  profileId,
  accountStatus,
  portalAccessEnabled,
}: {
  profileId: string;
  accountStatus: string;
  portalAccessEnabled: boolean;
}) {
  const [action, setAction] = useState<AccountAction | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const copy = action ? actionCopy[action] : null;
  const canSubmit = Boolean(copy && confirmation === copy.confirmation);

  return (
    <section className="form-section danger-zone">
      <div>
        <p className="section-kicker">Admin account controls</p>
        <h2>Deletion and portal access</h2>
        <p className="muted">
          Current status: {accountStatus.replaceAll("_", " ")}. Portal access:{" "}
          {portalAccessEnabled ? "enabled" : "disabled"}.
        </p>
      </div>
      <div className="action-row">
        <button
          className="button button-outline"
          type="button"
          onClick={() => setAction("disable_portal")}
        >
          Disable Portal
        </button>
        <button
          className="button button-outline"
          type="button"
          onClick={() => setAction("pending_deletion")}
        >
          Mark Pending Deletion
        </button>
        <button
          className="button button-outline button-danger"
          type="button"
          onClick={() => setAction("complete_deletion")}
        >
          Complete Deletion
        </button>
      </div>

      {copy && action ? (
        <div className="modal-backdrop" role="presentation">
          <form
            action={processCustomerAccountAdminAction}
            aria-labelledby="admin-account-action-title"
            aria-modal="true"
            className="policy-modal"
            role="dialog"
          >
            <input type="hidden" name="profileId" value={profileId} />
            <input type="hidden" name="accountAction" value={action} />
            <p className="section-kicker">High-impact account action</p>
            <h2 id="admin-account-action-title">{copy.title}</h2>
            <p>
              This does not delete Stripe records or stored legal/operational
              service records. Payment details remain inside Stripe.
            </p>
            <label className="field">
              <span>Admin note / reason</span>
              <textarea name="adminNote" required />
            </label>
            <label className="field">
              <span>Customer-facing message</span>
              <textarea
                name="customerVisibleAdminMessage"
                placeholder="Optional customer email message."
              />
            </label>
            <label className="field">
              <span>Type {copy.confirmation} to continue</span>
              <input
                name="confirmation"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                required
              />
            </label>
            <div className="action-row">
              <button className="button button-dark" type="submit" disabled={!canSubmit}>
                {copy.label}
              </button>
              <button
                className="button button-outline"
                type="button"
                onClick={() => {
                  setAction(null);
                  setConfirmation("");
                }}
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
