import {
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  MailCheck,
  Send,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import {
  ActionSubmitButton,
  FeedbackForm,
} from "@/components/action-feedback";

import {
  sendCommercialQuoteCustomerCopyAction,
} from "@/app/admin/customer-file-actions";

import type {
  CustomerDeliveryRow,
  CustomerFileRow,
} from "@/types/database";

type CustomerFileArchivePanelProps = {
  files:
    CustomerFileRow[];

  latestQuoteFileId:
    string | null;

  latestQuoteMatchesSavedQuote:
    boolean;

  deliveries?:
    CustomerDeliveryRow[];

  requestId?:
    string | null;

  recipientName?:
    string | null;

  recipientEmail?:
    string | null;
};

export function CustomerFileArchivePanel({
  files,
  latestQuoteFileId,
  latestQuoteMatchesSavedQuote,
  deliveries = [],
  requestId = null,
  recipientName = null,
  recipientEmail = null,
}: CustomerFileArchivePanelProps) {
  return (
    <section className="placeholder-panel customer-file-archive">
      <div className="admin-page-heading">
        <div>
          <p className="section-kicker">
            Documents & Photos
          </p>

          <h2>
            The permanent customer file.
          </h2>

          <p className="muted">
            Preview, download, and email
            delivery all use the same
            archived bytes. No live
            regeneration. No second
            mystery PDF wandering around
            the internet.
          </p>
        </div>

        <span className="status-badge">
          {files.length} archived
        </span>
      </div>

      {files.length ? (
        <div className="customer-file-list">
          {files.map(
            (file) => {
              const isLatestQuote =
                file.id ===
                latestQuoteFileId;

              const integrityLabel =
                isLatestQuote
                  ? latestQuoteMatchesSavedQuote
                    ? "Matches last saved quote"
                    : "Previous customer copy"
                  : null;

              const FileIcon =
                file.file_kind ===
                "photo"
                  ? ImageIcon
                  : FileText;

              const fileDeliveries =
                deliveries.filter(
                  (delivery) =>
                    getDeliveryCustomerFileId(
                      delivery,
                    ) === file.id,
                );

              const latestDelivery =
                fileDeliveries[0] ??
                null;

              const deliveryFailed =
                latestDelivery
                  ? [
                      "failed",
                      "bounced",
                    ].includes(
                      latestDelivery.status,
                    )
                  : false;

              const DeliveryIcon =
                deliveryFailed
                  ? TriangleAlert
                  : MailCheck;

              const canSend =
                isLatestQuote &&
                latestQuoteMatchesSavedQuote &&
                [
                  "ready",
                  "sent",
                  "received",
                ].includes(
                  file.status,
                );

              return (
                <article
                  className="customer-file-row"
                  key={file.id}
                >
                  <div className="customer-file-icon">
                    <FileIcon
                      size={22}
                      aria-hidden="true"
                    />
                  </div>

                  <div className="customer-file-main">
                    <div className="customer-file-title-line">
                      <strong>
                        {file.display_name}
                      </strong>

                      <span
                        className={`status-badge status-${file.status}`}
                      >
                        {humanize(
                          file.status,
                        )}
                      </span>

                      {integrityLabel ? (
                        <span
                          className={`customer-file-freshness ${
                            latestQuoteMatchesSavedQuote
                              ? "customer-file-current"
                              : "customer-file-stale"
                          }`}
                        >
                          {latestQuoteMatchesSavedQuote ? (
                            <ShieldCheck
                              size={14}
                              aria-hidden="true"
                            />
                          ) : (
                            <TriangleAlert
                              size={14}
                              aria-hidden="true"
                            />
                          )}

                          {integrityLabel}
                        </span>
                      ) : null}
                    </div>

                    <div className="customer-file-meta">
                      <span>
                        File v
                        {file.version_number}
                      </span>

                      <span>
                        {formatDateTime(
                          file.created_at,
                        )}
                      </span>

                      <span>
                        {formatFileSize(
                          file.size_bytes,
                        )}
                      </span>

                      <span>
                        {file.mime_type}
                      </span>
                    </div>

                    <div className="customer-file-hash">
                      <span>
                        SHA-256
                      </span>

                      <code
                        title={
                          file.sha256
                        }
                      >
                        {file.sha256.slice(
                          0,
                          20,
                        )}
                        …
                      </code>
                    </div>

                    {file.sent_at ? (
                      <small>
                        First sent{" "}
                        {formatDateTime(
                          file.sent_at,
                        )}
                      </small>
                    ) : null}

                    {latestDelivery ? (
                      <div
                        className={`customer-file-delivery customer-file-delivery-${latestDelivery.status}`}
                      >
                        <DeliveryIcon
                          size={18}
                          aria-hidden="true"
                        />

                        <span>
                          <strong>
                            {deliveryStatusLabel(
                              latestDelivery.status,
                            )}
                          </strong>

                          <small>
                            {latestDelivery
                              .recipient_email}
                            {" • "}
                            {formatDateTime(
                              latestDelivery
                                .sent_at ??
                                latestDelivery
                                  .failed_at ??
                                latestDelivery
                                  .created_at,
                            )}

                            {fileDeliveries.length >
                            1
                              ? ` • ${fileDeliveries.length} delivery attempts`
                              : ""}
                          </small>
                        </span>
                      </div>
                    ) : null}
                  </div>

                  <div className="customer-file-actions">
                    <a
                      className="button button-outline"
                      href={`/admin/customer-files/${file.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Eye
                        size={17}
                        aria-hidden="true"
                      />

                      Preview
                    </a>

                    <a
                      className="button button-outline"
                      href={`/admin/customer-files/${file.id}?download=1`}
                    >
                      <Download
                        size={17}
                        aria-hidden="true"
                      />

                      Download
                    </a>

                    {canSend &&
                    requestId &&
                    recipientEmail ? (
                      <FeedbackForm
                        action={
                          sendCommercialQuoteCustomerCopyAction
                        }
                        className="customer-file-send-form"
                        confirmMessage={`Email this exact archived quote to ${
                          recipientName ??
                          recipientEmail
                        } at ${recipientEmail}?`}
                        errorMessage="The quote email could not be sent."
                        pendingMessage="Verifying and sending the archived PDF..."
                        successMessage="The quote email was sent."
                      >
                        <input
                          type="hidden"
                          name="commercialRequestId"
                          value={requestId}
                        />

                        <input
                          type="hidden"
                          name="customerFileId"
                          value={file.id}
                        />

                        <ActionSubmitButton
                          className="button button-dark"
                          pendingLabel="Sending quote..."
                        >
                          <Send
                            size={17}
                            aria-hidden="true"
                          />

                          {file.sent_at
                            ? "Resend Quote"
                            : "Send Quote"}
                        </ActionSubmitButton>
                      </FeedbackForm>
                    ) : isLatestQuote &&
                      !latestQuoteMatchesSavedQuote ? (
                      <span className="customer-file-send-disabled">
                        Regenerate before
                        sending
                      </span>
                    ) : null}
                  </div>
                </article>
              );
            },
          )}
        </div>
      ) : (
        <div className="customer-file-empty">
          <FileText
            size={28}
            aria-hidden="true"
          />

          <div>
            <strong>
              No archived customer files
              yet.
            </strong>

            <p className="muted">
              Generate the exact customer
              copy from the quote builder.
              Future agreements, invoices,
              reports, and delivered photos
              will appear here too.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function getDeliveryCustomerFileId(
  delivery:
    CustomerDeliveryRow,
) {
  const value =
    delivery.metadata
      .customerFileId;

  return typeof value ===
    "string"
    ? value
    : null;
}

function deliveryStatusLabel(
  status:
    CustomerDeliveryRow["status"],
) {
  switch (status) {
    case "queued":
      return "Email queued";

    case "sent":
      return "Email sent";

    case "delivered":
      return "Email delivered";

    case "failed":
      return "Email failed";

    case "bounced":
      return "Email bounced";
  }
}

function humanize(
  value: string,
) {
  return value
    .replaceAll(
      "_",
      " ",
    )
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    );
}

function formatDateTime(
  value: string,
) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone:
        "America/New_York",

      month:
        "short",

      day:
        "numeric",

      year:
        "numeric",

      hour:
        "numeric",

      minute:
        "2-digit",

      timeZoneName:
        "short",
    },
  ).format(
    new Date(value),
  );
}

function formatFileSize(
  bytes: number,
) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}
