import type { Metadata } from "next";
import Link from "next/link";
import {
  ActionSubmitButton,
  FeedbackForm,
} from "@/components/action-feedback";
import { AdminFilterBar } from "@/components/admin-filter-bar";
import { AdminShell } from "@/components/shells/admin-shell";
import {
  updateCommercialQuoteAdminAction,
} from "@/app/admin/actions";
import { humanizeStatus } from "@/lib/booking-utils";
import {
  COMMERCIAL_QUOTE_PHOTO_BUCKET,
} from "@/lib/commercial-photo-config";
import { getAdminContext } from "@/lib/admin-data";
import { includesSearch } from "@/lib/admin-operations";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  commercialDesiredFrequencyLabels,
  commercialPreferredContactMethodLabels,
  commercialPropertyTypeLabels,
  commercialServiceInterestLabels,
  commercialServicePlanLabels,
  commercialSiteConditionLabels,
  commercialStartTimeframeLabels,
  commercialWaterAvailabilityLabels,
} from "@/types/commercial";
import type {
  CommercialQuoteRequestRow,
  CommercialQuoteRequestStatus,
} from "@/types/database";

export const metadata: Metadata = {
  title: "Admin Commercial Quotes",
};

type CommercialQuotesPageProps = {
  searchParams: Promise<
    Record<string, string | undefined>
  >;
};

const commercialQuoteStatuses:
  readonly CommercialQuoteRequestStatus[] = [
    "new",
    "reviewing",
    "site_visit_needed",
    "quoted",
    "won",
    "lost",
    "closed",
  ];

const archivedStatuses:
  readonly CommercialQuoteRequestStatus[] = [
    "won",
    "lost",
    "closed",
  ];

const viewOptions = [
  {
    label: "Active quote pipeline",
    value: "",
  },
  {
    label: "Completed and archived",
    value: "archived",
  },
  {
    label: "All commercial requests",
    value: "all",
  },
];

const dateOptions = [
  {
    label: "Any submitted date",
    value: "",
  },
  {
    label: "Submitted today",
    value: "today",
  },
  {
    label: "Submitted this week",
    value: "week",
  },
  {
    label: "Submitted this month",
    value: "month",
  },
];

