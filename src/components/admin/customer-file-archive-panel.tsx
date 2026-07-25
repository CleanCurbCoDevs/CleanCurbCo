import {
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import type {
  CustomerFileRow,
} from "@/types/database";

type CustomerFileArchivePanelProps = {
  files: CustomerFileRow[];

  latestQuoteFileId:
    string | null;

  latestQuoteMatchesSavedQuote:
    boolean;
};

export function CustomerFileArchivePanel({
  files,
  latestQuoteFileId,
  latestQuoteMatchesSavedQuote,
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
            These are archived file
            objects—not live
            re-renderings. Preview,
            download, and future customer
            delivery all use the same
            stored bytes.
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
                        Sent{" "}
                        {formatDateTime(
                          file.sent_at,
                        )}
                      </small>
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
