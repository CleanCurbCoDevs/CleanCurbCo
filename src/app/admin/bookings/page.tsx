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
import { addOns } from "@/lib/site";
import type { ActionResult } from "@/lib/action-result";
import type { BookingRow } from "@/types/database";

export const metadata: Metadata = {
  title: "Admin Bookings",
};

type AdminBookingsPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

type BookingGroupView = "service" | "collection";
type BookingTone = "good" | "warning" | "danger" | "neutral";

type BookingGroup = {
  key: string;
  label: string;
  bookings: BookingRow[];
  customerCount: number;
  binCount: number;
  tone: BookingTone;
  statusLabel: string;
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
  
  const viewMode: BookingGroupView =
    params.view === "collection" ? "collection" : "service";
  
  const bookings = filterAndSortBookings(context.bookings, params);
  const bookingGroups = groupBookings(bookings, viewMode);

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

        <nav
          className="booking-view-switch"
          aria-label="Booking grouping"
        >
          <Link
            className={
              viewMode === "service"
                ? "booking-view-link is-active"
                : "booking-view-link"
            }
            href="/admin/bookings?view=service"
          >
            Upcoming service
          </Link>
        
          <Link
            className={
              viewMode === "collection"
                ? "booking-view-link is-active"
                : "booking-view-link"
            }
            href="/admin/bookings?view=collection"
          >
            Collection schedule
          </Link>
        </nav>

        <details className="admin-filter-drawer">
          <summary>Search &amp; filters</summary>
        
        <AdminFilterBar
          searchValue={params.q}
          searchPlaceholder="Customer, email, phone, address, booking ID"
          resultCount={bookings.length}
          resetHref={`/admin/bookings?view=${viewMode}`}
            hiddenFields={{ view: viewMode }}
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
      </details>
      {bookings.length ? (
        <div className="booking-group-list">
          {bookingGroups.map((group) => (
            <details
              className={`booking-group booking-tone-${group.tone}`}
              key={group.key}
              name="booking-groups"
            >
              <summary className="booking-group-summary">
                <span className="booking-group-heading">
                  <strong>{group.label}</strong>
                  <small>
                    {group.customerCount}{" "}
                    {group.customerCount === 1 ? "customer" : "customers"}
                    {" · "}
                    {group.binCount} {group.binCount === 1 ? "bin" : "bins"}
                  </small>
                </span>
      
                <span className="booking-group-status">
                  {group.statusLabel}
                </span>
              </summary>
      
              <div className="admin-queue-list booking-group-customers">
                {group.bookings.map((booking) => {
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

              const routeStop = context.routeStops.find(
                (item) => item.booking_id === booking.id,
              );
              
              const routeDay = context.routeDays.find(
                (item) => item.id === routeStop?.route_day_id,
              );
              
              const assignedTechnician = context.profiles.find(
                (item) => item.id === routeDay?.assigned_technician_id,
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
                <details
                  className={`admin-queue-card booking-tone-${nextAction.tone}`}
                  key={booking.id}
                  name={`booking-${group.key}`}
                >
                  <summary className="admin-queue-summary admin-booking-row">
                    <strong className="admin-booking-name">
                      {bookingCustomerName(booking)}
                    </strong>
                
                    <span className="admin-booking-summary">
                      {formatBookingRowSummary(booking)}
                    </span>
                
                    <span className="admin-booking-status">
                      {nextAction.label}
                    </span>
                  </summary>

                  <div className="admin-queue-detail">
                    <div className="admin-record-overview">
                      <InfoTile
                        label="Next action"
                        value={nextAction.label}
                      />
                  
                      <InfoTile
                        label="Why"
                        value={nextAction.reason}
                      />
                  
                      <InfoTile
                        label="Customer"
                        value={bookingCustomerName(booking)}
                      />
                    
                      <InfoTile
                        label="Email"
                        value={booking.email}
                      />
                    
                      <InfoTile
                        label="Phone"
                        value={booking.phone}
                      />
                    
                      <InfoTile
                        label="Full service address"
                        value={[
                          booking.street_address,
                          booking.city,
                          [booking.state, booking.zip_code]
                            .filter(Boolean)
                            .join(" "),
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      />
                    
                      <InfoTile
                        label="Neighborhood"
                        value={booking.neighborhood ?? "Not provided"}
                      />
                    
                      <InfoTile
                        label="Frequency"
                        value={formatFrequency(booking.frequency)}
                      />
                    
                      <InfoTile
                        label="Number of bins"
                        value={String(booking.bin_count)}
                      />
                    
                      <InfoTile
                        label="Bin types"
                        value={
                          booking.bin_types.length
                            ? booking.bin_types.join(", ")
                            : "Not provided"
                        }
                      />
                    
                      <InfoTile
                        label="Add-ons"
                        value={formatBookingAddOns(booking.add_ons)}
                      />
                    
                      <InfoTile
                        label="Estimated price"
                        value={`$${Number(booking.estimated_price).toFixed(2)}`}
                      />
                    
                      <InfoTile
                        label="Scheduling preference"
                        value={humanizeStatus(booking.scheduling_preference)}
                      />
                    
                      <InfoTile
                        label="Customer-requested date"
                        value={
                          booking.requested_date
                            ? formatAdminDate(booking.requested_date)
                            : "No specific date requested"
                        }
                      />
                    
                      <InfoTile
                        label="Regular trash collection day"
                        value={
                          booking.collection_day
                            ? humanizeStatus(booking.collection_day)
                            : "Not captured on original booking"
                        }
                      />
                      
                    <InfoTile
                      label="Typical collection time"
                      value={
                        booking.collection_time_window
                          ? formatCollectionWindow(booking.collection_time_window)
                          : "Not captured on original booking"
                      }
                    />
                    
                    <InfoTile
                      label="Preferred cleaning timing"
                      value={humanizeStatus(booking.same_day_preference)}
                    />
                    
                    <InfoTile
                      label="Suggested service date"
                      value={
                        booking.suggested_service_date
                          ? formatAdminDate(booking.suggested_service_date)
                          : "Needs scheduling"
                      }
                    />
                    
                    <InfoTile
                      label="Earliest safe service time"
                      value={
                        booking.earliest_safe_service_time
                          ? formatAdminTime(booking.earliest_safe_service_time)
                          : "Needs review"
                      }
                    />
                      <InfoTile
                        label="Confirmed route day"
                        value={
                          booking.confirmed_route_day
                            ? formatAdminDate(booking.confirmed_route_day)
                            : "Not assigned"
                        }
                      />
                      <InfoTile
                        label="Assigned route"
                        value={
                          routeDay
                            ? routeDay.route_name ??
                              `${formatAdminDate(routeDay.route_date)} route`
                            : "Not assigned"
                        }
                      />
                      
                      <InfoTile
                        label="Route position"
                        value={
                          routeStop
                            ? `Stop ${routeStop.stop_order}`
                            : booking.route_position
                              ? `Stop ${booking.route_position}`
                              : "Not assigned"
                        }
                      />
                      
                      <InfoTile
                        label="Assigned technician"
                        value={
                          assignedTechnician
                            ? formatProfileName(assignedTechnician)
                            : "Unassigned"
                        }
                      />
                      
                      <InfoTile
                        label="Internal attention status"
                        value={humanizeStatus(booking.attention_status)}
                      />
                      
                      <InfoTile
                        label="Approval status"
                        value={humanizeStatus(booking.approval_status)}
                      />
                      
                      <InfoTile
                        label="Review reason"
                        value={booking.manual_review_reason ?? "None"}
                      />
                      
                      <InfoTile
                        label="Where bins will be"
                        value={booking.bin_location ?? "Not provided"}
                      />
                    
                      <InfoTile
                        label="Exterior water spigot"
                        value={
                          booking.water_spigot_available
                            ? humanizeStatus(booking.water_spigot_available)
                            : "Not provided"
                        }
                      />
                    
                      <InfoTile
                        label="Customer notes"
                        value={booking.customer_notes ?? "None"}
                      />
                    
                      <InfoTile
                        label="Referral code"
                        value={booking.referral_code ?? "None"}
                      />
                    
                      <InfoTile
                        label="Distance from hub"
                        value={
                          booking.service_distance_miles !== null
                            ? `${Number(booking.service_distance_miles).toFixed(1)} miles`
                            : "Not calculated on original booking"
                        }
                      />
                    
                      <InfoTile
                        label="Payment status"
                        value={humanizeStatus(booking.payment_status)}
                      />
                    
                      <InfoTile
                        label="Payment link"
                        value={
                          booking.payment_link
                            ? "Created and attached"
                            : "Not created"
                        }
                      />
                    
                      <InfoTile
                        label="Booking submitted"
                        value={formatAdminDateTime(booking.created_at)}
                      />
                    
                      <InfoTile
                        label="Promotion / special"
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
                          <a
                            className="button button-outline"
                            href={googleMapsHref(booking)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open in Google Maps
                          </a>
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
          </details>
        ))}
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

function formatBookingAddOns(addOnIds: string[]) {
  if (!addOnIds.length) {
    return "None";
  }

  return addOnIds
    .map(
      (id) =>
        addOns.find((addOn) => addOn.id === id)?.name ??
        humanizeStatus(id),
    )
    .join(", ");
}

function formatAdminDate(value: string) {
  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatAdminDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getBookingNextAction(booking: BookingRow): {
  label: string;
  tone: BookingTone;
  reason: string;
} {
  if (
    booking.attention_status === "do_not_service" ||
    booking.approval_status === "declined_internal" ||
    booking.status === "cancelled"
  ) {
    return {
      label: "Do not service",
      tone: "neutral",
      reason:
        booking.manual_review_reason ??
        "This booking is cancelled, inactive, or was declined internally.",
    };
  }

  if (booking.payment_status === "failed") {
    return {
      label: "Payment failed",
      tone: "danger",
      reason:
        booking.payment_failure_message ??
        (booking.payment_failure_code
          ? `Payment provider failure code: ${booking.payment_failure_code}.`
          : "The payment provider reported an unsuccessful transaction attempt."),
    };
  }

  if (booking.payment_verification_status === "rejected") {
    return {
      label: "Payment not verified",
      tone: "danger",
      reason:
        "The reported manual payment could not be verified. Replacement payment is required.",
    };
  }

  if (booking.attention_status === "hold") {
    return {
      label: "Booking on hold",
      tone: "danger",
      reason:
        booking.manual_review_reason ??
        "An administrator placed this booking on hold.",
    };
  }

  if (booking.status === "needs_follow_up") {
    return {
      label: "Follow-up required",
      tone: "danger",
      reason:
        booking.manual_review_reason ??
        "The booking or field visit requires administrator follow-up.",
    };
  }

  if (
    booking.status === "completed" &&
    booking.payment_status !== "paid"
  ) {
    return {
      label: "Payment still due",
      tone: "danger",
      reason:
        "Service is marked completed, but payment has not been confirmed.",
    };
  }

  if (
    booking.attention_status === "review" ||
    booking.approval_status === "pending_review" ||
    booking.approval_status === "needs_review" ||
    booking.status === "new"
  ) {
    return {
      label: "Needs review",
      tone: "warning",
      reason:
        booking.manual_review_reason ??
        "The booking has not completed administrative review.",
    };
  }

  if (
    booking.payment_verification_status === "awaiting_verification"
  ) {
    return {
      label: "Verify payment",
      tone: "warning",
      reason:
        "A Venmo, Zelle, or other manual payment is awaiting verification.",
    };
  }

  if (
    booking.payment_preference === "cash_in_person" &&
    booking.payment_due_at_service &&
    booking.payment_status !== "paid"
  ) {
    return {
      label: "Collect in person",
      tone: "warning",
      reason:
        "The customer chose to pay the technician during the service visit.",
    };
  }

  if (booking.status === "completed") {
    return {
      label: "Completed",
      tone: "good",
      reason: "Service and payment are complete.",
    };
  }

  if (booking.payment_status !== "paid") {
    return {
      label:
        booking.payment_status === "pending"
          ? "Payment pending"
          : "Payment required",
      tone: "warning",
      reason:
        booking.payment_status === "pending"
          ? "Payment has started but is not confirmed yet."
          : "No confirmed payment is attached to this booking.",
    };
  }

  if (!booking.confirmed_route_day) {
    return {
      label: "Needs route",
      tone: "warning",
      reason:
        "Payment is confirmed, but the booking has not been assigned a service date.",
    };
  }

  return {
    label: "Ready",
    tone: "good",
    reason: "Payment, review, and route scheduling are complete.",
  };
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

const collectionDayOrder = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "varies",
  "not_sure",
  "unknown",
];

const collectionWindowOrder = [
  "before_6_am",
  "6_8_am",
  "8_10_am",
  "10_am_12_pm",
  "12_2_pm",
  "2_4_pm",
  "4_6_pm",
  "after_6_pm",
  "varies",
  "not_sure",
];

function groupBookings(
  bookings: BookingRow[],
  viewMode: BookingGroupView,
): BookingGroup[] {
  const grouped = new Map<string, BookingRow[]>();

  for (const booking of bookings) {
    const serviceDate =
      booking.confirmed_route_day ??
      booking.suggested_service_date ??
      booking.requested_date;

    const key =
      viewMode === "collection"
        ? booking.collection_day ?? "unknown"
        : serviceDate
          ? `date:${serviceDate}`
          : "unscheduled";

    const existing = grouped.get(key) ?? [];
    existing.push(booking);
    grouped.set(key, existing);
  }

  return Array.from(grouped.entries())
    .map(([key, groupedBookings]) => {
      const sortedBookings = [...groupedBookings].sort(
        compareGroupedBookings,
      );

      const tones = sortedBookings.map(
        (booking) => getBookingNextAction(booking).tone,
      );

      const tone: BookingTone = tones.includes("danger")
        ? "danger"
        : tones.includes("warning")
          ? "warning"
          : tones.every((item) => item === "neutral")
            ? "neutral"
            : "good";

      const reviewCount = tones.filter(
        (item) => item === "warning",
      ).length;

      const blockedCount = tones.filter(
        (item) => item === "danger",
      ).length;

      return {
        key,
        label: bookingGroupLabel(key, viewMode),
        bookings: sortedBookings,
        customerCount: sortedBookings.length,
        binCount: sortedBookings.reduce(
          (total, booking) => total + booking.bin_count,
          0,
        ),
        tone,
        statusLabel:
        tone === "danger"
          ? `${blockedCount} ${
              blockedCount === 1 ? "blocked booking" : "blocked bookings"
            }`
          : tone === "warning"
            ? `${reviewCount} ${
                reviewCount === 1 ? "booking to review" : "bookings to review"
              }`
              : tone === "neutral"
                ? "Inactive"
                : "Ready",
      };
    })
    .sort((a, b) => compareBookingGroups(a, b, viewMode));
}

function compareGroupedBookings(a: BookingRow, b: BookingRow) {
  const aWindow = collectionWindowOrder.indexOf(
    a.collection_time_window ?? "not_sure",
  );

  const bWindow = collectionWindowOrder.indexOf(
    b.collection_time_window ?? "not_sure",
  );

  if (aWindow !== bWindow) {
    return aWindow - bWindow;
  }

  const aTime = a.earliest_safe_service_time ?? "99:99:99";
  const bTime = b.earliest_safe_service_time ?? "99:99:99";

  if (aTime !== bTime) {
    return aTime.localeCompare(bTime);
  }

  return bookingCustomerName(a).localeCompare(
    bookingCustomerName(b),
  );
}

function compareBookingGroups(
  a: BookingGroup,
  b: BookingGroup,
  viewMode: BookingGroupView,
) {
  if (viewMode === "service") {
    if (a.key === "unscheduled") return 1;
    if (b.key === "unscheduled") return -1;

    return a.key.localeCompare(b.key);
  }

  return (
    collectionDayOrder.indexOf(a.key) -
    collectionDayOrder.indexOf(b.key)
  );
}

function bookingGroupLabel(
  key: string,
  viewMode: BookingGroupView,
) {
  if (viewMode === "service") {
    if (key === "unscheduled") {
      return "Needs scheduling";
    }

    return formatAdminDate(key.replace("date:", ""));
  }

  if (key === "unknown") {
    return "Collection day not captured";
  }

  return `${humanizeStatus(key)} collection`;
}

function formatBookingRowSummary(booking: BookingRow) {
  const time = booking.earliest_safe_service_time
    ? formatAdminTime(booking.earliest_safe_service_time)
    : "Time pending";

  const bins = `${booking.bin_count} ${
    booking.bin_count === 1 ? "bin" : "bins"
  }`;

  return [
    time,
    bins,
    formatFrequency(booking.frequency),
    humanizeStatus(booking.payment_status),
  ].join(" · ");
}

function formatAdminTime(value: string) {
  const [hoursValue, minutesValue] = value
    .split(":")
    .map(Number);

  if (
    !Number.isFinite(hoursValue) ||
    !Number.isFinite(minutesValue)
  ) {
    return value;
  }

  const date = new Date();
  date.setHours(hoursValue, minutesValue, 0, 0);

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatCollectionWindow(value: string) {
  const labels: Record<string, string> = {
    before_6_am: "Before 6:00 AM",
    "6_8_am": "6:00–8:00 AM",
    "8_10_am": "8:00–10:00 AM",
    "10_am_12_pm": "10:00 AM–12:00 PM",
    "12_2_pm": "12:00–2:00 PM",
    "2_4_pm": "2:00–4:00 PM",
    "4_6_pm": "4:00–6:00 PM",
    after_6_pm: "After 6:00 PM",
    varies: "Varies",
    not_sure: "Not sure",
  };

  return labels[value] ?? humanizeStatus(value);
}

function formatProfileName(profile: {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}) {
  return (
    [profile.first_name, profile.last_name]
      .filter(Boolean)
      .join(" ") ||
    profile.email ||
    "Unnamed technician"
  );
}

function googleMapsHref(booking: BookingRow) {
  const address = [
    booking.street_address,
    booking.city,
    booking.state,
    booking.zip_code,
  ]
    .filter(Boolean)
    .join(", ");

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    address,
  )}`;
}

function foundingSpecialLabel(
  status: "eligible" | "applied" | "manual_override" | "not_eligible",
) {
  if (status === "applied") return "Applied";
  if (status === "manual_override") return "Manual override";
  if (status === "eligible") return "Eligible";
  return "Not eligible";
}