export default async function CommercialQuotesPage({
  searchParams,
}: CommercialQuotesPageProps) {
  const params = await searchParams;

  const context = await getAdminContext(
    "/admin/commercial-quotes",
  );

  const quotes = filterCommercialQuotes(
    context.commercialQuotes,
    params,
  );
  
  const photoUrlsByPath =
    await getCommercialPhotoUrls(quotes);
  
  const stats = getCommercialQuoteStats(
    context.commercialQuotes,
  );

  const heading =
    params.view === "archived"
      ? "Completed commercial opportunities."
      : "Commercial quote pipeline.";

  return (
    <AdminShell
      title="Commercial Quotes"
      auth={context.auth}
    >
      <section className="placeholder-panel admin-command-panel">
        <div className="admin-page-heading">
          <div>
            <p className="section-kicker">
              Commercial Intake
            </p>

            <h1>{heading}</h1>

            <p className="muted">
              Review property details, determine whether a
              walkthrough is needed, track quote progress, and
              keep internal notes in one place.
            </p>
          </div>

          <div className="status-stack">
            <span className="status-badge">
              {context.commercialQuotes.length} total
            </span>

            <span className="status-badge">
              {stats.active} active
            </span>
          </div>
        </div>

        <div className="admin-command-grid">
          <DashboardStat
            label="New requests"
            value={stats.new}
            href="/admin/commercial-quotes?status=new"
            tone={stats.new ? "warning" : "good"}
          />

          <DashboardStat
            label="Under review"
            value={stats.reviewing}
            href="/admin/commercial-quotes?status=reviewing"
            tone={
              stats.reviewing ? "warning" : "good"
            }
          />

          <DashboardStat
            label="Walkthrough needed"
            value={stats.siteVisitNeeded}
            href="/admin/commercial-quotes?status=site_visit_needed"
            tone={
              stats.siteVisitNeeded
                ? "warning"
                : "good"
            }
          />

          <DashboardStat
            label="Quotes sent"
            value={stats.quoted}
            href="/admin/commercial-quotes?status=quoted"
            tone="good"
          />
        </div>

        <nav
          className="status-tabs"
          aria-label="Commercial quote quick filters"
        >
          <Link href="/admin/commercial-quotes">
            Active pipeline
          </Link>

          <Link href="/admin/commercial-quotes?status=new">
            New
          </Link>

          <Link href="/admin/commercial-quotes?status=reviewing">
            Reviewing
          </Link>

          <Link href="/admin/commercial-quotes?status=site_visit_needed">
            Walkthrough needed
          </Link>

          <Link href="/admin/commercial-quotes?status=quoted">
            Quoted
          </Link>

          <Link href="/admin/commercial-quotes?view=archived">
            Completed
          </Link>

          <Link href="/admin/commercial-quotes?view=all">
            All
          </Link>
        </nav>

        <AdminFilterBar
          searchValue={params.q}
          searchPlaceholder="Business, contact, address, email, phone, service, or request ID"
          resultCount={quotes.length}
          resetHref="/admin/commercial-quotes"
          selects={[
            {
              name: "view",
              label: "View",
              value: params.view,
              options: viewOptions,
            },
            {
              name: "status",
              label: "Status",
              value: params.status,
              options: [
                {
                  label: "Any status",
                  value: "",
                },
                ...commercialQuoteStatuses.map(
                  (status) => ({
                    label: humanizeStatus(status),
                    value: status,
                  }),
                ),
              ],
            },
            {
              name: "propertyType",
              label: "Property type",
              value: params.propertyType,
              options: [
                {
                  label: "Any property type",
                  value: "",
                },
                ...Object.entries(
                  commercialPropertyTypeLabels,
                ).map(([value, label]) => ({
                  value,
                  label,
                })),
              ],
            },
            {
              name: "servicePlan",
              label: "Service plan",
              value: params.servicePlan,
              options: [
                {
                  label: "Any service plan",
                  value: "",
                },
                ...Object.entries(
                  commercialServicePlanLabels,
                ).map(([value, label]) => ({
                  value,
                  label,
                })),
              ],
            },
            {
              name: "start",
              label: "Desired start",
              value: params.start,
              options: [
                {
                  label: "Any start timeframe",
                  value: "",
                },
                ...Object.entries(
                  commercialStartTimeframeLabels,
                ).map(([value, label]) => ({
                  value,
                  label,
                })),
              ],
            },
            {
              name: "date",
              label: "Submitted",
              value: params.date,
              options: dateOptions,
            },
          ]}
        />

        {quotes.length ? (
          <div className="admin-queue-list">
            {quotes.map((quote) => {
              const nextAction =
                getCommercialQuoteNextAction(quote);

              const serviceLabels =
                getServiceLabels(quote);
              
              const quotePhotos = (
                quote.photo_paths ?? []
              ).map((path, index) => ({
                path,
                index,
                url:
                  photoUrlsByPath.get(path) ??
                  null,
              }));
              
              const fullAddress = [
                quote.street_address,
                quote.city,
                quote.state,
                quote.zip_code,
              ]
                .filter(Boolean)
                .join(", ");

              const shouldOpen =
                params.q === quote.id;

              return (
                <details
                  className="admin-queue-card"
                  key={quote.id}
                  open={shouldOpen || undefined}
                >
                  <summary className="admin-queue-summary">
                    <div className="admin-queue-main">
                      {quote.status === "new" ? (
                        <span className="needs-dot needs-dot-danger" />
                      ) : (
                        <span className="needs-dot" />
                      )}

                      <div>
                        <h2>{quote.business_name}</h2>

                        <p>
                          {getPropertyTypeLabel(quote)}
                          {" | "}
                          {quote.city}, {quote.state}
                          {" | "}
                          {quote.contact_name}
                        </p>
                      </div>
                    </div>

                    <div className="admin-queue-meta">
                      <span
                        className={`status-badge status-${quote.status}`}
                      >
                        {humanizeStatus(quote.status)}
                      </span>

                      <span className="status-badge">
                        {formatDateTime(
                          quote.created_at,
                        )}
                      </span>
                    </div>

                    <div className="admin-queue-next">
                      <strong>{nextAction}</strong>
                      <span>Open</span>
                    </div>
                  </summary>

                  <div className="admin-queue-detail">
                    <div className="admin-record-overview">
                      <InfoTile
                        label="Business"
                        value={quote.business_name}
                      />

                      <InfoTile
                        label="Contact"
                        value={quote.contact_name}
                      />

                      <InfoTile
                        label="Role"
                        value={
                          quote.contact_role ??
                          "Not provided"
                        }
                      />

                      <InfoTile
                        label="Preferred contact"
                        value={
                          commercialPreferredContactMethodLabels[
                            quote.preferred_contact_method
                          ]
                        }
                      />

                      <InfoTile
                        label="Property type"
                        value={getPropertyTypeLabel(
                          quote,
                        )}
                      />

                      <InfoTile
                        label="Locations"
                        value={String(
                          quote.location_count,
                        )}
                      />

                      <InfoTile
                        label="Service plan"
                        value={
                          commercialServicePlanLabels[
                            quote.service_plan
                          ]
                        }
                      />

                      <InfoTile
                        label="Desired start"
                        value={
                          commercialStartTimeframeLabels[
                            quote
                              .desired_start_timeframe
                          ]
                        }
                      />
                    </div>

                    <div className="commercial-quote-detail-layout">
                    <div className="commercial-quote-detail-column">
                      <section className="detail-panel commercial-quote-contact-panel">
                        <p className="section-kicker">
                          Contact & Property
                        </p>

                        <h2>
                          Who and where.
                        </h2>

                        <div className="admin-record-overview">
                          <InfoTile
                            label="Email"
                            value={quote.email}
                          />

                          <InfoTile
                            label="Phone"
                            value={quote.phone}
                          />

                          <InfoTile
                            label="Address"
                            value={fullAddress}
                          />

                          <InfoTile
                            label="Locations"
                            value={String(
                              quote.location_count,
                            )}
                          />
                        </div>

                        <div className="admin-secondary-links">
                          <a
                            className="button button-outline"
                            href={`mailto:${quote.email}`}
                          >
                            Email Contact
                          </a>

                          <a
                            className="button button-outline"
                            href={`tel:${quote.phone}`}
                          >
                            Call Contact
                          </a>

                          <a
                            className="button button-outline"
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                              fullAddress,
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open Map
                          </a>
                        </div>

                        <QuoteTextBlock
                          label="Access or service-hour restrictions"
                          value={
                            quote.access_restrictions
                          }
                        />

                        <QuoteTextBlock
                          label="Current collection schedule"
                          value={
                            quote.collection_schedule
                          }
                        />
                      </section>

                      <section className="detail-panel commercial-quote-description-panel">
                        <p className="section-kicker">
                          Customer Description
                        </p>
                      
                        <h2>
                          What is going on out there.
                        </h2>
                      
                        <QuoteTextBlock
                          label="Property and problem"
                          value={
                            quote.project_description
                          }
                        />
                      
                        <QuoteTextBlock
                          label="Additional customer notes"
                          value={
                            quote.additional_notes
                          }
                        />
                      
                        <InfoTile
                          label="Request ID"
                          value={quote.id}
                        />
                      </section>
                    </div>

                    <div className="commercial-quote-detail-column">
                      <section className="detail-panel commercial-quote-scope-panel">
                        <p className="section-kicker">
                          Requested Scope
                        </p>

                        <h2>
                          What they want cleaned.
                        </h2>

                        <div className="status-stack">
                          {serviceLabels.map(
                            (service) => (
                              <span
                                className="status-badge"
                                key={service}
                              >
                                {service}
                              </span>
                            ),
                          )}
                        </div>

                        <div className="admin-record-overview">
                          <InfoTile
                            label="Container count"
                            value={
                              quote.container_count
                                ? String(
                                    quote.container_count,
                                  )
                                : "Not provided"
                            }
                          />

                          <InfoTile
                            label="Container sizes"
                            value={
                              quote.container_sizes ??
                              "Not provided"
                            }
                          />

                          <InfoTile
                            label="Current condition"
                            value={
                              commercialSiteConditionLabels[
                                quote.site_condition
                              ]
                            }
                          />

                          <InfoTile
                            label="Exterior water"
                            value={
                              commercialWaterAvailabilityLabels[
                                quote
                                  .water_spigot_available
                              ]
                            }
                          />

                          <InfoTile
                            label="Frequency"
                            value={
                              quote.desired_frequency
                                ? commercialDesiredFrequencyLabels[
                                    quote
                                      .desired_frequency
                                  ]
                                : "Not applicable"
                            }
                          />

                      <InfoTile
                        label="Photos"
                        value={
                          quote.photo_paths.length
                            ? `${quote.photo_paths.length} uploaded`
                            : "None uploaded"
                        }
                      />
                      </div>
                      
                      {quotePhotos.length ? (
                        <div className="commercial-admin-photo-grid">
                          {quotePhotos.map((photo) =>
                            photo.url ? (
                              <a
                                aria-label={`Open property photo ${
                                  photo.index + 1
                                }`}
                                className="commercial-admin-photo-card"
                                href={photo.url}
                                key={photo.path}
                                rel="noreferrer"
                                style={{
                                  backgroundImage:
                                    `url("${photo.url}")`,
                                }}
                                target="_blank"
                              >
                                <span>
                                  Photo {photo.index + 1}
                                </span>
                              </a>
                            ) : null,
                          )}
                        </div>
                      ) : null}
                      </section>

                      <section className="detail-panel commercial-quote-workflow-panel">
                        <p className="section-kicker">
                          Internal Workflow
                        </p>

                        <h2>
                          Review and update.
                        </h2>
                        
                        <div className="admin-action-cluster">
                          <Link
                            className="button button-primary"
                            href={`/admin/commercial-quotes/${quote.id}/quote`}
                          >
                            Build / Edit Quote
                          </Link>
                        </div>
                        
                        <FeedbackForm
                          action={
                            updateCommercialQuoteAdminAction
                          }
                          className="compact-admin-form"
                          pendingMessage="Saving commercial quote..."
                          successMessage="Commercial quote updated."
                        >
                          <input
                            type="hidden"
                            name="commercialQuoteId"
                            value={quote.id}
                          />

                          <label className="field">
                            <span>
                              Pipeline status
                            </span>

                            <select
                              name="status"
                              defaultValue={
                                quote.status
                              }
                            >
                              {commercialQuoteStatuses.map(
                                (status) => (
                                  <option
                                    value={status}
                                    key={status}
                                  >
                                    {humanizeStatus(
                                      status,
                                    )}
                                  </option>
                                ),
                              )}
                            </select>

                            <small className="field-help">
                              Status changes are
                              internal. The customer is
                              not emailed automatically.
                            </small>
                          </label>

                          <label className="field">
                            <span>
                              Internal notes
                            </span>

                            <textarea
                              name="adminNotes"
                              defaultValue={
                                quote.admin_notes ?? ""
                              }
                              placeholder="Walkthrough details, pricing thoughts, vendor requirements, follow-up history..."
                            />
                          </label>

                          <div className="admin-action-cluster">
                            <ActionSubmitButton
                              pendingLabel="Saving quote..."
                            >
                              Save Status + Notes
                            </ActionSubmitButton>
                          </div>
                        </FeedbackForm>
                      </section>
                    </div>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      ) : (
          <section className="detail-panel">
            <p className="section-kicker">
              Queue Clear
            </p>

            <h2>
              No commercial requests match these filters.
            </h2>

            <p className="muted">
              Either the commercial world is behaving
              itself, or the current filters are hiding the
              mess.
            </p>
          </section>
        )}
      </section>
    </AdminShell>
  );
}

function DashboardStat({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: number;
  href: string;
  tone: "good" | "warning" | "danger";
}) {
  return (
    <Link
      className={`command-stat-card command-stat-${tone}`}
      href={href}
    >
      <span>{label}</span>
      <strong>{value}</strong>
      <small>Open filtered queue.</small>
    </Link>
  );
}

function InfoTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function QuoteTextBlock({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <strong>{label}</strong>

      <p className="muted">
        {value?.trim() || "Not provided."}
      </p>
    </div>
  );
}

function filterCommercialQuotes(
  quotes: CommercialQuoteRequestRow[],
  params: Record<string, string | undefined>,
) {
  const query = params.q?.trim() ?? "";

  const now = new Date();

  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );

  const weekAgo = new Date(
    now.getTime() -
      7 * 24 * 60 * 60 * 1000,
  );

  const monthStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
  );

  return quotes
    .filter((quote) => {
      const archived =
        archivedStatuses.includes(
          quote.status,
        );

      if (params.view === "archived") {
        return archived;
      }

      if (params.view === "all") {
        return true;
      }

      return !archived;
    })
    .filter((quote) =>
      includesSearch(
        [
          quote.id,
          quote.business_name,
          quote.contact_name,
          quote.contact_role,
          quote.email,
          quote.phone,
          quote.street_address,
          quote.city,
          quote.state,
          quote.zip_code,
          quote.project_description,
          quote.additional_notes,
          quote.admin_notes,
          ...getServiceLabels(quote),
        ],
        query,
      ),
    )
    .filter(
      (quote) =>
        !params.status ||
        quote.status === params.status,
    )
    .filter(
      (quote) =>
        !params.propertyType ||
        quote.property_type ===
          params.propertyType,
    )
    .filter(
      (quote) =>
        !params.servicePlan ||
        quote.service_plan ===
          params.servicePlan,
    )
    .filter(
      (quote) =>
        !params.start ||
        quote.desired_start_timeframe ===
          params.start,
    )
    .filter((quote) => {
      const createdAt = new Date(
        quote.created_at,
      );

      if (params.date === "today") {
        return createdAt >= todayStart;
      }

      if (params.date === "week") {
        return createdAt >= weekAgo;
      }

      if (params.date === "month") {
        return createdAt >= monthStart;
      }

      return true;
    })
    .sort((a, b) => {
      const priorityDifference =
        getCommercialQuotePriority(a) -
        getCommercialQuotePriority(b);

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      return b.created_at.localeCompare(
        a.created_at,
      );
    });
}

function getCommercialQuoteStats(
  quotes: CommercialQuoteRequestRow[],
) {
  const active = quotes.filter(
    (quote) =>
      !archivedStatuses.includes(
        quote.status,
      ),
  ).length;

  return {
    active,
    new: quotes.filter(
      (quote) => quote.status === "new",
    ).length,
    reviewing: quotes.filter(
      (quote) =>
        quote.status === "reviewing",
    ).length,
    siteVisitNeeded: quotes.filter(
      (quote) =>
        quote.status ===
        "site_visit_needed",
    ).length,
    quoted: quotes.filter(
      (quote) => quote.status === "quoted",
    ).length,
  };
}

function getCommercialQuotePriority(
  quote: CommercialQuoteRequestRow,
) {
  if (quote.status === "new") {
    return 10;
  }

  if (
    quote.status ===
    "site_visit_needed"
  ) {
    return 20;
  }

  if (quote.status === "reviewing") {
    return 30;
  }

  if (quote.status === "quoted") {
    return 40;
  }

  if (quote.status === "won") {
    return 80;
  }

  if (quote.status === "lost") {
    return 90;
  }

  return 100;
}

function getCommercialQuoteNextAction(
  quote: CommercialQuoteRequestRow,
) {
  if (quote.status === "new") {
    return "Review request";
  }

  if (quote.status === "reviewing") {
    return "Continue review";
  }

  if (
    quote.status ===
    "site_visit_needed"
  ) {
    return "Schedule walkthrough";
  }

  if (quote.status === "quoted") {
    return "Await decision";
  }

  if (quote.status === "won") {
    return "Won";
  }

  if (quote.status === "lost") {
    return "Lost";
  }

  return "Closed";
}

function getPropertyTypeLabel(
  quote: CommercialQuoteRequestRow,
) {
  if (
    quote.property_type === "other" &&
    quote.property_type_other
  ) {
    return quote.property_type_other;
  }

  return (
    commercialPropertyTypeLabels[
      quote.property_type
    ] ??
    humanizeStatus(quote.property_type)
  );
}

function getServiceLabels(
  quote: CommercialQuoteRequestRow,
) {
  const labels =
    quote.service_interests.map(
      (service) =>
        commercialServiceInterestLabels[
          service
        ] ?? humanizeStatus(service),
    );

  if (
    quote.service_other &&
    quote.service_interests.includes(
      "other_exterior_cleaning",
    )
  ) {
    labels.push(quote.service_other);
  }

  return labels;
}

async function getCommercialPhotoUrls(
  quotes: CommercialQuoteRequestRow[],
) {
  const paths = Array.from(
    new Set(
      quotes.flatMap(
        (quote) =>
          quote.photo_paths ?? [],
      ),
    ),
  );

  if (!paths.length) {
    return new Map<string, string>();
  }

  const {
    data,
    error,
  } = await getSupabaseAdmin()
    .storage
    .from(
      COMMERCIAL_QUOTE_PHOTO_BUCKET,
    )
    .createSignedUrls(
      paths,
      60 * 60,
    );

  if (error || !data) {
    return new Map<string, string>();
  }

  return new Map(
    data.flatMap((photo) =>
      photo.signedUrl
        ? [
            [
              photo.path,
              photo.signedUrl,
            ] as const,
          ]
        : [],
    ),
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    },
  ).format(new Date(value));
}
