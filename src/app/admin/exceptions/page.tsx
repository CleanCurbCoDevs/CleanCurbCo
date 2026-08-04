import type { Metadata } from "next";
import Link from "next/link";

import {
  updateBookingExceptionAction,
} from "@/app/admin/exceptions/actions";
import {
  ActionSubmitButton,
  FeedbackForm,
} from "@/components/action-feedback";
import {
  AdminFilterBar,
} from "@/components/admin-filter-bar";
import {
  AdminShell,
} from "@/components/shells/admin-shell";
import {
  includesSearch,
} from "@/lib/admin-operations";
import {
  getAdminBookingExceptions,
} from "@/lib/server/admin-booking-exceptions";
import type {
  BookingExceptionRow,
  BookingExceptionSeverity,
  BookingExceptionStatus,
  BookingRow,
  ProfileRow,
} from "@/types/database";

import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Admin Exceptions",
};

type AdminExceptionsPageProps = {
  searchParams: Promise<
    Record<string, string | undefined>
  >;
};

type ExceptionStatusFilter =
  | "active"
  | BookingExceptionStatus
  | "all";

type ExceptionSort =
  | "priority"
  | "last_seen_desc"
  | "last_seen_asc"
  | "occurrences"
  | "customer";

type ExceptionCardProps = {
  exception: BookingExceptionRow;
  booking: BookingRow | null;
  customer: ProfileRow | null;
  assignee: ProfileRow | null;
  acknowledgedBy: ProfileRow | null;
  resolvedBy: ProfileRow | null;
  assignableProfiles: ProfileRow[];
  actionsBlocked: boolean;
};

const statusFilterValues:
  readonly ExceptionStatusFilter[] = [
    "active",
    "open",
    "acknowledged",
    "resolved",
    "dismissed",
    "all",
  ];

const severityValues:
  readonly BookingExceptionSeverity[] = [
    "urgent",
    "warning",
    "info",
  ];

const sortValues:
  readonly ExceptionSort[] = [
    "priority",
    "last_seen_desc",
    "last_seen_asc",
    "occurrences",
    "customer",
  ];

