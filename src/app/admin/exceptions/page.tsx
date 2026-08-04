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

  const allProfiles = [
    ...context.profiles,
    ...context.assignableProfiles,
  ];

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

  const historyCount =
    context.counts.resolved +
    context.counts.dismissed;

  return (
    <AdminShell
      title="Exceptions"
      auth={context.auth}
    >
      <section className="placeholder-panel exception-command-panel">
        <div className="admin-page-heading">
          <div>
            <p className="section-kicker">
              Human attention queue
            </p>

            <h1>
              Fix what the software could not.
            </h1>

            <p className="muted">
              Exceptions stay here until the
              underlying problem is repaired,
              dismissed with a reason, or fixed
              automatically by Clean Curb OS.
            </p>
          </div>

          <span
            className={
              context.counts.active
                ? "status-badge exception-active-count"
                : "status-badge"
            }
          >
            {context.counts.active} active
          </span>
        </div>

        {context.loadError ? (
          <div
            className="exception-load-warning"
            role="alert"
          >
            <strong>
              Exception data is incomplete.
            </strong>

            <p>
              {context.loadError} Actions are
              temporarily hidden so an incomplete
              screen cannot produce a bad decision.
            </p>
          </div>
        ) : null}

        <div className="exception-metric-grid">
          <Link
            className="exception-metric-card exception-metric-active"
            href="/admin/exceptions?status=active"
          >
            <span>Active work</span>
            <strong>
              {context.counts.active}
            </strong>
            <small>
              Open and acknowledged
            </small>
          </Link>

          <Link
            className="exception-metric-card exception-metric-open"
            href="/admin/exceptions?status=open"
          >
            <span>Unacknowledged</span>
            <strong>
              {context.counts.open}
            </strong>
            <small>
              Still waiting for review
            </small>
          </Link>

          <Link
            className="exception-metric-card exception-metric-acknowledged"
            href="/admin/exceptions?status=acknowledged"
          >
            <span>In somebody&apos;s hands</span>
            <strong>
              {context.counts.acknowledged}
            </strong>
            <small>
              Acknowledged, not closed
            </small>
          </Link>

          <Link
            className="exception-metric-card exception-metric-history"
            href="/admin/exceptions?status=resolved"
          >
            <span>Resolved</span>
            <strong>
              {context.counts.resolved}
            </strong>
            <small>
              Successfully handled
            </small>
          </Link>

          <Link
            className="exception-metric-card exception-metric-dismissed"
            href="/admin/exceptions?status=dismissed"
          >
            <span>Dismissed</span>
            <strong>
              {context.counts.dismissed}
            </strong>
            <small>
              Closed as non-actionable
            </small>
          </Link>
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
            searchPlaceholder="Customer, address, booking, error, request ID"
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
                      `All available (${context.counts.active + Math.min(historyCount, 250)})`,
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

        {statusFilter === "resolved" ||
        statusFilter === "dismissed" ||
        statusFilter === "all" ? (
          <p className="exception-history-note">
            Closed-history results are limited to
            the 250 most recently seen exceptions.
            The count cards still show exact
            lifetime totals.
          </p>
        ) : null}

        {exceptions.length ? (
          <div className="exception-list">
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

                const isActive =
                  exception.status ===
                    "open" ||
                  exception.status ===
                    "acknowledged";

                const currentAssigneeIsAssignable =
                  exception
                    .assigned_to_profile_id
                    ? context.assignableProfiles.some(
                        (profile) =>
                          profile.id ===
                          exception
                            .assigned_to_profile_id,
                      )
                    : true;

                const metadataAvailable =
                  Object.keys(
                    exception.metadata,
                  ).length > 0;

                return (
                  <details
                    className={[
                      "exception-card",
                      `exception-severity-${exception.severity}`,
                      `exception-status-${exception.status}`,
                    ].join(" ")}
                    key={
                      exception.id
                    }
                    open={
                      exception.severity ===
                        "urgent" &&
                      exception.status ===
                        "open"
                    }
                  >
                    <summary className="exception-card-summary">
                      <span className="exception-summary-main">
                        <span className="exception-badge-row">
                          <span
                            className={[
                              "exception-badge",
                              `exception-badge-severity-${exception.severity}`,
                            ].join(" ")}
                          >
                            {humanize(
                              exception.severity,
                            )}
                          </span>

                          <span
                            className={[
                              "exception-badge",
                              `exception-badge-status-${exception.status}`,
                            ].join(" ")}
                          >
                            {humanize(
                              exception.status,
                            )}
                          </span>

                          {exception.occurrence_count >
                          1 ? (
                            <span className="exception-badge exception-badge-occurrences">
                              {
                                exception.occurrence_count
                              }{" "}
                              occurrences
                            </span>
                          ) : null}
                        </span>

                        <strong>
                          {
                            exception.title
                          }
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

                      <span className="exception-summary-action">
                        Review
                      </span>
                    </summary>

                    <div className="exception-card-body">
                      <p className="exception-message">
                        {
                          exception.message
                        }
                      </p>

                      <div className="exception-record-grid">
                        <div className="exception-record">
                          <span>
                            Customer
                          </span>
                          <strong>
                            {booking
                              ? bookingName(
                                  booking,
                                )
                              : customer
                                ? profileName(
                                    customer,
                                  )
                                : "Unknown customer"}
                          </strong>
                          <small>
                            {booking?.email ??
                              customer?.email ??
                              "No email available"}
                          </small>
                          <small>
                            {booking?.phone ??
                              customer?.phone ??
                              "No phone available"}
                          </small>
                        </div>

                        <div className="exception-record">
                          <span>
                            Service address
                          </span>
                          <strong>
                            {booking
                              ? formatAddress(
                                  booking,
                                )
                              : "Address unavailable"}
                          </strong>
                          <small>
                            {booking?.neighborhood ??
                              "No neighborhood recorded"}
                          </small>
                        </div>

                        <div className="exception-record">
                          <span>
                            Assignment
                          </span>
                          <strong>
                            {assignee
                              ? profileName(
                                  assignee,
                                )
                              : "Unassigned"}
                          </strong>
                          <small>
                            {exception.status ===
                            "acknowledged"
                              ? "Acknowledged and active"
                              : humanize(
                                  exception.status,
                                )}
                          </small>
                        </div>

                        <div className="exception-record">
                          <span>
                            Problem
                          </span>
                          <strong>
                            {humanize(
                              exception.exception_type,
                            )}
                          </strong>
                          <small>
                            Source:{" "}
                            {humanize(
                              exception.source,
                            )}
                          </small>
                        </div>
                      </div>

                      <div className="exception-link-row">
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

                      <dl className="exception-lifecycle-grid">
                        <div>
                          <dt>
                            First seen
                          </dt>
                          <dd>
                            {formatDate(
                              exception.first_seen_at,
                            )}
                          </dd>
                        </div>

                        <div>
                          <dt>
                            Last seen
                          </dt>
                          <dd>
                            {formatDate(
                              exception.last_seen_at,
                            )}
                          </dd>
                        </div>

                        <div>
                          <dt>
                            Acknowledged
                          </dt>
                          <dd>
                            {exception.acknowledged_at
                              ? `${formatDate(
                                  exception.acknowledged_at,
                                )} by ${
                                  acknowledgedBy
                                    ? profileName(
                                        acknowledgedBy,
                                      )
                                    : "administrator"
                                }`
                              : "Not yet"}
                          </dd>
                        </div>

                        <div>
                          <dt>
                            Closed
                          </dt>
                          <dd>
                            {exception.resolved_at
                              ? `${formatDate(
                                  exception.resolved_at,
                                )} by ${
                                  resolvedBy
                                    ? profileName(
                                        resolvedBy,
                                      )
                                    : "administrator"
                                }`
                              : "Still active"}
                          </dd>
                        </div>
                      </dl>

                      {exception.resolution_note ? (
                        <div className="exception-resolution-note">
                          <strong>
                            Closure note
                          </strong>
                          <p>
                            {
                              exception.resolution_note
                            }
                          </p>
                        </div>
                      ) : null}

                      <details className="exception-technical-details">
                        <summary>
                          Technical details
                        </summary>

                        <div className="exception-technical-grid">
                          <div>
                            <span>
                              Exception ID
                            </span>
                            <code>
                              {
                                exception.id
                              }
                            </code>
                          </div>

                          <div>
                            <span>
                              Booking ID
                            </span>
                            <code>
                              {
                                exception.booking_id
                              }
                            </code>
                          </div>

                          <div>
                            <span>
                              Dedupe key
                            </span>
                            <code>
                              {
                                exception.dedupe_key
                              }
                            </code>
                          </div>

                          <div>
                            <span>
                              Request ID
                            </span>
                            <code>
                              {exception.request_id ??
                                "Not recorded"}
                            </code>
                          </div>

                          <div>
                            <span>
                              Source event
                            </span>
                            <code>
                              {exception.source_event_id ??
                                "Not linked"}
                            </code>
                          </div>
                        </div>

                        {metadataAvailable ? (
                          <pre className="exception-metadata">
                            {JSON.stringify(
                              exception.metadata,
                              null,
                              2,
                            )}
                          </pre>
                        ) : (
                          <p className="muted">
                            No additional metadata
                            was recorded.
                          </p>
                        )}
                      </details>

                      {context.loadError ? (
                        <div className="exception-action-blocked">
                          Actions are unavailable
                          until the exception data
                          loads completely.
                        </div>
                      ) : isActive ? (
                        <div className="exception-action-grid">
                          {exception.status ===
                          "open" ? (
                            <section className="exception-action-panel">
                              <h3>
                                Acknowledge
                              </h3>
                              <p>
                                Mark that somebody
                                has reviewed the
                                problem without
                                closing it.
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
                                  value={
                                    exception.id
                                  }
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

                          <section className="exception-action-panel">
                            <h3>
                              Assignment
                            </h3>
                            <p>
                              Put the problem in
                              somebody&apos;s hands
                              or return it to the
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
                                value={
                                  exception.id
                                }
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
                                        exception.assigned_to_profile_id
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

                                  {context.assignableProfiles.map(
                                    (
                                      profile,
                                    ) => (
                                      <option
                                        value={
                                          profile.id
                                        }
                                        key={
                                          profile.id
                                        }
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

                          <section className="exception-action-panel exception-close-panel">
                            <h3>
                              Close exception
                            </h3>
                            <p>
                              Resolve a repaired
                              problem or dismiss a
                              record that does not
                              require action. The
                              note becomes permanent
                              history.
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
                                value={
                                  exception.id
                                }
                              />

                              <label className="field">
                                <span>
                                  Resolution or
                                  dismissal note
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

                              <div className="exception-close-buttons">
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
                      ) : (
                        <section className="exception-reopen-panel">
                          <div>
                            <h3>
                              Reopen this exception
                            </h3>
                            <p>
                              Use this when the
                              problem still requires
                              human attention or was
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
                              value={
                                exception.id
                              }
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
                      )}
                    </div>
                  </details>
                );
              },
            )}
          </div>
        ) : (
          <div className="exception-empty-state">
            <strong>
              No exceptions match this view.
            </strong>

            <p>
              That either means the software is
              behaving itself, or your filters are
              hiding the garbage fire.
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

function getExceptionPool(
  activeExceptions:
    BookingExceptionRow[],
  historyExceptions:
    BookingExceptionRow[],
  status:
    ExceptionStatusFilter,
) {
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
  ).format(
    new Date(value),
  );
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
