import { CreditCard, FileWarning, NotebookPen, Wrench } from "lucide-react";
import type { ReactNode } from "react";

type FieldStopMoreToolsProps = {
  issuePhotos: ReactNode;
  technicianNotes: ReactNode;
  paymentTools: ReactNode;
  hasIssues?: boolean;
  paymentNeedsAttention?: boolean;
};

export function FieldStopMoreTools({
  issuePhotos,
  technicianNotes,
  paymentTools,
  hasIssues = false,
  paymentNeedsAttention = false,
}: FieldStopMoreToolsProps) {
  const needsAttention = hasIssues || paymentNeedsAttention;

  return (
    <details
      className={[
        "field-more-tools",
        needsAttention ? "needs-attention" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <summary>
        <span className="field-more-tools-summary-icon">
          <Wrench size={21} aria-hidden="true" />
        </span>

        <span className="field-more-tools-summary-copy">
          <strong>More Tools</strong>

          <small>
            Photos for issues, technician notes, and payment collection
          </small>
        </span>

        {needsAttention ? (
          <span className="field-more-tools-alert">
            Needs attention
          </span>
        ) : (
          <span className="field-more-tools-optional">
            Optional
          </span>
        )}
      </summary>

      <div className="field-more-tools-content">
        <details className="field-tool-panel">
          <summary>
            <span>
              <FileWarning size={20} aria-hidden="true" />

              <span>
                <strong>Issue Photos</strong>
                <small>
                  Document damage, blocked access, hazards, or unusual
                  conditions.
                </small>
              </span>
            </span>
          </summary>

          <div className="field-tool-panel-body">
            {issuePhotos}
          </div>
        </details>

        <details className="field-tool-panel">
          <summary>
            <span>
              <NotebookPen size={20} aria-hidden="true" />

              <span>
                <strong>Technician Notes</strong>
                <small>
                  Save internal notes or flag something for admin.
                </small>
              </span>
            </span>
          </summary>

          <div className="field-tool-panel-body">
            {technicianNotes}
          </div>
        </details>

        <details
          className={[
            "field-tool-panel",
            paymentNeedsAttention ? "tool-needs-attention" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          open={paymentNeedsAttention}
        >
          <summary>
            <span>
              <CreditCard size={20} aria-hidden="true" />

              <span>
                <strong>Payment Tools</strong>
                <small>
                  Send a payment link or record cash, Venmo, or Zelle.
                </small>
              </span>
            </span>

            {paymentNeedsAttention ? (
              <span className="field-tool-warning-badge">
                Payment needed
              </span>
            ) : null}
          </summary>

          <div className="field-tool-panel-body">
            {paymentTools}
          </div>
        </details>
      </div>
    </details>
  );
}
