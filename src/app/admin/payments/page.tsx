import type { Metadata } from "next";
import Link from "next/link";
import {
  sendPaymentLinkAction,
  updateBookingAdminAction,
  updatePaymentStatusAction,
} from "@/app/admin/actions";
import {
  ActionSubmitButton,
  FeedbackForm,
} from "@/components/action-feedback";
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
import {
  bookingCustomerName,
  includesSearch,
  uniqueValues,
} from "@/lib/admin-operations";
import { getAdminContext } from "@/lib/admin-data";
import { getServiceClearanceStatus } from "@/lib/payment-clearance";
import {
  formatFrequency,
  getFoundingNeighborSpecialStatus,
} from "@/lib/pricing";
import type { ActionResult } from "@/lib/action-result";
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
  { label: "Needs action first", value: "needs_action" },
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

const focusOptions = [
  { label: "Any payment need", value: "" },
  { label: "Needs payment link", value: "needs_link" },
  { label: "Payment link sent", value: "link_sent" },
  { label: "Payment failed", value: "failed" },
  { label: "Cleared for service", value: "cleared" },
  { label: "Completed but unpaid", value: "completed_unpaid" },
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

  const stats = getPaymentStats(context.bookings, context.payments);

  return (
    <AdminShell title="Payments" auth={context.auth}>
      <section className="placeholder-panel admin-command-panel">
        <div className="admin-page-heading">
          <div>
            <p className="section-kicker">Payments</p>
            <h1>Payment command center.</h1>
            <p className="muted">
              Start with the needs-action queue. Open a customer only when you
              need links, manual status changes, or Stripe details.
            </p>
          </div>
          <span className="status-badge">
            {context.bookings.length} bookings | {context.payments.length} payments
          </span>
        </div>

        <div className="admin-command-grid">
          <DashboardStat
            label="Needs link"
            value={stats.needsLink}
            href="/admin/payments?focus=needs_link"
          />
          <DashboardStat
            label="Link sent"
            value={stats.linkSent}
            href="/admin/payments?focus=link_sent"
          />
          <DashboardStat
            label="Failed"
            value={stats.failed}
            href="/admin/payments?focus=failed"
          />
          <DashboardStat
            label="Cleared"
            value={stats.cleared}
            href="/admin/payments?focus=cleared"
          />
        </div>

        <nav className="status-tabs" aria-label="Payment quick filters">
          <Link href="/admin/payments">All</Link>
          <Link href="/admin/payments?focus=needs_link">Needs payment link</Link>
          <Link href="/admin/payments?focus=link_sent">Link sent</Link>
          <Link href="/admin/payments?focus=failed">Failed</Link>
          <Link href="/admin/payments?focus=cleared">Cleared</Link>
          <Link href="/admin/payments?focus=completed_unpaid">
            Completed unpaid
          </Link>
        </nav>

        <AdminFilterBar
          searchValue={params.q}
          searchPlaceholder="Name, email, phone, address, payment link, booking ID"
          resultCount={filteredBookings.length}
          resetHref="/admin/payments"
          selects={[
            {
              name: "focus",
              label: "Payment need",
              value: params.focus,
              options: focusOptions,
            },
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
                ...uniqueValues(
                  context.bookings.map((booking) => booking.neighborhood),
                ).map((neighborhood) => ({ label: neighborhood, value: neighborhood })),
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
          <div className="admin-queue-list">
            {filteredBookings.map((booking) => {
              const bookingPayments = context.payments.filter(
                (payment) => payment.booking_id === booking.id,
              );
              const latestPayment = bookingPayments[0] ?? null;
              const checkoutUrl =
                latestPayment?.checkout_url ?? booking.payment_link ?? "";
              const paymentSummary = getServiceClearanceStatus(booking, latestPayment);
              const foundingSpecial = getFoundingNeighborSpecialStatus({
                binCount: booking.bin_count,
                frequency: booking.frequency,
                addOns: booking.add_ons,
                neighborhood: booking.neighborhood,
                createdAt: booking.created_at,
                estimatedPrice: booking.estimated_price,
              });
              const nextAction = getPaymentNextAction(
                booking,
                latestPayment,
                checkoutUrl,
              );

              return (
                <details className="admin-queue-card" key={booking.id}>
                  <summary className="admin-queue-summary">
                    <div className="admin-queue-main">
                      <span className={`needs-dot needs-dot-${nextAction.tone}`} />
                      <div>
                        <h2>{bookingCustomerName(booking)}</h2>
                        <p>
                          {booking.street_address}
                          {booking.neighborhood
                            ? ` | ${booking.neighborhood}`
                            : ""}
                        </p>
                      </div>
                    </div>

                    <div className="admin-queue-meta">
                      <span
                        className={`status-badge status-${clearanceStatusClass(
                          paymentSummary.tone,
                        )}`}
                      >
                        {paymentSummary.label}
                      </span>
                      <span
                        className={`status-badge status-${booking.payment_status}`}
                      >
                        {humanizeStatus(booking.payment_status)}
                      </span>
                      <span
                        className={`status-badge status-${foundingSpecial.status}`}
                      >
                        Special: {foundingSpecialLabel(foundingSpecial.status)}
                      </span>
                      <strong>${booking.estimated_price}</strong>
                    </div>

                    <div className="admin-queue-next">
                      <strong>{nextAction.label}</strong>
                      <span>Open</span>
                    </div>
                  </summary>

                  <div className="admin-queue-detail">
                    <div className="admin-record-overview">
                      <InfoTile label="Customer" value={bookingCustomerName(booking)} />
                      <InfoTile label="Amount" value={`$${booking.estimated_price}`} />
                      <InfoTile label="Payment" value={paymentSummary.label} />
                      <InfoTile label="Next step" value={paymentSummary.action} />
                      <InfoTile
                        label="Payment link"
                        value={checkoutUrl ? "Attached" : "Missing"}
                      />
                      <InfoTile
                        label="Route day"
                        value={booking.confirmed_route_day ?? "Not assigned"}
                      />
                      <InfoTile
                        label="Frequency"
                        value={formatFrequency(booking.frequency)}
                      />
                      <InfoTile
                        label="Special"
                        value={foundingSpecialLabel(foundingSpecial.status)}
                      />
                    </div>

                    <div className="admin-detail-layout">
                      <section className="detail-panel">
                        <h2>Payment actions</h2>
                        <p className="muted">{paymentSummary.detail}</p>

                        <div className="admin-action-list">
                          <QuickActionForm
                            action={sendPaymentLinkAction}
                            bookingId={booking.id}
                            label="Send Payment Link"
                            pendingLabel="Sending..."
                            successMessage="Payment link email sent."
                          />

                          <QuickPaymentStatusForm
                            bookingId={booking.id}
                            label="Mark Paid"
                            pendingLabel="Marking..."
                            status="paid"
                            successMessage="Payment marked paid."
                          />

                          <QuickPaymentStatusForm
                            bookingId={booking.id}
                            label="Mark Pending"
                            pendingLabel="Marking..."
                            status="pending"
                            successMessage="Payment marked pending."
                          />

                          <QuickPaymentStatusForm
                            bookingId={booking.id}
                            label="Mark Failed"
                            pendingLabel="Marking..."
                            status="failed"
                            successMessage="Payment marked failed."
                          />

                          <QuickPaymentStatusForm
                            bookingId={booking.id}
                            label="Mark Refunded"
                            pendingLabel="Marking..."
                            status="refunded"
                            successMessage="Payment marked refunded."
                          />

                          {checkoutUrl ? (
                            <CopyButton value={checkoutUrl} label="Copy Link" />
                          ) : null}
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
                            context.visits.find(
                              (visit) => visit.booking_id === booking.id,
                            )?.id
                          }
                        />
                      </section>

                      <section className="detail-panel">
                        <h2>Edit payment record</h2>

                        <FeedbackForm
                          action={updateBookingAdminAction}
                          className="compact-admin-form"
                          pendingMessage="Saving payment..."
                          successMessage="Payment record saved."
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
                          <input
                            type="hidden"
                            name="paymentReference"
                            value={booking.payment_reference ?? ""}
                          />

                          <div className="form-grid">
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

                            <label className="field">
                              <span>Payment method</span>
                              <input
                                name="paymentMethod"
                                defaultValue={booking.payment_method ?? ""}
                                placeholder="Stripe, manual, cash, etc."
                              />
                            </label>

                            <label className="field">
                              <span>Provider</span>
                              <input
                                name="paymentProvider"
                                defaultValue={booking.payment_provider ?? ""}
                                placeholder="Stripe, Square, manual"
                              />
                            </label>
                          </div>

                          <label className="field">
                            <span>Payment link</span>
                            <textarea
                              name="paymentLink"
                              defaultValue={checkoutUrl}
                              rows={2}
                            />
                          </label>

                          <ActionSubmitButton pendingLabel="Saving...">
                            Save Payment
                          </ActionSubmitButton>
                        </FeedbackForm>

                        <div className="admin-secondary-links">
                          <Link
                            className="button button-outline"
                            href={`/admin/bookings?q=${booking.id}`}
                          >
                            Open Booking
                          </Link>
                          {booking.customer_id ? (
                            <Link
                              className="button button-outline"
                              href={`/admin/customers/${booking.customer_id}`}
                            >
                              Open Customer
                            </Link>
                          ) : null}
                        </div>

                        <details className="technical-details">
                          <summary>Technical details</summary>
                          <div className="admin-data-grid">
                            <InfoTile
                              label="Payment records"
                              value={String(bookingPayments.length)}
                            />
                            <InfoTile
                              label="Created"
                              value={formatDate(booking.created_at)}
                            />
                            <InfoTile
                              label="Stripe checkout"
                              value={
                                latestPayment?.stripe_checkout_session_id ??
                                booking.stripe_checkout_session_id ??
                                "None"
                              }
                            />
                            <InfoTile
                              label="Stripe payment intent"
                              value={
                                latestPayment?.stripe_payment_intent_id ??
                                booking.stripe_payment_intent_id ??
                                "None"
                              }
                            />
                            <InfoTile
                              label="Stripe subscription"
                              value={
                                latestPayment?.stripe_subscription_id ??
                                booking.stripe_subscription_id ??
                                "None"
                              }
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
            <h2>No payment records match this view.</h2>
            <p>
              Try clearing filters or checking another payment status.
            </p>
          </div>
        )}
      </section>
    </AdminShell>
  );
}

function QuickActionForm({
  action,
  bookingId,
  label,
  pendingLabel,
  successMessage,
}: {
  action: (formData: FormData) => Promise<ActionResult | void>;
  bookingId: string;
  label: string;
  pendingLabel: string;
  successMessage: string;
}) {
  return (
    <FeedbackForm
      action={action}
      className="inline-action-form"
      pendingMessage={pendingLabel}
      successMessage={successMessage}
    >
      <input type="hidden" name="bookingId" value={bookingId} />
      <ActionSubmitButton className="button button-outline" pendingLabel={pendingLabel}>
        {label}
      </ActionSubmitButton>
    </FeedbackForm>
  );
}

function QuickPaymentStatusForm({
  bookingId,
  label,
  pendingLabel,
  status,
  successMessage,
}: {
  bookingId: string;
  label: string;
  pendingLabel: string;
  status: "pending" | "paid" | "failed" | "refunded";
  successMessage: string;
}) {
  return (
    <FeedbackForm
      action={updatePaymentStatusAction.bind(null, status)}
      className="inline-action-form"
      pendingMessage={pendingLabel}
      successMessage={successMessage}
    >
      <input type="hidden" name="bookingId" value={bookingId} />
      <ActionSubmitButton className="button button-outline" pendingLabel={pendingLabel}>
        {label}
      </ActionSubmitButton>
    </FeedbackForm>
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

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getPaymentStats(bookings: BookingRow[], payments: PaymentRow[]) {
  return bookings.reduce(
    (totals, booking) => {
      const linkedPayments = payments.filter((payment) => payment.booking_id === booking.id);
      const latestPayment = linkedPayments[0] ?? null;
      const checkoutUrl = latestPayment?.checkout_url ?? booking.payment_link ?? "";
      const clearance = getServiceClearanceStatus(booking, latestPayment);

      if (booking.payment_status === "failed" || latestPayment?.status === "failed") {
        totals.failed += 1;
      }

      if (!clearance.cleared && !checkoutUrl && booking.status !== "cancelled") {
        totals.needsLink += 1;
      }

      if (!clearance.cleared && checkoutUrl) {
        totals.linkSent += 1;
      }

      if (clearance.cleared) {
        totals.cleared += 1;
      }

      return totals;
    },
    { needsLink: 0, linkSent: 0, failed: 0, cleared: 0 },
  );
}

function getPaymentNextAction(
  booking: BookingRow,
  payment: PaymentRow | null,
  checkoutUrl: string,
) {
  const clearance = getServiceClearanceStatus(booking, payment);

  if (booking.payment_status === "failed" || payment?.status === "failed") {
    return { label: "Payment failed", tone: "danger" as const };
  }

  if (booking.status === "completed" && booking.payment_status !== "paid") {
    return { label: "Completed unpaid", tone: "danger" as const };
  }

  if (clearance.cleared) {
    return { label: "Cleared for service", tone: "good" as const };
  }

  if (!checkoutUrl) {
    return { label: "Send payment link", tone: "warning" as const };
  }

  return { label: "Waiting on payment", tone: "warning" as const };
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

      return includesSearch(
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
      );
    })
    .filter((booking) => {
      const linkedPayments = payments.filter((payment) => payment.booking_id === booking.id);
      const latestPayment = linkedPayments[0] ?? null;
      const checkoutUrl = latestPayment?.checkout_url ?? booking.payment_link ?? "";
      const clearance = getServiceClearanceStatus(booking, latestPayment);

      if (params.focus === "needs_link") {
        return !clearance.cleared && !checkoutUrl && booking.status !== "cancelled";
      }

      if (params.focus === "link_sent") {
        return !clearance.cleared && Boolean(checkoutUrl);
      }

      if (params.focus === "failed") {
        return booking.payment_status === "failed" || latestPayment?.status === "failed";
      }

      if (params.focus === "cleared") {
        return clearance.cleared;
      }

      if (params.focus === "completed_unpaid") {
        return booking.status === "completed" && booking.payment_status !== "paid";
      }

      return true;
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
    .sort((a, b) => sortBookings(a, b, payments, params.sort || "needs_action"));
}

function sortBookings(
  a: BookingRow,
  b: BookingRow,
  payments: PaymentRow[],
  sort: string,
) {
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

  const priorityDifference =
    getPaymentPriority(a, payments) - getPaymentPriority(b, payments);

  if (priorityDifference !== 0) return priorityDifference;

  return b.created_at.localeCompare(a.created_at);
}

function getPaymentPriority(booking: BookingRow, payments: PaymentRow[]) {
  const linkedPayments = payments.filter((payment) => payment.booking_id === booking.id);
  const latestPayment = linkedPayments[0] ?? null;
  const checkoutUrl = latestPayment?.checkout_url ?? booking.payment_link ?? "";
  const clearance = getServiceClearanceStatus(booking, latestPayment);

  if (booking.payment_status === "failed" || latestPayment?.status === "failed") return 10;
  if (booking.status === "completed" && booking.payment_status !== "paid") return 20;
  if (!clearance.cleared && !checkoutUrl && booking.status !== "cancelled") return 30;
  if (!clearance.cleared && checkoutUrl) return 40;
  if (clearance.cleared) return 70;
  if (booking.status === "cancelled") return 100;

  return 80;
}

function clearanceStatusClass(tone: "success" | "warning" | "danger" | "neutral") {
  if (tone === "success") return "paid";
  if (tone === "danger") return "failed";
  if (tone === "warning") return "pending";
  return "standard";
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