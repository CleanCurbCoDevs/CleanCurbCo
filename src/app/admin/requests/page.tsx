import type { Metadata } from "next";
import Link from "next/link";
import {
  updateAccountDeletionRequestAdminAction,
  updateCustomerRequestAdminAction,
} from "@/app/admin/actions";
import {
  ActionSubmitButton,
  FeedbackForm,
} from "@/components/action-feedback";
import { AdminFilterBar } from "@/components/admin-filter-bar";
import { AdminShell } from "@/components/shells/admin-shell";
import {
  humanizeStatus,
  validBookingStatuses,
  validCustomerRequestStatuses,
  validPaymentStatuses,
  validRequestTypes,
} from "@/lib/booking-utils";
import { getAdminContext } from "@/lib/admin-data";
import { fullName, includesSearch, uniqueValues } from "@/lib/admin-operations";
import {
  policyWindowLabels,
  requestTypeLabels,
} from "@/lib/service-policy";
import type {
  BookingRow,
  AccountDeletionRequestRow,
  CustomerRequestRow,
  ProfileRow,
  ServiceAddressRow,
} from "@/types/database";

export const metadata: Metadata = {
  title: "Admin Requests",
};

type AdminRequestsPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

const dateOptions = [
  { label: "Any date", value: "" },
  { label: "Created this week", value: "week" },
  { label: "Created this month", value: "month" },
  { label: "Within 24 hours", value: "within_24_hours" },
  { label: "Within 48 hours", value: "within_48_hours" },
];

const policyOptions = [
  { label: "Any policy window", value: "" },
  { label: policyWindowLabels.standard, value: "standard" },
  { label: policyWindowLabels.within_48_hours, value: "within_48_hours" },
  { label: policyWindowLabels.within_24_hours, value: "within_24_hours" },
];

const acknowledgmentOptions = [
  { label: "Any customer acknowledgement", value: "" },
  { label: "Y - Customer acknowledged", value: "y" },
  { label: "N - Required but missing", value: "n" },
  { label: "N/A - Not required", value: "na" },
];

const requestViewOptions = [
  { label: "Active queue", value: "" },
  { label: "Archived", value: "archived" },
  { label: "All requests", value: "all" },
];

const archivedCustomerRequestStatuses = ["completed", "denied", "cancelled"];

const archivedDeletionRequestStatuses = ["completed", "declined", "cancelled"];

const needsOptions = [
  { label: "Any request need", value: "" },
  { label: "Needs review", value: "needs_review" },
  { label: "Policy risk", value: "policy_risk" },
];