export default async function AdminExceptionsPage({
  searchParams,
}: AdminExceptionsPageProps) {
  const params = await searchParams;
  const context =
    await getAdminBookingExceptions();

  const currentUserId =
    context.auth.status === "ok"
      ? context.auth.userId
      : "";

  const statusFilter =
    statusFilterValues.includes(
      params.status as ExceptionStatusFilter,
    )
      ? (
          params.status as
            ExceptionStatusFilter
        )
      : "active";

  const allProfiles = dedupeProfiles([
    ...context.profiles,
    ...context.assignableProfiles,
  ]);

  const bookingsById = new Map(
    context.bookings.map(
      (booking) =>
        [booking.id, booking] as const,
    ),
  );

  const profilesById = new Map(
    allProfiles.map(
      (profile) =>
        [profile.id, profile] as const,
    ),
  );

  const exceptionPool =
    getExceptionPool(
      context.activeExceptions,
      context.historyExceptions,
      statusFilter,
    );

  const exceptions =
    filterAndSortExceptions({
      exceptions:
        exceptionPool,
      params,
      currentUserId,
      bookingsById,
      profilesById,
    });

  const exceptionTypes = [
    ...new Set(
      [
        ...context.activeExceptions,
        ...context.historyExceptions,
      ].map(
        (exception) =>
          exception.exception_type,
      ),
    ),
  ].sort((left, right) =>
    left.localeCompare(right),
  );

  const availableHistoryCount =
    Math.min(
      context.counts.resolved +
        context.counts.dismissed,
      250,
    );

  return (
    <AdminShell
      title="Exceptions"
      auth={context.auth}
    >
      <section
        className={`placeholder-panel ${styles.commandPanel}`}
      >
        <div className="admin-page-heading">
          <div>
            <p className="section-kicker">
              Human attention queue
            </p>

            <h1>
              Fix what the software could not.
            </h1>

            <p className="muted">
              Exceptions remain here until the
              underlying problem is repaired,
              dismissed with a reason, or fixed
              automatically by Clean Curb OS.
            </p>
          </div>

          <span
            className={[
              "status-badge",
              context.counts.active
                ? styles.activeCount
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {context.counts.active} active
          </span>
        </div>

        {context.loadError ? (
          <div
            className={styles.loadWarning}
            role="alert"
          >
            <strong>
              Exception data is incomplete.
            </strong>

            <p>
              {context.loadError} Actions are
              temporarily hidden so an incomplete
              screen cannot produce a bad
              decision.
            </p>
          </div>
        ) : null}

        <div className={styles.metricGrid}>
          <MetricCard
            href="/admin/exceptions?status=active"
            label="Active work"
            value={context.counts.active}
            detail="Open and acknowledged"
            tone="active"
          />

          <MetricCard
            href="/admin/exceptions?status=open"
            label="Unacknowledged"
            value={context.counts.open}
            detail="Still waiting for review"
            tone="open"
          />

          <MetricCard
            href="/admin/exceptions?status=acknowledged"
            label="In somebody's hands"
            value={
              context.counts.acknowledged
            }
            detail="Acknowledged, not closed"
            tone="acknowledged"
          />

          <MetricCard
            href="/admin/exceptions?status=resolved"
            label="Resolved"
            value={context.counts.resolved}
            detail="Successfully handled"
            tone="resolved"
          />

          <MetricCard
            href="/admin/exceptions?status=dismissed"
            label="Dismissed"
            value={context.counts.dismissed}
            detail="Closed as non-actionable"
            tone="dismissed"
          />
        </div>

        <details
          className="admin-filter-drawer"
          open
        >
          <summary>
            Search and filter exceptions
          </summary>

          <AdminFilterBar
            searchValue={params.q}
            searchPlaceholder="Customer, address, booking, error, or request ID"
            resultCount={
              exceptions.length
            }
            resetHref="/admin/exceptions"
            selects={[
              {
                name: "status",
                label: "Queue",
                value:
                  statusFilter,
                options: [
                  {
                    label:
                      `Active (${context.counts.active})`,
                    value:
                      "active",
                  },
                  {
                    label:
                      `Open (${context.counts.open})`,
                    value:
                      "open",
                  },
                  {
                    label:
                      `Acknowledged (${context.counts.acknowledged})`,
                    value:
                      "acknowledged",
                  },
                  {
                    label:
                      `Resolved (${context.counts.resolved})`,
                    value:
                      "resolved",
                  },
                  {
                    label:
                      `Dismissed (${context.counts.dismissed})`,
                    value:
                      "dismissed",
                  },
                  {
                    label:
                      `All available (${context.counts.active + availableHistoryCount})`,
                    value:
                      "all",
                  },
                ],
              },
              {
                name: "severity",
                label: "Severity",
                value:
                  params.severity,
                options: [
                  {
                    label:
                      "Any severity",
                    value: "",
                  },
                  ...severityValues.map(
                    (severity) => ({
                      label:
                        humanize(
                          severity,
                        ),
                      value:
                        severity,
                    }),
                  ),
                ],
              },
              {
                name: "assignee",
                label: "Assignment",
                value:
                  params.assignee,
                options: [
                  {
                    label:
                      "Any assignment",
                    value: "",
                  },
                  {
                    label:
                      "Unassigned",
                    value:
                      "unassigned",
                  },
                  ...(currentUserId
                    ? [
                        {
                          label:
                            "Assigned to me",
                          value:
                            "me",
                        },
                      ]
                    : []),
                  ...context.assignableProfiles.map(
                    (profile) => ({
                      label:
                        profileName(
                          profile,
                        ),
                      value:
                        profile.id,
                    }),
                  ),
                ],
              },
              {
                name: "type",
                label: "Problem type",
                value:
                  params.type,
                options: [
                  {
                    label:
                      "Any problem type",
                    value: "",
                  },
                  ...exceptionTypes.map(
                    (exceptionType) => ({
                      label:
                        humanize(
                          exceptionType,
                        ),
                      value:
                        exceptionType,
                    }),
                  ),
                ],
              },
              {
                name: "sort",
                label: "Sort",
                value:
                  params.sort ??
                  "priority",
                options: [
                  {
                    label:
                      "Urgent first",
                    value:
                      "priority",
                  },
                  {
                    label:
                      "Most recently seen",
                    value:
                      "last_seen_desc",
                  },
                  {
                    label:
                      "Oldest activity first",
                    value:
                      "last_seen_asc",
                  },
                  {
                    label:
                      "Most occurrences",
                    value:
                      "occurrences",
                  },
                  {
                    label:
                      "Customer name",
                    value:
                      "customer",
                  },
                ],
              },
            ]}
          />
        </details>

        {[
          "resolved",
          "dismissed",
          "all",
        ].includes(statusFilter) ? (
          <p className={styles.historyNote}>
            Closed-history results are limited
            to the 250 most recently seen
            exceptions. The count cards still
            show exact lifetime totals.
          </p>
        ) : null}

        {exceptions.length ? (
          <div className={styles.exceptionList}>
            {exceptions.map(
              (exception) => {
                const booking =
                  bookingsById.get(
                    exception.booking_id,
                  ) ?? null;

                const customer =
                  exception.customer_id
                    ? profilesById.get(
                        exception.customer_id,
                      ) ?? null
                    : null;

                const assignee =
                  exception.assigned_to_profile_id
                    ? profilesById.get(
                        exception
                          .assigned_to_profile_id,
                      ) ?? null
                    : null;

                const acknowledgedBy =
                  exception
                    .acknowledged_by_profile_id
                    ? profilesById.get(
                        exception
                          .acknowledged_by_profile_id,
                      ) ?? null
                    : null;

                const resolvedBy =
                  exception
                    .resolved_by_profile_id
                    ? profilesById.get(
                        exception
                          .resolved_by_profile_id,
                      ) ?? null
                    : null;

                return (
                  <ExceptionCard
                    key={exception.id}
                    exception={exception}
                    booking={booking}
                    customer={customer}
                    assignee={assignee}
                    acknowledgedBy={
                      acknowledgedBy
                    }
                    resolvedBy={resolvedBy}
                    assignableProfiles={
                      context.assignableProfiles
                    }
                    actionsBlocked={Boolean(
                      context.loadError,
                    )}
                  />
                );
              },
            )}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <strong>
              No exceptions match this view.
            </strong>

            <p>
              That either means the software is
              behaving itself, or the filters
              are hiding the garbage fire.
            </p>

            <Link
              className="button button-outline"
              href="/admin/exceptions"
            >
              Reset exception view
            </Link>
          </div>
        )}
      </section>
    </AdminShell>
  );
}

function ExceptionCard({
  exception,
  booking,
  customer,
  assignee,
  acknowledgedBy,
  resolvedBy,
  assignableProfiles,
  actionsBlocked,
}: ExceptionCardProps) {
  const isActive =
    exception.status === "open" ||
    exception.status ===
      "acknowledged";

  const currentAssigneeIsAssignable =
    exception.assigned_to_profile_id
      ? assignableProfiles.some(
          (profile) =>
            profile.id ===
            exception.assigned_to_profile_id,
        )
      : true;

  const metadataAvailable =
    Object.keys(
      exception.metadata,
    ).length > 0;

  return (
    <details
      className={[
        styles.exceptionCard,
        severityClass(
          exception.severity,
        ),
        statusClass(
          exception.status,
        ),
      ].join(" ")}
      open={
        exception.severity ===
          "urgent" &&
        exception.status ===
          "open"
      }
    >
      <summary className={styles.cardSummary}>
        <span className={styles.summaryMain}>
          <span className={styles.badgeRow}>
            <span
              className={[
                styles.badge,
                severityBadgeClass(
                  exception.severity,
                ),
              ].join(" ")}
            >
              {humanize(
                exception.severity,
              )}
            </span>

            <span
              className={[
                styles.badge,
                statusBadgeClass(
                  exception.status,
                ),
              ].join(" ")}
            >
              {humanize(
                exception.status,
              )}
            </span>

            {exception.occurrence_count >
            1 ? (
              <span
                className={[
                  styles.badge,
                  styles.occurrenceBadge,
                ].join(" ")}
              >
                {
                  exception.occurrence_count
                }{" "}
                occurrences
              </span>
            ) : null}
          </span>

          <strong>
            {exception.title}
          </strong>

          <small>
            {booking
              ? bookingName(
                  booking,
                )
              : "Booking details unavailable"}
            {" · "}
            Last seen{" "}
            {formatDate(
              exception.last_seen_at,
            )}
          </small>
        </span>

        <span className={styles.reviewBadge}>
          Review
        </span>
      </summary>

      <div className={styles.cardBody}>
        <p className={styles.message}>
          {exception.message}
        </p>

        <div className={styles.recordGrid}>
          <RecordCard
            label="Customer"
            value={
              booking
                ? bookingName(
                    booking,
                  )
                : customer
                  ? profileName(
                      customer,
                    )
                  : "Unknown customer"
            }
            details={[
              booking?.email ??
                customer?.email ??
                "No email available",
              booking?.phone ??
                customer?.phone ??
                "No phone available",
            ]}
          />

          <RecordCard
            label="Service address"
            value={
              booking
                ? formatAddress(
                    booking,
                  )
                : "Address unavailable"
            }
            details={[
              booking?.neighborhood ??
                "No neighborhood recorded",
            ]}
          />

          <RecordCard
            label="Assignment"
            value={
              assignee
                ? profileName(
                    assignee,
                  )
                : "Unassigned"
            }
            details={[
              exception.status ===
              "acknowledged"
                ? "Acknowledged and active"
                : humanize(
                    exception.status,
                  ),
            ]}
          />

          <RecordCard
            label="Problem"
            value={humanize(
              exception.exception_type,
            )}
            details={[
              `Source: ${humanize(
                exception.source,
              )}`,
            ]}
          />
        </div>

        <div className={styles.linkRow}>
          <Link
            className="button button-dark"
            href={`/admin/bookings?q=${encodeURIComponent(
              exception.booking_id,
            )}`}
          >
            Open booking
          </Link>

          {exception.customer_id ? (
            <Link
              className="button button-outline"
              href={`/admin/customers/${encodeURIComponent(
                exception.customer_id,
              )}`}
            >
              Open customer
            </Link>
          ) : null}
        </div>

        <dl className={styles.lifecycleGrid}>
          <LifecycleItem
            label="First seen"
            value={formatDate(
              exception.first_seen_at,
            )}
          />

          <LifecycleItem
            label="Last seen"
            value={formatDate(
              exception.last_seen_at,
            )}
          />

          <LifecycleItem
            label="Acknowledged"
            value={
              exception.acknowledged_at
                ? `${formatDate(
                    exception.acknowledged_at,
                  )} by ${
                    acknowledgedBy
                      ? profileName(
                          acknowledgedBy,
                        )
                      : "administrator"
                  }`
                : "Not yet"
            }
          />

          <LifecycleItem
            label="Closed"
            value={
              exception.resolved_at
                ? `${formatDate(
                    exception.resolved_at,
                  )} by ${
                    resolvedBy
                      ? profileName(
                          resolvedBy,
                        )
                      : "administrator"
                  }`
                : "Still active"
            }
          />
        </dl>

        {exception.resolution_note ? (
          <div className={styles.resolutionNote}>
            <strong>
              Closure note
            </strong>

            <p>
              {exception.resolution_note}
            </p>
          </div>
        ) : null}

        <details className={styles.technicalDetails}>
          <summary>
            Technical details
          </summary>

          <div className={styles.technicalGrid}>
            <TechnicalItem
              label="Exception ID"
              value={exception.id}
            />

            <TechnicalItem
              label="Booking ID"
              value={exception.booking_id}
            />

            <TechnicalItem
              label="Dedupe key"
              value={exception.dedupe_key}
            />

            <TechnicalItem
              label="Request ID"
              value={
                exception.request_id ??
                "Not recorded"
              }
            />

            <TechnicalItem
              label="Source event"
              value={
                exception.source_event_id ??
                "Not linked"
              }
            />
          </div>

          {metadataAvailable ? (
            <pre className={styles.metadata}>
              {JSON.stringify(
                exception.metadata,
                null,
                2,
              )}
            </pre>
          ) : (
            <p className={styles.noMetadata}>
              No additional metadata was
              recorded.
            </p>
          )}
        </details>

        {actionsBlocked ? (
          <div className={styles.actionBlocked}>
            Actions are unavailable until the
            exception data loads completely.
          </div>
        ) : isActive ? (
          <ActiveExceptionActions
            exception={exception}
            assignee={assignee}
            assignableProfiles={
              assignableProfiles
            }
            currentAssigneeIsAssignable={
              currentAssigneeIsAssignable
            }
          />
        ) : (
          <ReopenExceptionAction
            exception={exception}
          />
        )}
      </div>
    </details>
  );
}

function ActiveExceptionActions({
  exception,
  assignee,
  assignableProfiles,
  currentAssigneeIsAssignable,
}: {
  exception: BookingExceptionRow;
  assignee: ProfileRow | null;
  assignableProfiles: ProfileRow[];
  currentAssigneeIsAssignable: boolean;
}) {
  return (
    <div className={styles.actionGrid}>
      {exception.status === "open" ? (
        <section className={styles.actionPanel}>
          <h3>
            Acknowledge
          </h3>

          <p>
            Mark that somebody has reviewed
            the problem without closing it.
          </p>

          <FeedbackForm
            action={
              updateBookingExceptionAction
            }
            pendingMessage="Acknowledging exception..."
            successMessage="Exception acknowledged."
          >
            <input
              type="hidden"
              name="exceptionId"
              value={exception.id}
            />

            <input
              type="hidden"
              name="action"
              value="acknowledge"
            />

            <ActionSubmitButton
              pendingLabel="Acknowledging..."
            >
              Acknowledge
            </ActionSubmitButton>
          </FeedbackForm>
        </section>
      ) : null}

      <section className={styles.actionPanel}>
        <h3>
          Assignment
        </h3>

        <p>
          Put the problem in somebody&apos;s
          hands or return it to the
          unassigned queue.
        </p>

        <FeedbackForm
          action={
            updateBookingExceptionAction
          }
          pendingMessage="Updating assignment..."
          successMessage="Assignment updated."
        >
          <input
            type="hidden"
            name="exceptionId"
            value={exception.id}
          />

          <input
            type="hidden"
            name="action"
            value="assign"
          />

          <label className="field">
            <span>
              Assigned to
            </span>

            <select
              name="assigneeId"
              defaultValue={
                exception.assigned_to_profile_id ??
                ""
              }
            >
              <option value="">
                Unassigned
              </option>

              {!currentAssigneeIsAssignable &&
              exception.assigned_to_profile_id ? (
                <option
                  value={
                    exception
                      .assigned_to_profile_id
                  }
                  disabled
                >
                  {assignee
                    ? `${profileName(
                        assignee,
                      )} — no longer assignable`
                    : "Previous administrator — no longer assignable"}
                </option>
              ) : null}

              {assignableProfiles.map(
                (profile) => (
                  <option
                    value={profile.id}
                    key={profile.id}
                  >
                    {profileName(
                      profile,
                    )}
                  </option>
                ),
              )}
            </select>
          </label>

          <ActionSubmitButton
            pendingLabel="Saving assignment..."
          >
            Save assignment
          </ActionSubmitButton>
        </FeedbackForm>
      </section>

      <section
        className={[
          styles.actionPanel,
          styles.closePanel,
        ].join(" ")}
      >
        <h3>
          Close exception
        </h3>

        <p>
          Resolve a repaired problem or
          dismiss a record that does not
          require action. The note becomes
          permanent history.
        </p>

        <FeedbackForm
          action={
            updateBookingExceptionAction
          }
          confirmMessage="Close this exception? The note and decision will be recorded in permanent booking history."
          pendingMessage="Closing exception..."
          resetOnSuccess
          successMessage="Exception closed."
        >
          <input
            type="hidden"
            name="exceptionId"
            value={exception.id}
          />

          <label className="field">
            <span>
              Resolution or dismissal note
            </span>

            <textarea
              name="resolutionNote"
              minLength={3}
              maxLength={2000}
              rows={4}
              required
              placeholder="What was fixed, or why does this not require action?"
            />
          </label>

          <div className={styles.closeButtons}>
            <ActionSubmitButton
              name="action"
              value="resolve"
              pendingLabel="Closing..."
            >
              Resolve
            </ActionSubmitButton>

            <ActionSubmitButton
              className="button button-outline button-danger"
              name="action"
              value="dismiss"
              pendingLabel="Closing..."
            >
              Dismiss
            </ActionSubmitButton>
          </div>
        </FeedbackForm>
      </section>
    </div>
  );
}

function ReopenExceptionAction({
  exception,
}: {
  exception: BookingExceptionRow;
}) {
  return (
    <section className={styles.reopenPanel}>
      <div>
        <h3>
          Reopen this exception
        </h3>

        <p>
          Use this when the problem still
          requires human attention or was
          closed by mistake.
        </p>
      </div>

      <FeedbackForm
        action={
          updateBookingExceptionAction
        }
        confirmMessage="Reopen this exception and return it to the active queue?"
        pendingMessage="Reopening exception..."
        successMessage="Exception reopened."
      >
        <input
          type="hidden"
          name="exceptionId"
          value={exception.id}
        />

        <input
          type="hidden"
          name="action"
          value="reopen"
        />

        <ActionSubmitButton
          pendingLabel="Reopening..."
        >
          Reopen exception
        </ActionSubmitButton>
      </FeedbackForm>
    </section>
  );
}

function MetricCard({
  href,
  label,
  value,
  detail,
  tone,
}: {
  href: string;
  label: string;
  value: number;
  detail: string;
  tone:
    | "active"
    | "open"
    | "acknowledged"
    | "resolved"
    | "dismissed";
}) {
  const toneClasses = {
    active:
      styles.metricActive,
    open:
      styles.metricOpen,
    acknowledged:
      styles.metricAcknowledged,
    resolved:
      styles.metricResolved,
    dismissed:
      styles.metricDismissed,
  };

  return (
    <Link
      className={[
        styles.metricCard,
        toneClasses[tone],
      ].join(" ")}
      href={href}
    >
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

      <small>
        {detail}
      </small>
    </Link>
  );
}

function RecordCard({
  label,
  value,
  details,
}: {
  label: string;
  value: string;
  details: string[];
}) {
  return (
    <div className={styles.record}>
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

      {details.map(
        (detail, index) => (
          <small key={`${label}-${index}`}>
            {detail}
          </small>
        ),
      )}
    </div>
  );
}

function LifecycleItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt>
        {label}
      </dt>

      <dd>
        {value}
      </dd>
    </div>
  );
}

function TechnicalItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <span>
        {label}
      </span>

      <code>
        {value}
      </code>
    </div>
  );
}

function getExceptionPool(
  activeExceptions:
    BookingExceptionRow[],
  historyExceptions:
    BookingExceptionRow[],
  status:
    ExceptionStatusFilter,
): BookingExceptionRow[] {
  switch (status) {
    case "active":
      return [
        ...activeExceptions,
      ];

    case "open":
    case "acknowledged":
      return activeExceptions.filter(
        (exception) =>
          exception.status ===
          status,
      );

    case "resolved":
    case "dismissed":
      return historyExceptions.filter(
        (exception) =>
          exception.status ===
          status,
      );

    case "all":
      return [
        ...activeExceptions,
        ...historyExceptions,
      ];
  }
}

function filterAndSortExceptions(input: {
  exceptions:
    BookingExceptionRow[];
  params:
    Record<
      string,
      string | undefined
    >;
  currentUserId: string;
  bookingsById:
    Map<string, BookingRow>;
  profilesById:
    Map<string, ProfileRow>;
}) {
  const query =
    input.params.q?.trim() ??
    "";

  const severity =
    severityValues.includes(
      input.params
        .severity as
        BookingExceptionSeverity,
    )
      ? (
          input.params
            .severity as
            BookingExceptionSeverity
        )
      : null;

  const sort =
    sortValues.includes(
      input.params
        .sort as
        ExceptionSort,
    )
      ? (
          input.params
            .sort as
            ExceptionSort
        )
      : "priority";

  const filtered =
    input.exceptions.filter(
      (exception) => {
        const booking =
          input.bookingsById.get(
            exception.booking_id,
          ) ?? null;

        const customer =
          exception.customer_id
            ? input.profilesById.get(
                exception.customer_id,
              ) ?? null
            : null;

        const assignee =
          exception
            .assigned_to_profile_id
            ? input.profilesById.get(
                exception
                  .assigned_to_profile_id,
              ) ?? null
            : null;

        if (
          severity &&
          exception.severity !==
            severity
        ) {
          return false;
        }

        if (
          input.params.type &&
          exception.exception_type !==
            input.params.type
        ) {
          return false;
        }

        if (
          input.params.assignee ===
            "unassigned" &&
          exception
            .assigned_to_profile_id
        ) {
          return false;
        }

        if (
          input.params.assignee ===
            "me" &&
          exception
            .assigned_to_profile_id !==
            input.currentUserId
        ) {
          return false;
        }

        if (
          input.params.assignee &&
          input.params.assignee !==
            "unassigned" &&
          input.params.assignee !==
            "me" &&
          exception
            .assigned_to_profile_id !==
            input.params.assignee
        ) {
          return false;
        }

        return includesSearch(
          [
            exception.id,
            exception.booking_id,
            exception.title,
            exception.message,
            exception.exception_type,
            exception.source,
            exception.request_id,
            exception.dedupe_key,
            exception.resolution_note,
            JSON.stringify(
              exception.metadata,
            ),
            booking?.first_name,
            booking?.last_name,
            booking?.email,
            booking?.phone,
            booking?.street_address,
            booking?.city,
            booking?.state,
            booking?.zip_code,
            booking?.neighborhood,
            customer?.first_name,
            customer?.last_name,
            customer?.email,
            customer?.phone,
            assignee?.first_name,
            assignee?.last_name,
            assignee?.email,
          ],
          query,
        );
      },
    );

  return filtered.sort(
    (left, right) => {
      const leftBooking =
        input.bookingsById.get(
          left.booking_id,
        ) ?? null;

      const rightBooking =
        input.bookingsById.get(
          right.booking_id,
        ) ?? null;

      switch (sort) {
        case "last_seen_desc":
          return (
            new Date(
              right.last_seen_at,
            ).getTime() -
            new Date(
              left.last_seen_at,
            ).getTime()
          );

        case "last_seen_asc":
          return (
            new Date(
              left.last_seen_at,
            ).getTime() -
            new Date(
              right.last_seen_at,
            ).getTime()
          );

        case "occurrences":
          return (
            right.occurrence_count -
              left.occurrence_count ||
            new Date(
              right.last_seen_at,
            ).getTime() -
              new Date(
                left.last_seen_at,
              ).getTime()
          );

        case "customer":
          return bookingName(
            leftBooking,
          ).localeCompare(
            bookingName(
              rightBooking,
            ),
          );

        case "priority":
          return (
            priorityRank(left) -
              priorityRank(right) ||
            right.occurrence_count -
              left.occurrence_count ||
            new Date(
              right.last_seen_at,
            ).getTime() -
              new Date(
                left.last_seen_at,
              ).getTime()
          );
      }
    },
  );
}

