import type { Metadata } from "next";
import Link from "next/link";
import {
  sendPaymentLinkAction,
  sendPaymentSetupInviteAction,
  sendReviewRequestAction,
  updateBookingAdminAction,
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
  validFrequencies,
  validPaymentStatuses,
} from "@/lib/booking-utils";
import {
  bookingCustomerName,
  includesSearch,
  uniqueValues,
} from "@/lib/admin-operations";
import { getAdminContext } from "@/lib/admin-data";
import {
  formatFrequency,
  getFoundingNeighborSpecialStatus,
} from "@/lib/pricing";
import type { ActionResult } from "@/lib/action-result";
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
  { label: "Needs action first", value: "needs_action" },
  { label: "Newest first", value: "newest" },
  { label: "Oldest first", value: "oldest" },
  { label: "Route day", value: "route_day" },
  { label: "Neighborhood", value: "neighborhood" },
  { label: "Customer name", value: "customer_name" },
  { label: "Highest estimate", value: "price_high" },
];

const needsActionOptions = [
  { label: "Any need", value: "" },
  { label: "Needs payment", value: "needs_payment" },
  { label: "Needs payment link", value: "needs_payment_link" },
  { label: "Needs route", value: "needs_route" },
  { label: "Needs follow-up", value: "needs_follow_up" },
  { label: "New booking", value: "new" },
  { label: "Failed payment", value: "payment_failed" },
];