export default async function AdminRequestsPage({
  searchParams,
}: AdminRequestsPageProps) {
  const params = await searchParams;
  const context = await getAdminContext("/admin/requests");

  const requests = filterRequests(
    context.requests,
    context.profiles,
    context.bookings,
    context.addresses,
    params,
  );

  const deletionRequests = filterDeletionRequests(
    context.deletionRequests,
    context.profiles,
    params,
  );

  const routeDayOptions = getRouteDayOptions(context.requests, context.bookings);
  const stats = getRequestStats(context.requests, context.deletionRequests);

  return (
    <AdminShell title="Requests" auth={context.auth}>
      <section className="placeholder-panel admin-command-panel">
        <div className="admin-page-heading">
          <div>
            <p className="section-kicker">Customer Requests</p>
            <h1>{params.view === "archived" ? "Archived requests." : "Request queue."}</h1>
            <p className="muted">
              {params.view === "archived"
                ? "Completed, denied, cancelled, and closed requests are preserved here for history."
                : "Review active customer service changes, policy timing, payment impact, and account deletion requests."}
            </p>
          </div>

          <div className="status-stack">
            <span className="status-badge">{context.requests.length} service</span>
            <span className="status-badge">
              {context.deletionRequests.length} deletion
            </span>
          </div>
        </div>

        <div className="admin-command-grid">
          <DashboardStat
            label="Needs review"
            value={stats.needsReview}
            href="/admin/requests?needs=needs_review"
          />

          <DashboardStat
            label="Policy risk"
            value={stats.policyRisk}
            href="/admin/requests?needs=policy_risk"
          />

          <CustomerAcknowledgementCard
            yes={stats.customerAcknowledgement.y}
            no={stats.customerAcknowledgement.n}
            notApplicable={stats.customerAcknowledgement.na}
          />

          <DashboardStat
            label="Deletion requests"
            value={stats.deletionRequests}
            href="/admin/requests#account-deletions"
          />
        </div>

        <nav className="status-tabs" aria-label="Request quick filters">
          <Link href="/admin/requests">Active queue</Link>
          <Link href="/admin/requests?needs=needs_review">Needs review</Link>
          <Link href="/admin/requests?needs=policy_risk">Policy risk</Link>
          <Link href="/admin/requests?needs=not_acknowledged">
            Not acknowledged
          </Link>
          <Link href="/admin/requests?status=approved">Approved</Link>
          <Link href="/admin/requests?view=archived">Archived</Link>
          <Link href="/admin/requests?view=all">All</Link>
        </nav>

        <AdminFilterBar
          searchValue={params.q}
          searchPlaceholder="Customer, email, request message, booking ID"
          resultCount={requests.length}
          resetHref="/admin/requests"
          selects={[
            {
              name: "view",
              label: "View",
              value: params.view,
              options: requestViewOptions,
            },
            {
              name: "needs",
              label: "Needs action",
              value: params.needs,
              options: needsOptions,
            },
            {
              name: "status",
              label: "Status",
              value: params.status,
              options: [
                { label: "Any status", value: "" },
                ...validCustomerRequestStatuses.map((status) => ({
                  label: humanizeStatus(status),
                  value: status,
                })),
              ],
            },
            {
              name: "type",
              label: "Request type",
              value: params.type,
              options: [
                { label: "Any request type", value: "" },
                ...validRequestTypes.map((type) => ({
                  label: requestTypeLabels[type] ?? humanizeStatus(type),
                  value: type,
                })),
              ],
            },
            {
              name: "policy",
              label: "Policy window",
              value: params.policy,
              options: policyOptions,
            },
            {
              name: "ack",
              label: "Acknowledgment",
              value: params.ack,
              options: acknowledgmentOptions,
            },
            {
              name: "neighborhood",
              label: "Neighborhood",
              value: params.neighborhood,
              options: [
                { label: "Any neighborhood", value: "" },
                ...uniqueValues(
                  context.addresses.map((address) => address.neighborhood),
                ).map((neighborhood) => ({
                  label: neighborhood,
                  value: neighborhood,
                })),
              ],
            },
            {
              name: "routeDay",
              label: "Route day",
              value: params.routeDay,
              options: [{ label: "Any route day", value: "" }, ...routeDayOptions],
            },
            {
              name: "date",
              label: "Date",
              value: params.date,
              options: dateOptions,
            },
          ]}
        />

        <section id="account-deletions" className="request-section">
          <div className="admin-page-heading">
            <div>
              <p className="section-kicker">Account Deletions</p>
              <h2>Account deletion queue.</h2>
              <p className="muted">
                Keep these separate from service-change requests because they affect
                portal access and data retention.
              </p>
            </div>
            <span className="status-badge">{deletionRequests.length} shown</span>
          </div>

          {deletionRequests.length ? (
            <div className="admin-queue-list">
              {deletionRequests.map((request) => {
                const profile = context.profiles.find(
                  (item) => item.id === request.customer_id,
                );
                const customerLabel = profile
                  ? fullName(profile)
                  : "Unlinked customer";
                const email = profile?.email ?? request.customer_email ?? "No email";

                return (
                  <details className="admin-queue-card" key={request.id}>
                    <summary className="admin-queue-summary">
                      <div className="admin-queue-main">
                        <span className="needs-dot needs-dot-danger" />
                        <div>
                          <h2>Account deletion</h2>
                          <p>
                            {customerLabel} | {email}
                          </p>
                        </div>
                      </div>

                      <div className="admin-queue-meta">
                        <span className={`status-badge status-${request.status}`}>
                          {humanizeStatus(request.status)}
                        </span>
                        <span className="status-badge">
                          Requested {formatDateTime(request.created_at)}
                        </span>
                      </div>

                      <div className="admin-queue-next">
                        <strong>{getDeletionNextAction(request)}</strong>
                        <span>Open</span>
                      </div>
                    </summary>

                    <div className="admin-queue-detail">
                      <div className="admin-record-overview">
                        <InfoTile label="Customer" value={customerLabel} />
                        <InfoTile label="Email" value={email} />
                        <InfoTile label="Status" value={humanizeStatus(request.status)} />
                        <InfoTile
                          label="Requested"
                          value={formatDateTime(request.created_at)}
                        />
                        <InfoTile
                          label="Reason"
                          value={request.request_reason ?? "No reason provided."}
                        />
                      </div>

                      <div className="admin-detail-layout">
                        <section className="detail-panel">
                          <h2>Review deletion request</h2>

                          <FeedbackForm
                            action={updateAccountDeletionRequestAdminAction}
                            className="compact-admin-form"
                            pendingMessage="Saving deletion decision..."
                            successMessage="Deletion decision saved."
                          >
                            <input
                              type="hidden"
                              name="deletionRequestId"
                              value={request.id}
                            />

                            <div className="form-grid">
                              <label className="field">
                                <span>Selected deletion decision</span>
                                <select name="status" defaultValue={request.status}>
                                  {[
                                    "pending",
                                    "approved",
                                    "declined",
                                    "cancelled",
                                    "completed",
                                  ].map((status) => (
                                    <option value={status} key={status}>
                                      {humanizeStatus(status)}
                                    </option>
                                  ))}
                                </select>
                                  <small className="field-help">
                                    Customers are emailed automatically when this changes to Approved, Declined,
                                    Completed, or Cancelled. No text messages are sent.
                                  </small>
                              </label>

                              <label className="choice-card">
                                <input
                                  type="checkbox"
                                  name="disablePortalAccess"
                                  defaultChecked={
                                    request.status === "approved" ||
                                    request.status === "completed"
                                  }
                                />
                                <span>Disable portal access as part of this action</span>
                              </label>
                            </div>

                            <label className="field">
                              <span>Internal admin note</span>
                              <textarea
                                name="adminNote"
                                defaultValue={request.admin_note ?? ""}
                                required
                              />
                            </label>

                            <label className="field">
                              <span>Customer-facing message</span>
                              <textarea
                                name="customerVisibleAdminMessage"
                                defaultValue={
                                  request.customer_visible_admin_message ?? ""
                                }
                                placeholder="Shown in the customer email."
                              />
                            </label>

                            <div className="admin-action-cluster">
                              <ActionSubmitButton pendingLabel="Saving decision...">
                                Save Decision + Edits
                              </ActionSubmitButton>
                            </div>
                          </FeedbackForm>
                        </section>

                        <section className="detail-panel">
                          <h2>Related records</h2>
                          <div className="admin-secondary-links">
                            {profile ? (
                              <Link
                                className="button button-outline"
                                href={`/admin/customers/${profile.id}`}
                              >
                                Open Customer
                              </Link>
                            ) : null}
                          </div>
                        </section>
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          ) : (
            <div className="empty-state-card">
              <h2>No account deletion requests match this view.</h2>
              <p>Deletion requests will appear here when customers submit them.</p>
            </div>
          )}
        </section>

        <section className="request-section">
          <div className="admin-page-heading">
            <div>
              <p className="section-kicker">Service Changes</p>
              <h2>Service request queue.</h2>
            </div>
            <span className="status-badge">{requests.length} shown</span>
          </div>

          {requests.length ? (
            <div className="admin-queue-list">
              {requests.map((request) => {
                const profile = context.profiles.find(
                  (item) => item.id === request.customer_id,
                );
                const booking = context.bookings.find(
                  (item) => item.id === request.booking_id,
                );
                const address = context.addresses.find(
                  (item) => item.customer_id === request.customer_id,
                );
                const scheduledDate = getScheduledDate(request, booking);
                const nextAction = getRequestNextAction(request);
                const approvalImpact = getApprovalImpactSummary(request, booking);
                const customerLabel = profile
                  ? fullName(profile)
                  : "Unlinked customer";
                const email = profile?.email ?? booking?.email ?? "No email";
                const neighborhood =
                  address?.neighborhood ??
                  booking?.neighborhood ??
                  "Neighborhood pending";

                return (
                  <details className="admin-queue-card" key={request.id}>
                    <summary className="admin-queue-summary">
                      <div className="admin-queue-main">
                        <span className={`needs-dot needs-dot-${nextAction.tone}`} />
                        <div>
                          <h2>{requestTypeLabels[request.request_type]}</h2>
                          <p>
                            {customerLabel} | {neighborhood}
                          </p>
                        </div>
                      </div>

                      <div className="admin-queue-meta">
                        <span className={`status-badge status-${request.status}`}>
                          {humanizeStatus(request.status)}
                        </span>
                        <span
                          className={`status-badge status-${request.policy_window}`}
                        >
                          {policyWindowLabels[request.policy_window]}
                        </span>
                        {request.cancellation_fee !== null ? (
                          <span className="status-badge status-fee_may_apply">
                            Fee may apply
                          </span>
                        ) : null}
                        {request.full_charge_applies ? (
                          <span className="status-badge status-full_charge_may_apply">
                            Full charge may apply
                          </span>
                        ) : null}
                      </div>

                      <div className="admin-queue-next">
                        <strong>{nextAction.label}</strong>
                        <span>Open</span>
                      </div>
                    </summary>

                    <div className="admin-queue-detail">
                      <div className="admin-record-overview">
                        <InfoTile label="Customer" value={customerLabel} />
                        <InfoTile label="Email" value={email} />
                        <InfoTile
                          label="Request type"
                          value={requestTypeLabels[request.request_type]}
                        />
                        <InfoTile
                          label="Scheduled date"
                          value={scheduledDate ?? "Not scheduled"}
                        />
                        <InfoTile
                          label="Policy window"
                          value={policyWindowLabels[request.policy_window]}
                        />
                        <InfoTile
                          label="Customer acknowledgement"
                          value={formatCustomerAcknowledgement(request)}
                        />
                        <InfoTile
                          label="Original estimate"
                          value={
                            request.original_estimated_price === null
                              ? "Not recorded"
                              : `$${request.original_estimated_price}`
                          }
                        />
                        <InfoTile
                          label="Cancellation fee"
                          value={
                            request.cancellation_fee === null
                              ? "None"
                              : `$${request.cancellation_fee}`
                          }
                        />
                      </div>

                      <div className="request-change-summary">
                        <h3>Requested change</h3>

                        <div className="admin-record-overview">
                          <InfoTile
                            label="Current frequency"
                            value={booking ? humanizeStatus(booking.frequency) : "No linked booking"}
                          />
                          <InfoTile
                            label="Requested frequency"
                            value={
                              request.requested_frequency
                                ? humanizeStatus(request.requested_frequency)
                                : "None"
                            }
                          />
                          <InfoTile
                            label="Requested route day"
                            value={request.requested_route_day ?? "None"}
                          />
                          <InfoTile
                            label="Add services"
                            value={formatList(request.requested_add_ons)}
                          />
                          <InfoTile
                            label="Drop services"
                            value={formatList(request.requested_removed_add_ons)}
                          />
                          <InfoTile
                            label="Current estimate"
                            value={booking ? `$${booking.estimated_price}` : "No linked booking"}
                          />
                        </div>

                        <div className="request-approval-impact">
                          <strong>What approval will do</strong>
                          <p>{approvalImpact}</p>
                        </div>

                        <p className="muted">
                          {request.message ?? "No customer message."}
                        </p>
                      </div>

                      <div className="admin-detail-layout">
                        <section className="detail-panel">
                          <h2>Review request</h2>

                          <FeedbackForm
                            action={updateCustomerRequestAdminAction}
                            className="compact-admin-form"
                            pendingMessage="Saving request decision..."
                            successMessage="Request decision saved."
                          >
                            <input type="hidden" name="requestId" value={request.id} />

                            <div className="form-grid">
                              <label className="field">
                                <span>Selected decision</span>
                                <select name="status" defaultValue={request.status}>
                                  {validCustomerRequestStatuses.map((status) => (
                                    <option value={status} key={status}>
                                      {humanizeStatus(status)}
                                    </option>
                                  ))}
                                </select>
                                  <small className="field-help">
                                    Approved or Completed will apply the requested service change to the linked
                                    booking automatically and email the customer. Denied or Cancelled will email
                                    the decision without changing the booking. No text messages are sent.
                                  </small>
                              </label>

                              {booking ? (
                                <>
                                  <label className="field">
                                    <span>Booking status</span>
                                    <select
                                      name="bookingStatus"
                                      defaultValue={booking.status}
                                    >
                                      <option value="">No booking change</option>
                                      {validBookingStatuses.map((status) => (
                                        <option value={status} key={status}>
                                          {humanizeStatus(status)}
                                        </option>
                                      ))}
                                    </select>
                                  </label>

                                  <label className="field">
                                    <span>Payment status</span>
                                    <select
                                      name="paymentStatus"
                                      defaultValue={booking.payment_status}
                                    >
                                      <option value="">No payment change</option>
                                      {validPaymentStatuses.map((status) => (
                                        <option value={status} key={status}>
                                          {humanizeStatus(status)}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                </>
                              ) : null}
                            </div>

                            <label className="field">
                              <span>Admin notes</span>
                              <textarea
                                name="adminNotes"
                                defaultValue={request.admin_notes ?? ""}
                              />
                            </label>

                            <label className="field">
                              <span>Customer-facing message</span>
                              <textarea
                                name="customerVisibleAdminMessage"
                                defaultValue={
                                  request.customer_visible_admin_message ?? ""
                                }
                                placeholder="Optional message included in customer updates."
                              />
                            </label>

                            <div className="admin-action-cluster">
                              <ActionSubmitButton pendingLabel="Saving decision...">
                                Save Decision + Apply Changes
                              </ActionSubmitButton>
                            </div>
                          </FeedbackForm>
                        </section>

                        <section className="detail-panel">
                          <h2>Related records</h2>
                          <div className="admin-secondary-links">
                            {profile ? (
                              <Link
                                className="button button-outline"
                                href={`/admin/customers/${profile.id}`}
                              >
                                Open Customer
                              </Link>
                            ) : null}

                            {booking ? (
                              <Link
                                className="button button-outline"
                                href={`/admin/bookings?q=${booking.id}`}
                              >
                                Open Booking
                              </Link>
                            ) : null}
                          </div>

                          <details className="technical-details">
                            <summary>Technical details</summary>
                            <div className="admin-data-grid">
                              <InfoTile label="Request ID" value={request.id} />
                              <InfoTile
                                label="Booking ID"
                                value={request.booking_id ?? "None"}
                              />
                              <InfoTile
                                label="Created"
                                value={formatDateTime(request.created_at)}
                              />
                            </div>
                          </details>
                        </section>
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          ) : (
            <div className="empty-state-card">
              <h2>No customer requests match this view.</h2>
              <p>Try clearing filters or checking another request status.</p>
            </div>
          )}
        </section>
      </section>
    </AdminShell>
  );
}

function DashboardStat({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link className="admin-command-card" href={href}>
      <span>{label}</span>
      <strong>{value}</strong>
    </Link>
  );
}

function CustomerAcknowledgementCard({
  yes,
  no,
  notApplicable,
}: {
  yes: number;
  no: number;
  notApplicable: number;
}) {
  return (
    <article className="admin-command-card customer-ack-card">
      <span className="customer-ack-title">Customer Acknowledgement</span>

      <div className="customer-ack-grid">
        <Link
          href="/admin/requests?ack=y"
          className="customer-ack-pill customer-ack-pill-yes"
        >
          <small>Y</small>
          <strong>{yes}</strong>
          <span>Acknowledged</span>
        </Link>

        <Link
          href="/admin/requests?ack=n"
          className="customer-ack-pill customer-ack-pill-no"
        >
          <small>N</small>
          <strong>{no}</strong>
          <span>Missing</span>
        </Link>

        <Link
          href="/admin/requests?ack=na"
          className="customer-ack-pill customer-ack-pill-na"
        >
          <small>N/A</small>
          <strong>{notApplicable}</strong>
          <span>Not needed</span>
        </Link>
      </div>
    </article>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getRequestStats(
  requests: CustomerRequestRow[],
  deletionRequests: AccountDeletionRequestRow[],
) {
  const customerAcknowledgement = getCustomerAcknowledgementStats(requests);

  return {
    needsReview: requests.filter((request) =>
      ["new", "reviewing"].includes(request.status),
    ).length,
    policyRisk: requests.filter(
      (request) =>
        request.policy_window === "within_24_hours" ||
        request.policy_window === "within_48_hours" ||
        request.full_charge_applies ||
        request.cancellation_fee !== null,
    ).length,
    customerAcknowledgement,
    deletionRequests: deletionRequests.length,
  };
}

function getRequestNextAction(request: CustomerRequestRow) {
  if (request.status === "new") {
    return { label: "Review request", tone: "warning" as const };
  }

  if (request.status === "reviewing") {
    return { label: "Finish review", tone: "warning" as const };
  }

  if (
    request.policy_window === "within_24_hours" ||
    request.full_charge_applies ||
    request.cancellation_fee !== null
  ) {
    return { label: "Check policy impact", tone: "danger" as const };
  }

  if (!request.policy_acknowledged) {
    return { label: "Missing acknowledgment", tone: "danger" as const };
  }

  if (request.status === "approved") {
    return { label: "Complete request", tone: "warning" as const };
  }

  if (request.status === "completed") {
    return { label: "Completed", tone: "good" as const };
  }

  if (request.status === "denied") {
    return { label: "Denied", tone: "neutral" as const };
  }

  return { label: "Review", tone: "warning" as const };
}

function getDeletionNextAction(request: AccountDeletionRequestRow) {
  if (request.status === "pending") return "Review deletion";
  if (request.status === "approved") return "Complete deletion";
  if (request.status === "completed") return "Completed";
  if (request.status === "declined") return "Declined";
  if (request.status === "cancelled") return "Cancelled";
  return "Review";
}

function filterDeletionRequests(
  requests: AccountDeletionRequestRow[],
  profiles: ProfileRow[],
  params: Record<string, string | undefined>,
) {
  const query = params.q?.trim() ?? "";
  const view = params.view ?? "";

  return requests
    .filter((request) => {
      const archived = archivedDeletionRequestStatuses.includes(request.status);

      if (view === "archived") return archived;
      if (view === "all") return true;

      return !archived;
    })
    .filter((request) => {
      const profile = profiles.find((item) => item.id === request.customer_id);
      return includesSearch(
        [
          profile ? fullName(profile) : "",
          profile?.email,
          request.customer_email,
          request.request_reason,
          request.id,
        ],
        query,
      );
    })
    .sort((a, b) => {
      const priorityDifference =
        getDeletionPriority(a) - getDeletionPriority(b);
      if (priorityDifference !== 0) return priorityDifference;
      return b.created_at.localeCompare(a.created_at);
    });
}

function getDeletionPriority(request: AccountDeletionRequestRow) {
  if (request.status === "pending") return 10;
  if (request.status === "approved") return 20;
  if (request.status === "declined") return 80;
  if (request.status === "cancelled") return 90;
  if (request.status === "completed") return 100;
  return 50;
}

function filterRequests(
  requests: CustomerRequestRow[],
  profiles: ProfileRow[],
  bookings: BookingRow[],
  addresses: ServiceAddressRow[],
  params: Record<string, string | undefined>,
) {
  const query = params.q?.trim() ?? "";
  const view = params.view ?? "";
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  return requests
    .filter((request) => {
      const archived = archivedCustomerRequestStatuses.includes(request.status);

      if (view === "archived") return archived;
      if (view === "all") return true;

      return !archived;
    })
    .filter((request) => {
      const profile = profiles.find((item) => item.id === request.customer_id);
      const booking = bookings.find((item) => item.id === request.booking_id);

      return includesSearch(
        [
          profile ? fullName(profile) : "",
          profile?.email,
          profile?.phone,
          booking?.email,
          request.message,
          request.id,
          request.booking_id,
          request.policy_acknowledged_name,
        ],
        query,
      );
    })
    .filter((request) => {
      if (params.needs === "needs_review") {
        return ["new", "reviewing"].includes(request.status);
      }

      if (params.needs === "policy_risk") {
        return (
          request.policy_window === "within_24_hours" ||
          request.policy_window === "within_48_hours" ||
          request.full_charge_applies ||
          request.cancellation_fee !== null
        );
      }

      return true;
    })
    .filter((request) => !params.status || request.status === params.status)
    .filter((request) => !params.type || request.request_type === params.type)
    .filter((request) => !params.policy || request.policy_window === params.policy)
    .filter((request) => {
      if (!params.ack) return true;
      return getCustomerAcknowledgementState(request) === params.ack;
    })
    .filter((request) => {
      if (!params.neighborhood) return true;
      const address = addresses.find((item) => item.customer_id === request.customer_id);
      const booking = bookings.find((item) => item.id === request.booking_id);
      return (
        address?.neighborhood === params.neighborhood ||
        booking?.neighborhood === params.neighborhood
      );
    })
    .filter((request) => {
      if (!params.routeDay) return true;
      const booking = bookings.find((item) => item.id === request.booking_id);
      return getScheduledDate(request, booking) === params.routeDay;
    })
    .filter((request) => {
      if (params.date === "week") return new Date(request.created_at) >= weekAgo;
      if (params.date === "month") return new Date(request.created_at) >= monthStart;
      if (params.date === "within_24_hours") {
        return request.policy_window === "within_24_hours";
      }
      if (params.date === "within_48_hours") {
        return ["within_48_hours", "within_24_hours"].includes(request.policy_window);
      }
      return true;
    })
    .sort((a, b) => {
      const priorityDifference = getRequestPriority(a) - getRequestPriority(b);
      if (priorityDifference !== 0) return priorityDifference;
      return b.created_at.localeCompare(a.created_at);
    });
}

function getRequestPriority(request: CustomerRequestRow) {
  if (request.status === "new") return 10;
  if (request.status === "reviewing") return 20;

  if (
    request.policy_window === "within_24_hours" ||
    request.full_charge_applies ||
    request.cancellation_fee !== null
  ) {
    return 30;
  }

  if (!request.policy_acknowledged) return 40;
  if (request.status === "approved") return 50;
  if (request.status === "completed") return 90;
  if (request.status === "denied") return 100;

  return 70;
}

function getCustomerAcknowledgementStats(requests: CustomerRequestRow[]) {
  return requests.reduce(
    (totals, request) => {
      const state = getCustomerAcknowledgementState(request);
      totals[state] += 1;
      return totals;
    },
    { y: 0, n: 0, na: 0 },
  );
}

function getCustomerAcknowledgementState(request: CustomerRequestRow): "y" | "n" | "na" {
  if (request.policy_acknowledged) return "y";

  if (customerAcknowledgementRequired(request)) return "n";

  return "na";
}

function customerAcknowledgementRequired(request: CustomerRequestRow) {
  return (
    request.policy_window === "within_24_hours" ||
    request.policy_window === "within_48_hours" ||
    request.full_charge_applies ||
    request.cancellation_fee !== null
  );
}

function formatCustomerAcknowledgement(request: CustomerRequestRow) {
  const state = getCustomerAcknowledgementState(request);

  if (state === "y") {
    return request.policy_acknowledged_name
      ? `Y - ${request.policy_acknowledged_name}`
      : "Y - Completed";
  }

  if (state === "n") {
    return "N - Required but missing";
  }

  return "N/A - Not required";
}

function getRouteDayOptions(requests: CustomerRequestRow[], bookings: BookingRow[]) {
  return uniqueValues(
    requests.map((request) => {
      const booking = bookings.find((item) => item.id === request.booking_id);
      return getScheduledDate(request, booking);
    }),
  ).map((routeDay) => ({ label: routeDay, value: routeDay }));
}

function getScheduledDate(request: CustomerRequestRow, booking?: BookingRow) {
  return (
    booking?.confirmed_route_day ??
    request.requested_route_day ??
    booking?.requested_date ??
    null
  );
}

function getApprovalImpactSummary(
  request: CustomerRequestRow,
  booking?: BookingRow,
) {
  if (!booking) {
    return "No linked booking was found. Approval will save the request decision, but an admin should manually review the customer record before making service changes.";
  }

  if (request.request_type === "change_frequency") {
    if (!request.requested_frequency) {
      return "This is a frequency change request, but no requested frequency was recorded. Review before approving.";
    }

    return `Approving this changes the linked booking from ${humanizeStatus(
      booking.frequency,
    )} to ${humanizeStatus(
      request.requested_frequency,
    )} and recalculates the estimated price.`;
  }

  if (request.request_type === "reschedule_service") {
    if (!request.requested_route_day) {
      return "This is a reschedule request, but no requested route day was recorded. Review before approving.";
    }

    return `Approving this clears the confirmed route day, sets the requested route day to ${request.requested_route_day}, and moves the booking back into follow-up for routing.`;
  }

  if (request.request_type === "cancel_service") {
    return "Approving this cancels the linked booking. If the request is inside the late-change window, review the payment/fee policy before saving.";
  }

  if (request.request_type === "pause_service") {
    return "Approving this moves the booking into follow-up so the pause can be handled operationally without deleting the booking.";
  }

  if (request.request_type === "add_service") {
    return `Approving this adds the requested service add-ons to the linked booking and recalculates the estimated price. Requested add-ons: ${formatList(
      request.requested_add_ons,
    )}.`;
  }

  if (request.request_type === "drop_service") {
    return `Approving this removes the requested service add-ons from the linked booking and recalculates the estimated price. Requested removals: ${formatList(
      request.requested_removed_add_ons,
    )}.`;
  }

  return "Approving this saves the customer request decision. Review the customer-facing message before saving.";
}

function formatList(values: string[] | null) {
  return values?.length ? values.map(humanizeStatus).join(", ") : "None";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}