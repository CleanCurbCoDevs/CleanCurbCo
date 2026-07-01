import type { Metadata } from "next";
import Link from "next/link";
import {
  sendPaymentLinkAction,
  updateBookingAdminAction,
  updatePaymentStatusAction,
} from "@/app/admin/actions";
import { AdminFilterBar } from "@/components/admin-filter-bar";
import { CopyButton } from "@/components/copy-button";
import { AdminShell } from "@/components/shells/admin-shell";
import {
  humanizeStatus,
  validBookingStatuses,
  validFrequencies,
  validPaymentStatuses,
} from "@/lib/booking-utils";
import { bookingCustomerName, includesSearch, uniqueValues } from "@/lib/admin-operations";
import { getAdminContext } from "@/lib/admin-data";
import { formatFrequency } from "@/lib/pricing";
import type { BookingRow } from "@/types/database";

export const metadata: Metadata = {
  title: "Admin Payments",
};

type AdminPaymentsPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

const dateRangeOptions = [
  { label: "Any date", value: "" },
  { label: "Created this week", value: "created_this_week" },
  { label: "Created this month", value: "created_this_month" },
  { label: "Route day scheduled", value: "route_day_scheduled" },
  { label: "Completed but unpaid", value: "completed_unpaid" },
];

const sortOptions = [
  { label: "Newest first", value: "newest" },
  { label: "Oldest first", value: "oldest" },
  { label: "Highest estimated price", value: "price_high" },
  { label: "Lowest estimated price", value: "price_low" },
  { label: "Payment status", value: "payment_status" },
  { label: "Neighborhood", value: "neighborhood" },
  { label: "Customer name", value: "customer_name" },
  { label: "Confirmed route day", value: "route_day" },
];