export default async function AdminBookingsPage({
  searchParams,
}: AdminBookingsPageProps) {
  const params = await searchParams;
  const context = await getAdminContext("/admin/bookings");
  const bookings = filterAndSortBookings(context.bookings, params);

  const stats = {
    new: context.bookings.filter((booking) => booking.status === "new").length,
    needsPayment: context.bookings.filter(
      (booking) =>
        booking.payment_status !== "paid" && booking.status !== "cancelled",
    ).length,
    needsRoute: context.bookings.filter(
      (booking) =>
        !booking.confirmed_route_day &&
        !["cancelled", "completed"].includes(booking.status),
    ).length,
    failedPayment: context.bookings.filter(
      (booking) => booking.payment_status === "failed",
    ).length,
  };

  return (
    <AdminShell title="Bookings" auth={context.auth}>
      <section className="placeholder-panel admin-command-panel">
        <div className="admin-page-heading">
          <div>
            <p className="section-kicker">Bookings</p>
            <h1>Booking queue.</h1>
            <p className="muted">
              Work from the queue first. Open a booking only when you need the
              full edit form, emails, or technical details.
            </p>
          </div>
          <span className="status-badge">{context.bookings.length} total</span>
        </div>

        <div className="admin-command-grid">
          <DashboardStat
            label="New"
            value={stats.new}
            href="/admin/bookings?needs=new"
          />
          <DashboardStat
            label="Needs payment"
            value={stats.needsPayment}
            href="/admin/bookings?needs=needs_payment"
          />
          <DashboardStat
            label="Needs route"
            value={stats.needsRoute}
            href="/admin/bookings?needs=needs_route"
          />
          <DashboardStat
            label="Failed payment"
            value={stats.failedPayment}
            href="/admin/bookings?needs=payment_failed"
          />
        </div>

        <nav className="status-tabs" aria-label="Booking status tabs">
          <Link href="/admin/bookings">All</Link>
          <Link href="/admin/bookings?needs=new">New</Link>
          <Link href="/admin/bookings?needs=needs_payment">Needs payment</Link>
          <Link href="/admin/bookings?needs=needs_route">Needs route</Link>
          <Link href="/admin/bookings?needs=needs_follow_up">Follow-up</Link>
          <Link href="/admin/bookings?needs=payment_failed">Failed payment</Link>
        </nav>

        <AdminFilterBar
          searchValue={params.q}
          searchPlaceholder="Customer, email, phone, address, booking ID"
          resultCount={bookings.length}
          resetHref="/admin/bookings"
          selects={[
            {
              name: "needs",
              label: "Needs action",
              value: params.needs,
              options: needsActionOptions,
            },
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
                ...uniqueValues(
                  context.bookings.map((booking) => booking.neighborhood),
                ).map((neighborhood) => ({
                  label: neighborhood,
                  value: neighborhood,
                })),
              ],
            },
            {
              name: "date",
              label: "Date",
              value: params.date,
              options: dateOptions,
            },
            {
              name: "sort",
              label: "Sort",
              value: params.sort,
              options: sortOptions,
            },
          ]}
        />

        {bookings.length ? (
          <div className="admin-queue-list">
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
              const foundingSpecial = getFoundingNeighborSpecialStatus({
                binCount: booking.bin_count,
                frequency: booking.frequency,
                addOns: booking.add_ons,
                neighborhood: booking.neighborhood,
                createdAt: booking.created_at,
                estimatedPrice: booking.estimated_price,
              });
              const nextAction = getBookingNextAction(booking);

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
                      <span className={`status-badge status-${booking.status}`}>
                        {humanizeStatus(booking.status)}
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
                    </div>

                    <div className="admin-queue-next">
                      <strong>{nextAction.label}</strong>
                      <span>Open</span>
                    </div>
                  </summary>

                  <div className="admin-queue-detail">
                    <div className="admin-record-overview">
                      <InfoTile label="Customer" value={bookingCustomerName(booking)} />
                      <InfoTile label="Email" value={booking.email} />
                      <InfoTile label="Phone" value={booking.phone} />
                      <InfoTile
                        label="Service"
                        value={`${booking.bin_count} bins | ${formatFrequency(
                          booking.frequency,
                        )}`}
                      />
                      <InfoTile label="Estimate" value={`$${booking.estimated_price}`} />
                      <InfoTile
                        label="Route day"
                        value={booking.confirmed_route_day ?? "Not assigned"}
                      />
                      <InfoTile
                        label="Payment link"
                        value={booking.payment_link ? "Attached" : "Not attached"}
                      />
                      <InfoTile
                        label="Special reason"
                        value={foundingSpecial.reason}
                      />
                    </div>

                    <div className="admin-detail-layout">
                      <section className="detail-panel">
                        <h2>Edit booking</h2>
                        <FeedbackForm
                          action={updateBookingAdminAction}
                          className="compact-admin-form"
                          pendingMessage="Saving booking..."
                          successMessage="Booking saved."
                        >
                          <input type="hidden" name="bookingId" value={booking.id} />

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
                              <span>Payment method</span>
                              <input
                                name="paymentMethod"
                                defaultValue={booking.payment_method ?? ""}
                                placeholder="Stripe, manual, cash, etc."
                              />
                            </label>

                            <label className="field">
                              <span>Payment reference</span>
                              <input
                                name="paymentReference"
                                defaultValue={booking.payment_reference ?? ""}
                                placeholder="Optional reference"
                              />
                            </label>
                          </div>

                          <label className="field">
                            <span>Payment link</span>
                            <textarea
                              name="paymentLink"
                              defaultValue={booking.payment_link ?? ""}
                              rows={2}
                            />
                          </label>

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
                              defaultValue={
                                booking.customer_visible_admin_message ?? ""
                              }
                              placeholder="Used for route offers, booking decisions, or customer updates."
                            />
                          </label>

                          <label className="choice-card">
                            <input type="checkbox" name="sendRouteEmail" />
                            <span>Send route confirmation email after saving</span>
                          </label>

                          <div className="admin-action-cluster">
                            <ActionSubmitButton pendingLabel="Saving...">
                              Save Booking
                            </ActionSubmitButton>

                            <ActionSubmitButton
                              className="button button-outline"
                              name="bookingDecision"
                              pendingLabel="Accepting..."
                              value="accept"
                            >
                              Accept
                            </ActionSubmitButton>

                            <ActionSubmitButton
                              className="button button-outline"
                              name="bookingDecision"
                              pendingLabel="Marking..."
                              value="needs_more_info"
                            >
                              Need Info
                            </ActionSubmitButton>

                            <ActionSubmitButton
                              className="button button-outline"
                              name="bookingDecision"
                              pendingLabel="Offering..."
                              value="offer_route"
                            >
                              Offer Route Date
                            </ActionSubmitButton>

                            <ActionSubmitButton
                              className="button button-outline"
                              name="bookingDecision"
                              pendingLabel="Declining..."
                              value="decline"
                            >
                              Decline
                            </ActionSubmitButton>
                          </div>
                        </FeedbackForm>
                      </section>

                      <section className="detail-panel">
                        <h2>Quick actions</h2>
                        <p className="muted">
                          These actions send emails or open related records. Each action
                          should show success or failure feedback.
                        </p>

                        <div className="admin-action-list">
                          <QuickActionForm
                            action={sendPaymentLinkAction}
                            bookingId={booking.id}
                            label="Send Payment Link"
                            pendingLabel="Sending..."
                            successMessage="Payment link email sent."
                          />

                          <QuickActionForm
                            action={sendPaymentSetupInviteAction}
                            bookingId={booking.id}
                            label="Send Payment Setup"
                            pendingLabel="Sending..."
                            successMessage="Payment setup invite sent."
                          />

                          <QuickActionForm
                            action={sendReviewRequestAction}
                            bookingId={booking.id}
                            label="Send Review Request"
                            pendingLabel="Sending..."
                            successMessage="Review request sent."
                          />
                        </div>

                        <div className="admin-secondary-links">
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

                        <details className="technical-details">
                          <summary>Technical details</summary>
                          <div className="admin-data-grid">
                            <InfoTile
                              label="Payment records"
                              value={String(bookingPayments.length)}
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
                              label="Payment intent"
                              value={
                                latestPayment?.stripe_payment_intent_id ??
                                booking.stripe_payment_intent_id ??
                                "None"
                              }
                            />
                            <InfoTile
                              label="Subscription"
                              value={
                                latestPayment?.stripe_subscription_id ??
                                booking.stripe_subscription_id ??
                                "None"
                              }
                            />
                            <InfoTile
                              label="Stripe customer"
                              value={
                                booking.stripe_customer_id ??
                                latestPayment?.stripe_customer_id ??
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
            <h2>No booking requests match this view.</h2>
            <p>
              Try clearing filters, checking another status, or waiting for new
              booking requests to arrive.
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

function getBookingNextAction(booking: BookingRow) {
  if (booking.payment_status === "failed") {
    return { label: "Payment failed", tone: "danger" as const };
  }

  if (booking.payment_status !== "paid" && !booking.payment_link) {
    return { label: "Send payment link", tone: "warning" as const };
  }

  if (booking.payment_status !== "paid") {
    return { label: "Waiting on payment", tone: "warning" as const };
  }

  if (!booking.confirmed_route_day && !["cancelled", "completed"].includes(booking.status)) {
    return { label: "Add to route", tone: "warning" as const };
  }

  if (booking.status === "new") {
    return { label: "Review booking", tone: "warning" as const };
  }

  if (booking.status === "needs_follow_up") {
    return { label: "Follow up", tone: "danger" as const };
  }

  if (booking.status === "cancelled") {
    return { label: "Cancelled", tone: "neutral" as const };
  }

  if (booking.status === "completed") {
    return { label: "Completed", tone: "good" as const };
  }

  return { label: "Looks okay", tone: "good" as const };
}

function getBookingPriority(booking: BookingRow) {
  const isTerminal = ["cancelled", "completed"].includes(booking.status);

  if (booking.status === "new") return 10;
  if (booking.status === "needs_follow_up") return 20;

  if (!isTerminal && booking.payment_status === "failed") return 30;

  if (
    !isTerminal &&
    booking.payment_status !== "paid" &&
    !booking.payment_link
  ) {
    return 40;
  }

  if (!isTerminal && booking.payment_status !== "paid") return 50;

  if (!isTerminal && !booking.confirmed_route_day) return 60;

  if (booking.status === "scheduled" || booking.status === "confirmed") return 70;
  if (booking.status === "completed") return 90;
  if (booking.status === "cancelled") return 100;

  return 80;
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
      if (params.needs === "new") return booking.status === "new";
      if (params.needs === "needs_payment") {
        return booking.payment_status !== "paid" && booking.status !== "cancelled";
      }
      if (params.needs === "needs_payment_link") {
        return booking.payment_status !== "paid" && !booking.payment_link;
      }
      if (params.needs === "needs_route") {
        return (
          !booking.confirmed_route_day &&
          !["cancelled", "completed"].includes(booking.status)
        );
      }
      if (params.needs === "needs_follow_up") {
        return booking.status === "needs_follow_up";
      }
      if (params.needs === "payment_failed") {
        return booking.payment_status === "failed";
      }
      return true;
    })
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
      const sortMode = params.sort || "needs_action";

      if (sortMode === "oldest") return a.created_at.localeCompare(b.created_at);

      if (sortMode === "route_day") {
        return (a.confirmed_route_day ?? "9999").localeCompare(
          b.confirmed_route_day ?? "9999",
        );
      }

      if (sortMode === "neighborhood") {
        return (a.neighborhood ?? "").localeCompare(b.neighborhood ?? "");
      }

      if (sortMode === "customer_name") {
        return bookingCustomerName(a).localeCompare(bookingCustomerName(b));
      }

      if (sortMode === "price_high") return b.estimated_price - a.estimated_price;

      const priorityDifference = getBookingPriority(a) - getBookingPriority(b);
      if (priorityDifference !== 0) return priorityDifference;

      return b.created_at.localeCompare(a.created_at);
    });
}

function foundingSpecialLabel(
  status: "eligible" | "applied" | "manual_override" | "not_eligible",
) {
  if (status === "applied") return "Applied";
  if (status === "manual_override") return "Manual override";
  if (status === "eligible") return "Eligible";
  return "Not eligible";
}