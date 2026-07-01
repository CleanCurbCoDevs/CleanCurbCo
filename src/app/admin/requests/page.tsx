import type { Metadata } from "next";
import Link from "next/link";
import { updateCustomerRequestAdminAction } from "@/app/admin/actions";
import { AdminFilterBar } from "@/components/admin-filter-bar";
import { AdminShell } from "@/components/shells/admin-shell";
import {
  humanizeStatus,
  validCustomerRequestStatuses,
  validRequestTypes,
} from "@/lib/booking-utils";
import { getAdminContext } from "@/lib/admin-data";
import { fullName, includesSearch, uniqueValues } from "@/lib/admin-operations";
import type {
  BookingRow,
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

  return (
    <AdminShell title="Requests" auth={context.auth}>
      <section className="placeholder-panel">
        <div className="admin-page-heading">
          <div>
            <p className="section-kicker">Customer Requests</p>
            <h1>Review service changes before they happen.</h1>
            <p className="muted">
              Pause, cancel, frequency, address, add-on, billing, and account
              help requests land here.
            </p>
          </div>
          <span className="status-badge">{context.requests.length} total</span>
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
                  label: humanizeStatus(type),
                  value: type,
                })),
              ],
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
            { name: "date", label: "Date", value: params.date, options: dateOptions },
          ]}
        />

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

              return (
                <form
                  action={updateCustomerRequestAdminAction}
                  className="admin-edit-card"
                  key={request.id}
                >
                  <input type="hidden" name="requestId" value={request.id} />
                  <div className="admin-row-heading">
                    <div>
                      <h2>{humanizeStatus(request.request_type)}</h2>
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
                    <span className={`status-badge status-${request.status}`}>
                      {humanizeStatus(request.status)}
                    </span>
                  </div>

                  <div className="admin-data-grid">
                    <div>
                      <span>Created</span>
                      <strong>{formatDate(request.created_at)}</strong>
                    </div>
                    <div>
                      <span>Requested frequency</span>
                      <strong>
                        {request.requested_frequency
                          ? humanizeStatus(request.requested_frequency)
                          : "None"}
                      </strong>
                    </div>
                    <div>
                      <span>Pause window</span>
                      <strong>
                        {request.requested_pause_start
                          ? `${request.requested_pause_start} to ${
                              request.requested_pause_end ?? "open"
                            }`
                          : "None"}
                      </strong>
                    </div>
                    <div>
                      <span>Booking</span>
                      <strong>{booking?.id.slice(0, 8) ?? "No booking"}</strong>
                    </div>
                  </div>

                  <p className="muted">{request.message ?? "No customer message."}</p>

                  <div className="form-grid">
                    <label className="field">
                      <span>Status</span>
                      <select name="status" defaultValue={request.status}>
                        {validCustomerRequestStatuses.map((status) => (
                          <option value={status} key={status}>
                            {humanizeStatus(status)}
                          </option>
                        ))}
                      </select>
                    </label>
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

                  <div className="action-row">
                    <button className="button button-dark" type="submit">
                      Save Request
                    </button>
                    {profile ? (
                      <Link
                        className="button button-outline"
                        href={`/admin/customers/${profile.id}`}
                      >
                        View Customer
                      </Link>
                    ) : null}
                    {booking ? (
                      <Link
                        className="button button-outline"
                        href={`/admin/bookings?q=${booking.id}`}
                      >
                        View Booking
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
        ],
        query,
      );
    })
    .filter((request) => !params.status || request.status === params.status)
    .filter((request) => !params.type || request.request_type === params.type)
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
      if (params.date === "week") return new Date(request.created_at) >= weekAgo;
      if (params.date === "month") return new Date(request.created_at) >= monthStart;
      return true;
    });
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
