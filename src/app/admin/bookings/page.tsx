import type { Metadata } from "next";
import Link from "next/link";
import {
  sendPaymentLinkAction,
  sendPaymentSetupInviteAction,
  sendReviewRequestAction,
  updateBookingAdminAction,
} from "@/app/admin/actions";
import { AdminFilterBar } from "@/components/admin-filter-bar";
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
  title: "Admin Bookings",
};

type AdminBookingsPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

const dateOptions = [
  { label: "Any date", value: "" },
  { label: "Created this week", value: "week" },
  { label: "Created this month", value: "month" },
  { label: "Route day scheduled", value: "route_day" },
  { label: "Completed but unpaid", value: "completed_unpaid" },
];

const sortOptions = [
  { label: "Newest first", value: "newest" },
  { label: "Oldest first", value: "oldest" },
  { label: "Route day", value: "route_day" },
  { label: "Neighborhood", value: "neighborhood" },
  { label: "Customer name", value: "customer_name" },
  { label: "Highest estimate", value: "price_high" },
];

export default async function AdminBookingsPage({
  searchParams,
}: AdminBookingsPageProps) {
  const params = await searchParams;
  const context = await getAdminContext("/admin/bookings");
  const bookings = filterAndSortBookings(context.bookings, params);

  return (
    <AdminShell title="Admin bookings" auth={context.auth}>
      <section className="placeholder-panel">
        <div className="admin-page-heading">
          <div>
            <p className="section-kicker">Bookings</p>
            <h1>Route requests and service status.</h1>
            <p className="muted">
              Confirm route days, track status, send emails, and keep payment
              links attached to the booking record.
            </p>
          </div>
          <span className="status-badge">{context.bookings.length} total</span>
        </div>

        <nav className="status-tabs" aria-label="Booking status tabs">
          <Link href="/admin/bookings">All</Link>
          {validBookingStatuses.map((status) => (
            <Link
              href={`/admin/bookings${queryWith(params, "status", status)}`}
              key={status}
            >
              {humanizeStatus(status)}
            </Link>
          ))}
        </nav>

        <AdminFilterBar
          searchValue={params.q}
          searchPlaceholder="Customer, email, phone, address, booking ID"
          resultCount={bookings.length}
          resetHref="/admin/bookings"
          selects={[
            {
              name: "status",
              label: "Booking status",
              value: params.status,
              options: [
                { label: "Any booking status", value: "" },
                ...validBookingStatuses.map((status) => ({
                  label: humanizeStatus(status),
                  value: status,
                })),
              ],
            },
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
            { name: "date", label: "Date", value: params.date, options: dateOptions },
            { name: "sort", label: "Sort", value: params.sort, options: sortOptions },
          ]}
        />

        {bookings.length ? (
          <div className="admin-card-list">
            {bookings.map((booking) => {
              const referral = context.referrals.find(
                (item) => item.referred_booking_id === booking.id,
              );
              const bookingPayments = context.payments.filter(
                (payment) => payment.booking_id === booking.id,
              );
              const latestPayment = bookingPayments[0] ?? null;
              const visit = context.visits.find(
                (item) => item.booking_id === booking.id,
              );

              return (
                <form
                  action={updateBookingAdminAction}
                  className="admin-edit-card"
                  key={booking.id}
                >
                  <input type="hidden" name="bookingId" value={booking.id} />
                  <div className="admin-row-heading">
                    <div>
                      <h2>{bookingCustomerName(booking)}</h2>
                      <p className="muted">
                        {booking.phone} | {booking.email}
                        <br />
                        {booking.street_address}, {booking.city}, {booking.state}{" "}
                        {booking.zip_code}
                        <br />
                        {booking.neighborhood ?? "Neighborhood not provided"} |{" "}
                        {booking.bin_count} bins | ${booking.estimated_price}
                      </p>
                    </div>
                    <div className="status-stack">
                      <span className={`status-badge status-${booking.status}`}>
                        {humanizeStatus(booking.status)}
                      </span>
                      <span className={`status-badge status-${booking.payment_status}`}>
                        {humanizeStatus(booking.payment_status)}
                      </span>
                      {referral ? (
                        <span className={`status-badge status-${referral.status}`}>
                          Referral: {humanizeStatus(referral.status)}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="admin-data-grid">
                    <div>
                      <span>Estimated price</span>
                      <strong>${booking.estimated_price}</strong>
                    </div>
                    <div>
                      <span>Payment records</span>
                      <strong>{bookingPayments.length}</strong>
                    </div>
                    <div>
                      <span>Stripe checkout</span>
                      <strong>
                        {latestPayment?.stripe_checkout_session_id ??
                          booking.stripe_checkout_session_id ??
                          "None"}
                      </strong>
                    </div>
                    <div>
                      <span>Payment intent</span>
                      <strong>
                        {latestPayment?.stripe_payment_intent_id ??
                          booking.stripe_payment_intent_id ??
                          "None"}
                      </strong>
                    </div>
                    <div>
                      <span>Subscription</span>
                      <strong>
                        {latestPayment?.stripe_subscription_id ??
                          booking.stripe_subscription_id ??
                          "None"}
                      </strong>
                    </div>
                    <div>
                      <span>Payment setup</span>
                      <strong>
                        {booking.payment_method_on_file
                          ? "Method on file"
                          : humanizeStatus(
                              booking.payment_setup_status ?? "not_started",
                            )}
                      </strong>
                    </div>
                    <div>
                      <span>Stripe customer</span>
                      <strong>
                        {booking.stripe_customer_id ??
                          latestPayment?.stripe_customer_id ??
                          "None"}
                      </strong>
                    </div>
                  </div>

                  <div className="form-grid">
                    <label className="field">
                      <span>Status</span>
                      <select name="status" defaultValue={booking.status}>
                        {validBookingStatuses.map((status) => (
                          <option value={status} key={status}>
                            {humanizeStatus(status)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Route day</span>
                      <input
                        type="date"
                        name="confirmedRouteDay"
                        defaultValue={booking.confirmed_route_day ?? ""}
                      />
                    </label>
                    <label className="field">
                      <span>Proposed route day</span>
                      <input
                        type="date"
                        name="proposedRouteDay"
                        defaultValue={booking.proposed_route_day ?? ""}
                      />
                    </label>
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
                      <textarea
                        name="paymentLink"
                        defaultValue={booking.payment_link ?? ""}
                        rows={2}
                      />
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
                      <span>Payment provider</span>
                      <input
                        name="paymentProvider"
                        defaultValue={booking.payment_provider ?? ""}
                      />
                    </label>
                    <label className="field">
                      <span>Payment reference</span>
                      <input
                        name="paymentReference"
                        defaultValue={booking.payment_reference ?? ""}
                      />
                    </label>
                    <label className="choice-card">
                      <input type="checkbox" name="sendRouteEmail" />
                      <span>Send route confirmation email after saving</span>
                    </label>
                  </div>
                  <label className="field">
                    <span>Internal notes</span>
                    <textarea
                      name="internalNotes"
                      defaultValue={booking.internal_notes ?? ""}
                    />
                  </label>
                  <label className="field">
                    <span>Customer-facing message</span>
                    <textarea
                      name="customerVisibleAdminMessage"
                      defaultValue={booking.customer_visible_admin_message ?? ""}
                      placeholder="Used for booking decisions or route date offers."
                    />
                  </label>
                  <p className="muted">
                    Customer notes: {booking.customer_notes ?? "None"} | Water
                    spigot: {booking.water_spigot_available ?? "Not sure"}
                  </p>

                  <div className="action-row">
                    <button className="button button-dark" type="submit">
                      Save Booking
                    </button>
                    <button
                      className="button button-outline"
                      formAction={sendPaymentLinkAction}
                      type="submit"
                    >
                      Send Payment Link
                    </button>
                    <button
                      className="button button-outline"
                      formAction={sendPaymentSetupInviteAction}
                      type="submit"
                    >
                      Send Payment Setup
                    </button>
                    <button
                      className="button button-outline"
                      formAction={sendReviewRequestAction}
                      type="submit"
                    >
                      Send Review Request
                    </button>
                    <button
                      className="button button-outline"
                      name="bookingDecision"
                      type="submit"
                      value="accept"
                    >
                      Accept Booking
                    </button>
                    <button
                      className="button button-outline"
                      name="bookingDecision"
                      type="submit"
                      value="decline"
                    >
                      Decline Booking
                    </button>
                    <button
                      className="button button-outline"
                      name="bookingDecision"
                      type="submit"
                      value="needs_more_info"
                    >
                      Need Info
                    </button>
                    <button
                      className="button button-outline"
                      name="bookingDecision"
                      type="submit"
                      value="offer_route"
                    >
                      Offer Route Date
                    </button>
                    <button
                      className="button button-outline"
                      name="bookingDecision"
                      type="submit"
                      value="approve_requested_date"
                    >
                      Approve Requested Date
                    </button>
                    <button
                      className="button button-outline"
                      name="bookingDecision"
                      type="submit"
                      value="decline_requested_date"
                    >
                      Date Unavailable
                    </button>
                    {booking.customer_id ? (
                      <Link
                        className="button button-outline"
                        href={`/admin/customers/${booking.customer_id}`}
                      >
                        View Customer
                      </Link>
                    ) : null}
                    {visit ? (
                      <Link
                        className="button button-outline"
                        href={`/admin/checklists/${visit.id}`}
                      >
                        Checklist
                      </Link>
                    ) : null}
                    {referral ? (
                      <Link
                        className="button button-outline"
                        href={`/admin/referrals?q=${referral.id}`}
                      >
                        View Referral
                      </Link>
                    ) : null}
                  </div>
                </form>
              );
            })}
          </div>
        ) : (
          <p>No booking requests match those filters.</p>
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
          booking.id,
        ],
        query,
      ),
    )
    .filter((booking) => !params.status || booking.status === params.status)
    .filter((booking) => !params.payment || booking.payment_status === params.payment)
    .filter((booking) => !params.frequency || booking.frequency === params.frequency)
    .filter((booking) => !params.neighborhood || booking.neighborhood === params.neighborhood)
    .filter((booking) => {
      if (params.date === "week") return new Date(booking.created_at) >= weekAgo;
      if (params.date === "month") return new Date(booking.created_at) >= monthStart;
      if (params.date === "route_day") return Boolean(booking.confirmed_route_day);
      if (params.date === "completed_unpaid") {
        return booking.status === "completed" && booking.payment_status !== "paid";
      }
      return true;
    })
    .sort((a, b) => {
      if (params.sort === "oldest") return a.created_at.localeCompare(b.created_at);
      if (params.sort === "route_day") {
        return (a.confirmed_route_day ?? "9999").localeCompare(
          b.confirmed_route_day ?? "9999",
        );
      }
      if (params.sort === "neighborhood") {
        return (a.neighborhood ?? "").localeCompare(b.neighborhood ?? "");
      }
      if (params.sort === "customer_name") {
        return bookingCustomerName(a).localeCompare(bookingCustomerName(b));
      }
      if (params.sort === "price_high") return b.estimated_price - a.estimated_price;
      return b.created_at.localeCompare(a.created_at);
    });
}

function queryWith(
  params: Record<string, string | undefined>,
  key: string,
  value: string,
) {
  const next = new URLSearchParams();
  Object.entries(params).forEach(([paramKey, paramValue]) => {
    if (paramValue && paramKey !== key) next.set(paramKey, paramValue);
  });
  next.set(key, value);
  return `?${next.toString()}`;
}
