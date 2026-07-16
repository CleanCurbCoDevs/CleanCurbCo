import Link from "next/link";
import {
  addChecklistCorrectionAction,
  saveServiceChecklistDraftAction,
  submitServiceChecklistAction,
} from "@/app/service-checklist-actions";
import {
  checklistProgress,
  checklistStatusLabel,
  checklistStatuses,
  groupChecklistItems,
  type ServiceChecklistBundle,
} from "@/lib/service-checklists";
import { formatBookingAddress, humanizeStatus } from "@/lib/booking-utils";

type SignedDocument = {
  id: string;
  storage_path: string;
  generated_at: string;
  signedUrl: string | null;
};

export function ServiceChecklistPanel({
  bundle,
  returnTo,
  notice,
  documents = [],
  adminMode = false,
}: {
  bundle: ServiceChecklistBundle;
  returnTo: string;
  notice?: string;
  documents?: SignedDocument[];
  adminMode?: boolean;
}) {
  const groupedItems = groupChecklistItems(bundle.items);
  const progress = checklistProgress(bundle.items);
  const isSubmitted = bundle.checklist.status === "submitted";

  function FieldChecklist({
    bundle,
    groupedItems,
    isSubmitted,
    notice,
    progress,
    returnTo,
  }: {
    bundle: ServiceChecklistBundle;
    groupedItems: ReturnType<typeof groupChecklistItems>;
    isSubmitted: boolean;
    notice?: string;
    progress: ReturnType<typeof checklistProgress>;
    returnTo: string;
  }) {
    const percent =
      progress.total > 0
        ? Math.round((progress.resolved / progress.total) * 100)
        : 0;
  
    return (
      <section className="field-fast-checklist">
        <div className="field-checklist-heading">
          <div>
            <p className="section-kicker">Cleaning Checklist</p>
            <h2>
              {isSubmitted ? "Checklist complete" : "Tap it. Clean it. Move on."}
            </h2>
            <p>
              Mark each item done, note an issue, or choose N/A.
            </p>
          </div>
  
          <div className="field-checklist-progress-count">
            <strong>{progress.resolved}</strong>
            <span>of {progress.total}</span>
          </div>
        </div>
  
        <div
          className="field-checklist-progress-bar"
          aria-label={`${percent}% checklist complete`}
        >
          <span style={{ width: `${percent}%` }} />
        </div>
  
        {notice ? <ChecklistNotice notice={notice} /> : null}
  
        {isSubmitted ? (
          <div className="field-checklist-complete-banner">
            <span aria-hidden="true">✓</span>
  
            <div>
              <strong>Checklist submitted</strong>
              <small>
                The service record is locked and the PDF was generated automatically.
              </small>
            </div>
          </div>
        ) : null}
  
        <form
          action={saveServiceChecklistDraftAction}
          className="field-fast-checklist-form"
        >
          <input type="hidden" name="visitId" value={bundle.visit.id} />
          <input type="hidden" name="returnTo" value={returnTo} />
  
          {groupedItems.map((section) => {
            const resolved = section.items.filter(
              (item) => item.status !== "pending",
            ).length;
  
            return (
              <section
                className="field-checklist-group"
                key={section.sectionKey}
              >
                <div className="field-checklist-group-heading">
                  <h3>{section.sectionName}</h3>
                  <span>
                    {resolved}/{section.items.length}
                  </span>
                </div>
  
                <div className="field-checklist-quick-items">
                  {section.items.map((item) => (
                    <article
                      className={`field-checklist-quick-item status-${item.status}`}
                      key={item.id}
                    >
                      <input
                        type="hidden"
                        name="itemId"
                        value={item.id}
                      />
  
                      <strong>{item.label}</strong>
  
                      <fieldset
                        className="field-checklist-tap-options"
                        disabled={isSubmitted}
                      >
                        <legend className="sr-only">
                          Status for {item.label}
                        </legend>
  
                        <label className="check-option check-option-done">
                          <input
                            defaultChecked={item.status === "completed"}
                            name={`status-${item.id}`}
                            type="radio"
                            value="completed"
                          />
                          <span>
                            <b>✓</b>
                            Done
                          </span>
                        </label>
  
                        <label className="check-option check-option-issue">
                          <input
                            defaultChecked={item.status === "issue_found"}
                            name={`status-${item.id}`}
                            type="radio"
                            value="issue_found"
                          />
                          <span>
                            <b>!</b>
                            Issue
                          </span>
                        </label>
  
                        <label className="check-option check-option-na">
                          <input
                            defaultChecked={item.status === "not_applicable"}
                            name={`status-${item.id}`}
                            type="radio"
                            value="not_applicable"
                          />
                          <span>
                            <b>—</b>
                            N/A
                          </span>
                        </label>
  
                        <label className="field-checklist-issue-note">
                          <span>What happened?</span>
                          <textarea
                            defaultValue={item.notes ?? ""}
                            disabled={isSubmitted}
                            name={`notes-${item.id}`}
                            placeholder="Briefly describe the issue or limitation."
                          />
                        </label>
                      </fieldset>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
  
          <details className="field-checklist-overall-notes">
            <summary>Add an overall service note</summary>
  
            <label>
              Notes
              <textarea
                defaultValue={bundle.checklist.overall_notes ?? ""}
                disabled={isSubmitted}
                name="overallNotes"
                placeholder="Optional notes for the customer or admin."
              />
            </label>
          </details>
  
          {!isSubmitted ? (
            <div className="field-checklist-submit-actions">
              <button className="button button-outline" type="submit">
                Save Progress
              </button>
  
              <button
                className="field-checklist-finish-button"
                formAction={submitServiceChecklistAction}
                name="finalizeAck"
                type="submit"
                value="on"
              >
                Finish Checklist
              </button>
            </div>
          ) : null}
        </form>
      </section>
    );
  }
  
  return (
    <section className="service-checklist-shell">
      <div className="service-checklist-hero">
        <div>
          <p className="section-kicker">Service Checklist</p>
          <h1>Proof-of-work report</h1>
          <p className="muted">
            Each appointment gets its own checklist. Drafts can be updated
            during service; submitted checklists lock and generate a branded PDF.
          </p>
        </div>
        <div className="status-stack">
          <span className={`status-badge status-${bundle.checklist.status}`}>
            {humanizeStatus(bundle.checklist.status)}
          </span>
          <span className="status-badge">
            {progress.resolved} of {progress.total} resolved
          </span>
        </div>
      </div>

      {notice ? <ChecklistNotice notice={notice} /> : null}

      <div className="service-checklist-summary">
        <div>
          <span>Customer</span>
          <strong>
            {bundle.booking.first_name} {bundle.booking.last_name}
          </strong>
        </div>
        <div>
          <span>Address</span>
          <strong>{formatBookingAddress(bundle.booking)}</strong>
        </div>
        <div>
          <span>Service date</span>
          <strong>
            {bundle.visit.route_day ??
              bundle.booking.confirmed_route_day ??
              "Not scheduled"}
          </strong>
        </div>
        <div>
          <span>Services</span>
          <strong>{bundle.checklist.services_performed.join(", ")}</strong>
        </div>
      </div>

      {documents.length || bundle.checklist.pdf_storage_path ? (
        <div className="service-checklist-documents">
          <h2>Generated documents</h2>
          {(documents.length
            ? documents
            : [
                {
                  id: "current",
                  storage_path: bundle.checklist.pdf_storage_path ?? "",
                  generated_at: bundle.checklist.pdf_generated_at ?? "",
                  signedUrl: null,
                },
              ]
          ).map((document) => (
            <article className="mini-record" key={document.id}>
              <strong>Service checklist PDF</strong>
              <span>
                {document.generated_at
                  ? new Date(document.generated_at).toLocaleString()
                  : "Generated"}
              </span>
              {document.signedUrl ? (
                <a href={document.signedUrl} target="_blank" rel="noreferrer">
                  Open PDF
                </a>
              ) : (
                <span>Storage path: {document.storage_path}</span>
              )}
            </article>
          ))}
        </div>
      ) : null}

      <form action={saveServiceChecklistDraftAction} className="service-checklist-form">
        <input type="hidden" name="visitId" value={bundle.visit.id} />
        <input type="hidden" name="returnTo" value={returnTo} />

        <ChecklistSections groupedItems={groupedItems} isSubmitted={isSubmitted} />

        <label className="field">
          <span>Overall service notes</span>
          <textarea
            name="overallNotes"
            defaultValue={bundle.checklist.overall_notes ?? ""}
            disabled={isSubmitted}
            placeholder="Final service notes, customer-visible limitations, access issues, or follow-up needs."
          />
        </label>

        {isSubmitted ? (
          <p className="muted">
            This checklist is locked. Use an admin correction note for amendments.
          </p>
        ) : (
          <div className="action-row">
            <button className="button button-outline" type="submit">
              Save Draft
            </button>
            <button
              className="button button-dark"
              formAction={submitServiceChecklistAction}
              type="submit"
            >
              Submit Final Checklist
            </button>
          </div>
        )}

        {!isSubmitted ? (
          <label className="choice-card service-checklist-finalize">
            <input name="finalizeAck" type="checkbox" />
            <span>
              I understand final submission locks this checklist and generates
              the customer/internal PDF service record.
            </span>
          </label>
        ) : null}
      </form>

      {isSubmitted && bundle.checklist.correction_notes ? (
        <section className="service-checklist-documents">
          <h2>Correction notes</h2>
          <pre>{bundle.checklist.correction_notes}</pre>
        </section>
      ) : null}

      {adminMode && isSubmitted ? (
        <form action={addChecklistCorrectionAction} className="form-section">
          <input type="hidden" name="checklistId" value={bundle.checklist.id} />
          <input type="hidden" name="visitId" value={bundle.visit.id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <h2>Admin amendment</h2>
          <p className="muted">
            Add a correction note without silently changing the original submitted
            checklist.
          </p>
          <label className="field">
            <span>Correction note</span>
            <textarea name="correctionNote" />
          </label>
          <button className="button button-outline" type="submit">
            Add Correction Note
          </button>
        </form>
      ) : null}
    </section>
  );
}

function ChecklistSections({
  groupedItems,
  isSubmitted,
}: {
  groupedItems: ReturnType<typeof groupChecklistItems>;
  isSubmitted: boolean;
}) {
  return (
    <div className="service-checklist-sections">
      {groupedItems.map((section, index) => {
        const resolved = section.items.filter((item) => item.status !== "pending").length;
        return (
          <details className="service-checklist-section" key={section.sectionKey} open={index < 2}>
            <summary>
              <span>{section.sectionName}</span>
              <small>
                {resolved} of {section.items.length} resolved
              </small>
            </summary>
            <div className="service-checklist-items">
              {section.items.map((item) => (
                <article className="service-checklist-item" key={item.id}>
                  <input type="hidden" name="itemId" value={item.id} />
                  <div>
                    <strong>{item.label}</strong>
                    <span className={`status-badge status-${item.status}`}>
                      {checklistStatusLabel(item.status)}
                    </span>
                  </div>
                  <fieldset disabled={isSubmitted}>
                    <legend>Status</legend>
                    <div className="checklist-status-options">
                      {checklistStatuses.map((status) => (
                        <label key={status}>
                          <input
                            defaultChecked={item.status === status}
                            name={`status-${item.id}`}
                            type="radio"
                            value={status}
                          />
                          <span>{checklistStatusLabel(status)}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <label className="field compact-field">
                    <span>Item notes</span>
                    <textarea
                      disabled={isSubmitted}
                      name={`notes-${item.id}`}
                      defaultValue={item.notes ?? ""}
                      placeholder="Optional note for this item"
                    />
                  </label>
                </article>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}

function ChecklistNotice({ notice }: { notice: string }) {
  const message =
    {
      saved: "Checklist draft saved.",
      submitted: "Checklist submitted, PDF generated, and report archived.",
      unresolved:
        "Please resolve every required item as Completed, Not Applicable, or Issue Found before final submission.",
      ack_required:
        "Please acknowledge that final submission locks the checklist and generates the PDF.",
      locked: "This checklist has already been submitted and is locked.",
      pdf_failed:
        "Checklist items were saved, but PDF generation/upload failed. Please try final submission again.",
      correction_added: "Correction note added.",
      correction_empty: "Please enter a correction note.",
      missing: "Checklist record could not be loaded for this service visit.",
    }[notice] ?? null;

  if (!message) return null;
  return <div className="notice-card">{message}</div>;
}

export function ChecklistLink({
  visitId,
  label = "Checklist",
}: {
  visitId: string;
  label?: string;
}) {
  return (
    <Link className="button button-outline" href={`/admin/checklists/${visitId}`}>
      {label}
    </Link>
  );
}