function priorityRank(
  exception:
    BookingExceptionRow,
) {
  const severityRank = {
    urgent: 0,
    warning: 10,
    info: 20,
  }[
    exception.severity
  ];

  const statusRank =
    exception.status === "open"
      ? 0
      : exception.status ===
          "acknowledged"
        ? 1
        : 2;

  const assignmentRank =
    exception
      .assigned_to_profile_id
      ? 1
      : 0;

  return (
    severityRank +
    statusRank +
    assignmentRank
  );
}

function dedupeProfiles(
  profiles:
    ProfileRow[],
) {
  return [
    ...new Map(
      profiles.map(
        (profile) =>
          [profile.id, profile] as const,
      ),
    ).values(),
  ];
}

function profileName(
  profile:
    ProfileRow | null,
) {
  if (!profile) {
    return "Unknown administrator";
  }

  const name = [
    profile.first_name,
    profile.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    name ||
    profile.email ||
    "Administrator"
  );
}

function bookingName(
  booking:
    BookingRow | null,
) {
  if (!booking) {
    return "Unknown customer";
  }

  const name = [
    booking.first_name,
    booking.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    name ||
    booking.email ||
    "Unknown customer"
  );
}

function formatAddress(
  booking:
    BookingRow,
) {
  return [
    booking.street_address,
    booking.city,
    booking.state,
    booking.zip_code,
  ]
    .filter(Boolean)
    .join(", ");
}

function formatDate(
  value:
    string | null,
) {
  if (!value) {
    return "Not recorded";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone:
        "America/New_York",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    },
  ).format(date);
}

function humanize(
  value:
    string,
) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

function severityClass(
  severity:
    BookingExceptionSeverity,
) {
  return {
    urgent:
      styles.severityUrgent,
    warning:
      styles.severityWarning,
    info:
      styles.severityInfo,
  }[severity];
}

function statusClass(
  status:
    BookingExceptionStatus,
) {
  return {
    open:
      styles.statusOpen,
    acknowledged:
      styles.statusAcknowledged,
    resolved:
      styles.statusResolved,
    dismissed:
      styles.statusDismissed,
  }[status];
}

function severityBadgeClass(
  severity:
    BookingExceptionSeverity,
) {
  return {
    urgent:
      styles.badgeUrgent,
    warning:
      styles.badgeWarning,
    info:
      styles.badgeInfo,
  }[severity];
}

function statusBadgeClass(
  status:
    BookingExceptionStatus,
) {
  return {
    open:
      styles.badgeOpen,
    acknowledged:
      styles.badgeAcknowledged,
    resolved:
      styles.badgeResolved,
    dismissed:
      styles.badgeDismissed,
  }[status];
}