export default async function AdminPaymentsPage({
  searchParams,
}: AdminPaymentsPageProps) {
  const params = await searchParams;
  const context = await getAdminContext("/admin/payments");
  const filteredBookings = filterAndSortBookings(context.bookings, params);

  return (
    <AdminShell title="Payments" auth={context.auth}>
      <section className="placeholder-panel">
        <div className="admin-page-heading">
          <div>
            <p className="section-kicker">Payments</p>
            <h1>Payment links and status.</h1>
            <p className="muted">
              Manual payment links stay here until Stripe, Square, or recurring
              billing is connected.
            </p>
          </div>
          <span className="status-badge">{context.bookings.length} total</span>
        </div>

        <AdminFilterBar
          searchValue={params.q}
          searchPlaceholder="Name, email, phone, address, payment link, booking ID"
          resultCount={filteredBookings.length}
          resetHref="/admin/payments"
          selects={[
            {
              name: "payment",
              label: "Payment status",
              value: params.payment,
              options: [
                { label: "Any payment status", value: "" },
                ...validPaymentStatuses.map((status) => ({
                  label: humanizeStatus(status),
                  value: status,
                })),
              ],
            },
            {
              name: "frequency",
              label: "Frequency",
              value: params.frequency,
              options: [
                { label: "Any frequency", value: "" },
                ...validFrequencies.map((frequency) => ({
                  label: formatFrequency(frequency),
                  value: frequency,
                })),
              ],
            },
            {
              name: "neighborhood",
              label: "Neighborhood",
              value: params.neighborhood,
              options: [
                { label: "Any neighborhood", value: "" },
                ...uniqueValues(context.bookings.map((booking) => booking.neighborhood)).map(
                  (neighborhood) => ({ label: neighborhood, value: neighborhood }),
                ),
              ],
            },
            {
              name: "bookingStatus",
              label: "Booking status",
              value: params.bookingStatus,
              options: [
                { label: "Any booking status", value: "" },
                ...validBookingStatuses.map((status) => ({
                  label: humanizeStatus(status),
                  value: status,
                })),
              ],
            },
            {
              name: "method",
              label: "Payment method",
              value: params.method,
              options: [
                { label: "Any method", value: "" },
                ...uniqueValues(context.bookings.map((booking) => booking.payment_method)).map(
                  (method) => ({ label: method, value: method }),
                ),
              ],
            },
            {
              name: "link",
              label: "Payment link",
              value: params.link,
              options: [
                { label: "Any link status", value: "" },
                { label: "Has payment link", value: "has_link" },
                { label: "Missing payment link", value: "missing_link" },
              ],
            },
            {
              name: "dateRange",
              label: "Date range",
              value: params.dateRange,
              options: dateRangeOptions,
            },
            {
              name: "sort",
              label: "Sort",
              value: params.sort,
              options: sortOptions,
            },
          ]}
        />

        {filteredBookings.length ? (
          <div className="admin-card-list">
            {filteredBookings.map((booking) => (
              <form
                action={updateBookingAdminAction}
                className="admin-edit-card"
                key={booking.id}
              >
                <input type="hidden" name="bookingId" value={booking.id} />
                <input type="hidden" name="status" value={booking.status} />
                <input
                  type="hidden"
                  name="confirmedRouteDay"
                  value={booking.confirmed_route_day ?? ""}
                />
                <input
                  type="hidden"
                  name="internalNotes"
                  value={booking.internal_notes ?? ""}
                />
                <div className="admin-row-heading">
                  <div>
                    <h2>{bookingCustomerName(booking)}</h2>
                    <p className="muted">
                      {booking.street_address}
                      {booking.neighborhood ? ` | ${booking.neighborhood}` : ""}
                    </p>
                  </div>
                  <div className="status-stack">
                    <span className={`status-badge status-${booking.payment_status}`}>
                      {humanizeStatus(booking.payment_status)}
                    </span>
                    <span className={`status-badge status-${booking.status}`}>
                      {humanizeStatus(booking.status)}
                    </span>
                  </div>
                </div>

                <div className="admin-data-grid">
                  <div>
                    <span>Frequency</span>
                    <strong>{formatFrequency(booking.frequency)}</strong>
                  </div>
                  <div>
                    <span>Estimated price</span>
                    <strong>${booking.estimated_price}</strong>
                  </div>
                  <div>
                    <span>Created</span>
                    <strong>{formatDate(booking.created_at)}</strong>
                  </div>
                  <div>
                    <span>Route day</span>
                    <strong>{booking.confirmed_route_day ?? "Pending"}</strong>
                  </div>
                </div>

                <div className="form-grid">
                  <label className="field">
                    <span>Payment status</span>
                    <select name="paymentStatus" defaultValue={booking.payment_status}>
                      {validPaymentStatuses.map((status) => (
                        <option value={status} key={status}>
                          {humanizeStatus(status)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Payment link</span>
                    <input name="paymentLink" defaultValue={booking.payment_link ?? ""} />
                  </label>
                  <label className="field">
                    <span>Payment method</span>
                    <input
                      name="paymentMethod"
                      defaultValue={booking.payment_method ?? ""}
                      placeholder="Stripe, Square, Venmo, Zelle, manual"
                    />
                  </label>
                  <label className="field">
                    <span>Provider / reference</span>
                    <input
                      name="paymentProvider"
                      defaultValue={booking.payment_provider ?? ""}
                      placeholder="Provider"
                    />
                  </label>
                  <input
                    type="hidden"
                    name="paymentReference"
                    value={booking.payment_reference ?? ""}
                  />
                </div>

                <div className="action-row">
                  <button className="button button-dark" type="submit">
                    Save Payment
                  </button>
                  <CopyButton value={booking.payment_link ?? ""} label="Copy Link" />
                  <button
                    className="button button-outline"
                    formAction={updatePaymentStatusAction}
                    name="quickPaymentStatus"
                    type="submit"
                    value="pending"
                  >
                    Mark Pending
                  </button>
                  <button
                    className="button button-outline"
                    formAction={updatePaymentStatusAction}
                    name="quickPaymentStatus"
                    type="submit"
                    value="paid"
                  >
                    Mark Paid
                  </button>
                  <button
                    className="button button-outline"
                    formAction={updatePaymentStatusAction}
                    name="quickPaymentStatus"
                    type="submit"
                    value="failed"
                  >
                    Mark Failed
                  </button>
                  <button
                    className="button button-outline"
                    formAction={updatePaymentStatusAction}
                    name="quickPaymentStatus"
                    type="submit"
                    value="refunded"
                  >
                    Mark Refunded
                  </button>
                  <button
                    className="button button-outline"
                    formAction={sendPaymentLinkAction}
                    type="submit"
                  >
                    Send Reminder
                  </button>
                  <Link className="button button-outline" href={`/admin/bookings?q=${booking.id}`}>
                    Open Booking
                  </Link>
                </div>
              </form>
            ))}
          </div>
        ) : (
          <p>No payment records match those filters.</p>
        )}
      </section>
    </AdminShell>
  );
}

function filterAndSortBookings(
  bookings: BookingRow[],
  params: Record<string, string | undefined>,
) {
  const query = params.q?.trim() ?? "";
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  return bookings
    .filter((booking) =>
      includesSearch(
        [
          bookingCustomerName(booking),
          booking.email,
          booking.phone,
          booking.street_address,
          booking.neighborhood,
          booking.payment_link,
          booking.id,
        ],
        query,
      ),
    )
    .filter((booking) => !params.payment || booking.payment_status === params.payment)
    .filter((booking) => !params.frequency || booking.frequency === params.frequency)
    .filter((booking) => !params.neighborhood || booking.neighborhood === params.neighborhood)
    .filter((booking) => !params.bookingStatus || booking.status === params.bookingStatus)
    .filter((booking) => !params.method || booking.payment_method === params.method)
    .filter((booking) => {
      if (params.link === "has_link") return Boolean(booking.payment_link);
      if (params.link === "missing_link") return !booking.payment_link;
      return true;
    })
    .filter((booking) => {
      if (params.dateRange === "created_this_week") {
        return new Date(booking.created_at) >= weekAgo;
      }
      if (params.dateRange === "created_this_month") {
        return new Date(booking.created_at) >= monthStart;
      }
      if (params.dateRange === "route_day_scheduled") {
        return Boolean(booking.confirmed_route_day);
      }
      if (params.dateRange === "completed_unpaid") {
        return booking.status === "completed" && booking.payment_status !== "paid";
      }
      return true;
    })
    .sort((a, b) => sortBookings(a, b, params.sort ?? "newest"));
}

function sortBookings(a: BookingRow, b: BookingRow, sort: string) {
  if (sort === "oldest") return a.created_at.localeCompare(b.created_at);
  if (sort === "price_high") return b.estimated_price - a.estimated_price;
  if (sort === "price_low") return a.estimated_price - b.estimated_price;
  if (sort === "payment_status") return a.payment_status.localeCompare(b.payment_status);
  if (sort === "neighborhood") {
    return (a.neighborhood ?? "").localeCompare(b.neighborhood ?? "");
  }
  if (sort === "customer_name") {
    return bookingCustomerName(a).localeCompare(bookingCustomerName(b));
  }
  if (sort === "route_day") {
    return (a.confirmed_route_day ?? "9999").localeCompare(
      b.confirmed_route_day ?? "9999",
    );
  }
  return b.created_at.localeCompare(a.created_at);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
