import type { Metadata } from "next";
import Link from "next/link";
import {
  sendPaymentLinkAction,
  updateBookingAdminAction,
  updatePaymentStatusAction,
} from "@/app/admin/actions";
import { AdminFilterBar } from "@/components/admin-filter-bar";
import { AdminPaymentCreator } from "@/components/admin-payment-creator";
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
import { getServiceClearanceStatus } from "@/lib/payment-clearance";
import {
  formatFrequency,
  getFoundingNeighborSpecialStatus,
} from "@/lib/pricing";
import type { BookingRow, PaymentRow } from "@/types/database";

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
  { label: "Customer name", value: "customer_name" },
  { label: "Payment status", value: "payment_status" },
  { label: "Neighborhood", value: "neighborhood" },
  { label: "Lowest estimated price", value: "price_low" },
  { label: "Confirmed route day", value: "route_day" },
];

const paymentFilterOptions = [
  { label: "Any payment status", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Paid", value: "paid" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Failed", value: "failed" },
  { label: "Expired", value: "expired" },
  { label: "Not sent", value: "not_sent" },
  { label: "Refunded", value: "refunded" },
];

export default async function AdminPaymentsPage({
  searchParams,
}: AdminPaymentsPageProps) {
  const params = await searchParams;
  const context = await getAdminContext("/admin/payments");
  const filteredBookings = filterAndSortBookings(
    context.bookings,
    context.payments,
    params,
  );

  return (
    <AdminShell title="Payments" auth={context.auth}>
      <section className="placeholder-panel">
        <div className="admin-page-heading">
          <div>
            <p className="section-kicker">Payments</p>
            <h1>Payment links and status.</h1>
            <p className="muted">
              Manage manual payment links, Stripe Checkout records, payment
              emails, and unpaid completed service.
            </p>
          </div>
          <span className="status-badge">
            {context.bookings.length} bookings | {context.payments.length} payments
          </span>
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
              options: paymentFilterOptions,
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
                ...uniqueValues([
                  ...context.bookings.map((booking) => booking.payment_method),
                  ...context.bookings.map((booking) => booking.payment_provider),
                  ...context.payments.map((payment) => payment.provider),
                ]).map((method) => ({ label: method, value: method })),
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
            {filteredBookings.map((booking) => {
              const bookingPayments = context.payments.filter(
                (payment) => payment.booking_id === booking.id,
              );
              const latestPayment = bookingPayments[0] ?? null;
              const checkoutUrl = latestPayment?.checkout_url ?? booking.payment_link ?? "";
              const paymentSummary = getServiceClearanceStatus(booking, latestPayment);
              const foundingSpecial = getFoundingNeighborSpecialStatus({
                binCount: booking.bin_count,
                frequency: booking.frequency,
                addOns: booking.add_ons,
                neighborhood: booking.neighborhood,
                createdAt: booking.created_at,
                estimatedPrice: booking.estimated_price,
              });

              return (
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
                <details className="admin-payment-details">
                  <summary className="admin-collapsible-summary">
                    <div>
                      <h2>{bookingCustomerName(booking)}</h2>
                      <p className="muted">
                        {booking.street_address}
                        {booking.neighborhood ? ` | ${booking.neighborhood}` : ""}
                      </p>
                    </div>
                    <div className="admin-collapsible-meta">
                      <span className={`status-badge status-${paymentSummary.tone}`}>
                        {paymentSummary.label}
                      </span>
                      <span className={`status-badge status-${booking.payment_status}`}>
                        {humanizeStatus(booking.payment_status)}
                      </span>
                      <span className={`status-badge status-${foundingSpecial.status}`}>
                        Special: {foundingSpecialLabel(foundingSpecial.status)}
                      </span>
                      <strong>${booking.estimated_price}</strong>
                    </div>
                  </summary>
                  <div className="admin-payment-detail-body">
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
                    <span>Follow-up signal</span>
                    <strong>{paymentSummary.label}</strong>
                    <span>{paymentSummary.action}</span>
                  </div>
                  <div>
                    <span>Founding Neighbor Special</span>
                    <strong>{foundingSpecialLabel(foundingSpecial.status)}</strong>
                    <span>{foundingSpecial.reason}</span>
                  </div>
                  <div>
                    <span>Created</span>
                    <strong>{formatDate(booking.created_at)}</strong>
                  </div>
                  <div>
                    <span>Route day</span>
                    <strong>{booking.confirmed_route_day ?? "Pending"}</strong>
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
                    <span>Stripe payment intent</span>
                    <strong>
                      {latestPayment?.stripe_payment_intent_id ??
                        booking.stripe_payment_intent_id ??
                        "None"}
                    </strong>
                  </div>
                  <div>
                    <span>Stripe subscription</span>
                    <strong>
                      {latestPayment?.stripe_subscription_id ??
                        booking.stripe_subscription_id ??
                        "None"}
                    </strong>
                  </div>
                </div>

                <AdminPaymentCreator
                  addOns={booking.add_ons}
                  binCount={booking.bin_count}
                  bookingId={booking.id}
                  customerId={booking.customer_id}
                  defaultAmount={booking.estimated_price}
                  defaultDescription={`Clean Curb Co. service at ${booking.street_address}`}
                  frequency={booking.frequency}
                  paymentId={latestPayment?.id}
                  serviceVisitId={
                    context.visits.find((visit) => visit.booking_id === booking.id)?.id
                  }
                />

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
                    <textarea name="paymentLink" defaultValue={checkoutUrl} rows={2} />
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
                  <CopyButton value={checkoutUrl} label="Copy Link" />
                  <button
                    className="button button-outline"
                    formAction={updatePaymentStatusAction.bind(null, "pending")}
                    type="submit"
                  >
                    Mark Pending
                  </button>
                  <button
                    className="button button-outline"
                    formAction={updatePaymentStatusAction.bind(null, "paid")}
                    type="submit"
                  >
                    Mark Paid
                  </button>
                  <button
                    className="button button-outline"
                    formAction={updatePaymentStatusAction.bind(null, "failed")}
                    type="submit"
                  >
                    Mark Failed
                  </button>
                  <button
                    className="button button-outline"
                    formAction={updatePaymentStatusAction.bind(null, "refunded")}
                    type="submit"
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
                  </div>
                </details>
              </form>
              );
            })}
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
  payments: PaymentRow[],
  params: Record<string, string | undefined>,
) {
  const query = params.q?.trim() ?? "";
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  return bookings
    .filter((booking) => {
      const linkedPayments = payments.filter((payment) => payment.booking_id === booking.id);
      return (
      includesSearch(
        [
          bookingCustomerName(booking),
          booking.email,
          booking.phone,
          booking.street_address,
          booking.neighborhood,
          booking.payment_link,
          booking.id,
          booking.stripe_checkout_session_id,
          booking.stripe_payment_intent_id,
          booking.stripe_subscription_id,
          ...linkedPayments.flatMap((payment) => [
            payment.checkout_url,
            payment.id,
            payment.stripe_checkout_session_id,
            payment.stripe_payment_intent_id,
            payment.stripe_subscription_id,
            payment.payment_type,
            payment.provider,
          ]),
        ],
        query,
      )
      );
    })
    .filter((booking) => {
      if (!params.payment) return true;
      const linkedPayments = payments.filter((payment) => payment.booking_id === booking.id);
      if (params.payment === "expired") {
        return linkedPayments.some(
          (payment) => payment.metadata?.last_stripe_event === "checkout.session.expired",
        );
      }
      if (params.payment === "cancelled") {
        return linkedPayments.some((payment) => payment.status === "cancelled");
      }
      return (
        booking.payment_status === params.payment ||
        linkedPayments.some((payment) => payment.status === params.payment)
      );
    })
    .filter((booking) => !params.frequency || booking.frequency === params.frequency)
    .filter((booking) => !params.neighborhood || booking.neighborhood === params.neighborhood)
    .filter((booking) => !params.bookingStatus || booking.status === params.bookingStatus)
    .filter((booking) => {
      if (!params.method) return true;
      const linkedPayments = payments.filter((payment) => payment.booking_id === booking.id);
      return (
        booking.payment_method === params.method ||
        booking.payment_provider === params.method ||
        linkedPayments.some((payment) => payment.provider === params.method)
      );
    })
    .filter((booking) => {
      const linkedPayments = payments.filter((payment) => payment.booking_id === booking.id);
      const hasLink =
        Boolean(booking.payment_link) ||
        linkedPayments.some((payment) => Boolean(payment.checkout_url));
      if (params.link === "has_link") return hasLink;
      if (params.link === "missing_link") return !hasLink;
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

function foundingSpecialLabel(
  status: "eligible" | "applied" | "manual_override" | "not_eligible",
) {
  if (status === "applied") return "Applied";
  if (status === "manual_override") return "Manual override";
  if (status === "eligible") return "Eligible";
  return "Not eligible";
}
