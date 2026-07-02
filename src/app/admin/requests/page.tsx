import type { Metadata } from "next";
import Link from "next/link";
import {
  updateAccountDeletionRequestAdminAction,
  updateCustomerRequestAdminAction,
} from "@/app/admin/actions";
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
  { label: "Any acknowledgment", value: "" },
  { label: "Acknowledged", value: "acknowledged" },
  { label: "Not acknowledged", value: "not_acknowledged" },
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

  return (
    <AdminShell title="Requests" auth={context.auth}>
      <section className="placeholder-panel">
        <div className="admin-page-heading">
          <div>
            <p className="section-kicker">Customer Requests</p>
            <h1>Review service changes before they happen.</h1>
            <p className="muted">
              Timing windows, typed acknowledgments, original prices, and
              possible charges are preserved here.
            </p>
          </div>
          <div className="status-stack">
            <span className="status-badge">{context.requests.length} service</span>
            <span className="status-badge">
              {context.deletionRequests.length} deletion
            </span>
          </div>
        </div>

        <AdminFilterBar
          searchValue={params.q}
          searchPlaceholder="Customer, email, request message, booking ID"
          resultCount={requests.length}
          resetHref="/admin/requests"
          selects={[
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
                ...uniqueValues(context.addresses.map((address) => address.neighborhood)).map(
                  (neighborhood) => ({ label: neighborhood, value: neighborhood }),
                ),
              ],
            },
            {
              name: "routeDay",
              label: "Route day",
              value: params.routeDay,
              options: [{ label: "Any route day", value: "" }, ...routeDayOptions],
            },
            { name: "date", label: "Date", value: params.date, options: dateOptions },
          ]}
        />

        <section className="form-section">
          <div className="admin-page-heading">
            <div>
              <h2>Account deletion requests</h2>
              <p className="muted">
                Review, disable portal access, and preserve operational records
                before marking a deletion request complete.
              </p>
            </div>
            <span className="status-badge">{deletionRequests.length} shown</span>
          </div>

          {deletionRequests.length ? (
            <div className="admin-card-list">
              {deletionRequests.map((request) => {
                const profile = context.profiles.find(
                  (item) => item.id === request.customer_id,
                );

                return (
                  <form
                    action={updateAccountDeletionRequestAdminAction}
                    className="admin-edit-card"
                    key={request.id}
                  >
                    <input
                      type="hidden"
                      name="deletionRequestId"
                      value={request.id}
                    />
                    <div className="admin-row-heading">
                      <div>
                        <h2>Account deletion</h2>
                        <p className="muted">
                          {profile ? fullName(profile) : "Unlinked customer"} |{" "}
                          {profile?.email ?? request.customer_email ?? "No email"}
                        </p>
                        <p className="muted">
                          Requested {formatDateTime(request.created_at)}
                        </p>
                      </div>
                      <span className={`status-badge status-${request.status}`}>
                        {humanizeStatus(request.status)}
                      </span>
                    </div>
                    <p className="muted">
                      Reason: {request.request_reason ?? "No reason provided."}
                    </p>
                    <div className="form-grid">
                      <label className="field">
                        <span>Deletion request status</span>
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
                        defaultValue={request.customer_visible_admin_message ?? ""}
                        placeholder="Shown in the customer email."
                      />
                    </label>
                    <div className="action-row">
                      <button className="button button-dark" type="submit">
                        Save Deletion Review
                      </button>
                      {["approved", "declined", "completed"].map((status) => (
                        <button
                          className="button button-outline"
                          key={status}
                          name="status"
                          type="submit"
                          value={status}
                        >
                          Mark {humanizeStatus(status)}
                        </button>
                      ))}
                      {profile ? (
                        <Link
                          className="button button-outline"
                          href={`/admin/customers/${profile.id}`}
                        >
                          Open Customer
                        </Link>
                      ) : null}
                    </div>
                  </form>
                );
              })}
            </div>
          ) : (
            <p className="muted">No account deletion requests match those filters.</p>
          )}
        </section>

        {requests.length ? (
          <div className="admin-card-list">
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

              return (
                <form
                  action={updateCustomerRequestAdminAction}
                  className="admin-edit-card"
                  key={request.id}
                >
                  <input type="hidden" name="requestId" value={request.id} />
                  <div className="admin-row-heading">
                    <div>
                      <h2>{requestTypeLabels[request.request_type]}</h2>
                      <p className="muted">
                        {profile ? fullName(profile) : "Unlinked customer"} |{" "}
                        {profile?.email ?? booking?.email ?? "No email"}
                      </p>
                      <p className="muted">
                        {address?.neighborhood ??
                          booking?.neighborhood ??
                          "Neighborhood pending"}
                      </p>
                    </div>
                    <div className="status-stack">
                      <span className={`status-badge status-${request.status}`}>
                        {humanizeStatus(request.status)}
                      </span>
                      <span className={`status-badge status-${request.policy_window}`}>
                        {policyWindowLabels[request.policy_window]}
                      </span>
                      {request.cancellation_fee !== null ? (
                        <span className="status-badge status-fee_may_apply">
                          Cancellation Fee May Apply
                        </span>
                      ) : null}
                      {request.full_charge_applies ? (
                        <span className="status-badge status-full_charge_may_apply">
                          Full Charge May Apply
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="admin-data-grid">
                    <div>
                      <span>Scheduled date</span>
                      <strong>{scheduledDate ?? "Not scheduled"}</strong>
                    </div>
                    <div>
                      <span>Acknowledgment</span>
                      <strong>
                        {request.policy_acknowledged
                          ? request.policy_acknowledged_name ?? "Completed"
                          : "Not completed"}
                      </strong>
                    </div>
                    <div>
                      <span>Original estimate</span>
                      <strong>
                        {request.original_estimated_price === null
                          ? "Not recorded"
                          : `$${request.original_estimated_price}`}
                      </strong>
                    </div>
                    <div>
                      <span>Cancellation fee</span>
                      <strong>
                        {request.cancellation_fee === null
                          ? "None"
                          : `$${request.cancellation_fee}`}
                      </strong>
                    </div>
                  </div>

                  <div className="admin-data-grid">
                    <div>
                      <span>Requested frequency</span>
                      <strong>
                        {request.requested_frequency
                          ? humanizeStatus(request.requested_frequency)
                          : "None"}
                      </strong>
                    </div>
                    <div>
                      <span>Requested route day</span>
                      <strong>{request.requested_route_day ?? "None"}</strong>
                    </div>
                    <div>
                      <span>Add services</span>
                      <strong>{formatList(request.requested_add_ons)}</strong>
                    </div>
                    <div>
                      <span>Drop services</span>
                      <strong>{formatList(request.requested_removed_add_ons)}</strong>
                    </div>
                  </div>

                  <p className="muted">{request.message ?? "No customer message."}</p>

                  <div className="form-grid">
                    <label className="field">
                      <span>Request status</span>
                      <select name="status" defaultValue={request.status}>
                        {validCustomerRequestStatuses.map((status) => (
                          <option value={status} key={status}>
                            {humanizeStatus(status)}
                          </option>
                        ))}
                      </select>
                    </label>
                    {booking ? (
                      <>
                        <label className="field">
                          <span>Booking status</span>
                          <select name="bookingStatus" defaultValue={booking.status}>
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
                            {validPaymentStatuses.map((status) => (
                              <option value={status} key={status}>
                                {humanizeStatus(status)}
                              </option>
                            ))}
                          </select>
                        </label>
                      </>
                    ) : null}
                    <label className="choice-card">
                      <input type="checkbox" name="sendUpdateEmail" />
                      <span>Send request update email</span>
                    </label>
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
                      defaultValue={request.customer_visible_admin_message ?? ""}
                      placeholder="Optional message included in customer updates."
                    />
                  </label>

                  <div className="action-row">
                    <button className="button button-dark" type="submit">
                      Save Request
                    </button>
                    {["reviewing", "approved", "completed", "denied"].map((status) => (
                      <button
                        className="button button-outline"
                        key={status}
                        name="status"
                        type="submit"
                        value={status}
                      >
                        Mark {humanizeStatus(status)}
                      </button>
                    ))}
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
                </form>
              );
            })}
          </div>
        ) : (
          <p>No customer requests match those filters.</p>
        )}
      </section>
    </AdminShell>
  );
}

function filterDeletionRequests(
  requests: AccountDeletionRequestRow[],
  profiles: ProfileRow[],
  params: Record<string, string | undefined>,
) {
  const query = params.q?.trim() ?? "";

  return requests.filter((request) => {
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
  });
}

function filterRequests(
  requests: CustomerRequestRow[],
  profiles: ProfileRow[],
  bookings: BookingRow[],
  addresses: ServiceAddressRow[],
  params: Record<string, string | undefined>,
) {
  const query = params.q?.trim() ?? "";
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  return requests
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
    .filter((request) => !params.status || request.status === params.status)
    .filter((request) => !params.type || request.request_type === params.type)
    .filter((request) => !params.policy || request.policy_window === params.policy)
    .filter((request) => {
      if (params.ack === "acknowledged") return request.policy_acknowledged;
      if (params.ack === "not_acknowledged") return !request.policy_acknowledged;
      return true;
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
    });
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

function formatList(values: string[] | null) {
  return values?.length ? values.join(", ") : "None";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
