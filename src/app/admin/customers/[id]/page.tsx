import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { updateCustomerProfileAdminAction } from "@/app/admin/actions";
import { AdminCustomerEmailForm } from "@/components/admin-customer-email-form";
import { AdminCustomerAccountControls } from "@/components/admin-customer-account-controls";
import { AdminShell } from "@/components/shells/admin-shell";
import { humanizeStatus } from "@/lib/booking-utils";
import { getAdminContext } from "@/lib/admin-data";
import {
  fullName,
  getCustomerBookings,
  getCustomerReferrals,
  getCustomerRequests,
  getPrimaryAddress,
  unpaidBalance,
} from "@/lib/admin-operations";
import {
  formatFrequency,
  getFoundingNeighborSpecialStatus,
} from "@/lib/pricing";
import type { BookingRow } from "@/types/database";

export const metadata: Metadata = {
  title: "Customer Detail",
};

type CustomerDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function CustomerDetailPage({
  params,
}: CustomerDetailPageProps) {
  const { id } = await params;
  const context = await getAdminContext(`/admin/customers/${id}`);
  const profile = context.profiles.find((item) => item.id === id);

  if (!profile) {
    return (
      <AdminShell title="Customer detail" auth={context.auth}>
        <section className="placeholder-panel">
          <p className="section-kicker">Customer</p>
          <h1>Customer not found.</h1>
          <Link className="button button-dark" href="/admin/customers">
            Back to Customers
          </Link>
        </section>
      </AdminShell>
    );
  }

  const bookings = getCustomerBookings(profile.id, context.bookings);
  const requests = getCustomerRequests(profile.id, context.requests);
  const deletionRequests = context.deletionRequests.filter(
    (request) => request.customer_id === profile.id,
  );
  const referrals = getCustomerReferrals(profile.id, context.referrals);
  const addresses = context.addresses.filter(
    (address) => address.customer_id === profile.id,
  );
  const primaryAddress = getPrimaryAddress(profile.id, context.addresses);
  const visits = context.visits.filter((visit) => visit.customer_id === profile.id);
  const payments = context.payments.filter((payment) => payment.customer_id === profile.id);
  const photos = context.photos.filter((photo) => photo.customer_id === profile.id);
  const routeStops = context.routeStops.filter((stop) =>
    bookings.some((booking) => booking.id === stop.booking_id),
  );
  const checklists = context.checklists.filter((checklist) =>
    visits.some((visit) => visit.id === checklist.service_visit_id),
  );
  const serviceEvents = context.serviceEvents.filter((event) =>
    bookings.some((booking) => booking.id === event.booking_id),
  );
  const notificationEvents = context.notificationEvents.filter(
    (event) => event.recipient_profile_id === profile.id,
  );
  const activity = context.activity.filter(
    (event) =>
      event.customer_id === profile.id ||
      bookings.some((booking) => booking.id === event.booking_id),
  );
  const auditLogs = context.auditLogs.filter(
    (event) =>
      event.customer_id === profile.id ||
      bookings.some((booking) => booking.id === event.booking_id),
  );

  return (
    <AdminShell title="Customer detail" auth={context.auth}>
      <section className="placeholder-panel">
        <div className="admin-page-heading">
          <div>
            <p className="section-kicker">Customer Detail</p>
            <h1>{fullName(profile)}</h1>
            <p className="muted">
              {profile.email ?? "No email"} | {profile.phone ?? "No phone"}
            </p>
          </div>
          <div className="status-stack">
            <span className={`status-badge status-${profile.role}`}>
              {humanizeStatus(profile.role)}
            </span>
            <span className="status-badge">
              ${unpaidBalance(bookings)} unpaid
            </span>
            <span className="status-badge">
              {profile.payment_method_on_file
                ? "Payment method on file"
                : "No payment method on file"}
            </span>
          </div>
        </div>

        <form action={updateCustomerProfileAdminAction} className="form-section">
          <input type="hidden" name="profileId" value={profile.id} />
          <input
            type="hidden"
            name="serviceAddressId"
            value={primaryAddress?.id ?? ""}
          />
          <h2>Profile and account settings</h2>
          <div className="form-grid">
            <label className="field">
              <span>First name</span>
              <input name="firstName" defaultValue={profile.first_name ?? ""} />
            </label>
            <label className="field">
              <span>Last name</span>
              <input name="lastName" defaultValue={profile.last_name ?? ""} />
            </label>
            <label className="field">
              <span>Phone</span>
              <input name="phone" defaultValue={profile.phone ?? ""} />
            </label>
            <label className="field">
              <span>Email</span>
              <span className="readonly-field-value">
                {profile.email ?? "No email"}
              </span>
            </label>
            <label className="field">
              <span>Preferred contact</span>
              <select
                name="preferredContactMethod"
                defaultValue={profile.preferred_contact_method ?? "email"}
              >
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="sms">SMS placeholder</option>
              </select>
            </label>
            <label className="field">
              <span>Referral code</span>
              <input value={profile.referral_code ?? "Generated in portal"} readOnly />
            </label>
          </div>
          <div className="choice-grid">
            <label className="choice-card">
              <input
                type="checkbox"
                name="marketingOptIn"
                defaultChecked={profile.marketing_opt_in}
              />
              <span>Marketing opt-in</span>
            </label>
            <label className="choice-card">
              <input
                type="checkbox"
                name="smsOptIn"
                defaultChecked={profile.sms_opt_in}
              />
              <span>SMS opt-in placeholder</span>
            </label>
          </div>
          <h2>Primary service address</h2>
          <div className="form-grid">
            <label className="field">
              <span>Street address</span>
              <input
                name="streetAddress"
                defaultValue={primaryAddress?.street_address ?? ""}
              />
            </label>
            <label className="field">
              <span>City</span>
              <input name="city" defaultValue={primaryAddress?.city ?? "Summerville"} />
            </label>
            <label className="field">
              <span>State</span>
              <input name="state" defaultValue={primaryAddress?.state ?? "SC"} />
            </label>
            <label className="field">
              <span>ZIP</span>
              <input name="zipCode" defaultValue={primaryAddress?.zip_code ?? ""} />
            </label>
            <label className="field">
              <span>Neighborhood</span>
              <input
                name="neighborhood"
                defaultValue={primaryAddress?.neighborhood ?? ""}
              />
            </label>
            <label className="field">
              <span>Gate code</span>
              <input name="gateCode" defaultValue={primaryAddress?.gate_code ?? ""} />
            </label>
          </div>
          <label className="field">
            <span>Address notes</span>
            <textarea
              name="addressNotes"
              defaultValue={primaryAddress?.notes ?? ""}
            />
          </label>
          <label className="field">
            <span>Internal notes</span>
            <textarea
              name="internalNotes"
              defaultValue={profile.internal_notes ?? ""}
            />
          </label>
          <button className="button button-dark" type="submit">
            Save Customer
          </button>
        </form>

        <AdminCustomerEmailForm
          profileId={profile.id}
          currentEmail={profile.email}
          stripeCustomerId={profile.stripe_customer_id}
        />

        <AdminCustomerAccountControls
          profileId={profile.id}
          accountStatus={profile.account_status ?? "active"}
          portalAccessEnabled={profile.portal_access_enabled ?? true}
        />

        <section className="detail-grid">
          <DetailPanel title="Service addresses" empty="No addresses linked.">
            {addresses.map((address) => (
              <article className="mini-record" key={address.id}>
                <strong>{address.street_address}</strong>
                <span>
                  {address.city}, {address.state} {address.zip_code}
                </span>
                <span>{address.neighborhood ?? "Neighborhood pending"}</span>
              </article>
            ))}
          </DetailPanel>

          <DetailPanel title="Bookings" empty="No bookings linked.">
            {bookings.map((booking) => (
              <BookingMiniRecord booking={booking} key={booking.id} />
            ))}
          </DetailPanel>

          <DetailPanel title="Payment history" empty="No payment records.">
            {(payments.length
              ? payments.map((payment) => (
                  <article className="mini-record" key={payment.id}>
                    <strong>${payment.amount}</strong>
                    <span>{humanizeStatus(payment.status)}</span>
                    <span>{payment.provider}</span>
                    {payment.checkout_url ? <a href={payment.checkout_url}>Checkout link</a> : null}
                  </article>
                ))
              : bookings.map((booking) => (
                  <article className="mini-record" key={booking.id}>
                    <strong>${booking.estimated_price}</strong>
                    <span>{humanizeStatus(booking.payment_status)}</span>
                    <span>
                      Payment setup:{" "}
                      {booking.payment_method_on_file
                        ? "method on file"
                        : humanizeStatus(
                            booking.payment_setup_status ?? "not_started",
                          )}
                    </span>
                    {booking.stripe_customer_id ? (
                      <span>Stripe customer: {booking.stripe_customer_id}</span>
                    ) : null}
                    <span>{booking.payment_method ?? "No method recorded"}</span>
                  </article>
                )))}
          </DetailPanel>

          <DetailPanel title="Service visits" empty="No service visits yet.">
            {visits.map((visit) => (
              <article className="mini-record" key={visit.id}>
                <strong>{visit.route_day ?? "Route day pending"}</strong>
                <span>{humanizeStatus(visit.status)}</span>
                <span>
                  {visit.completed_at
                    ? `Completed ${formatDateTime(visit.completed_at)}`
                    : "Not completed"}
                </span>
                <span>{visit.technician_notes ?? "No technician notes"}</span>
                <Link href={`/field/stops/${visit.id}`}>Open field stop</Link>
              </article>
            ))}
          </DetailPanel>

          <DetailPanel title="Route stops" empty="No route stops linked.">
            {routeStops.map((stop) => (
              <article className="mini-record" key={stop.id}>
                <strong>Stop #{stop.stop_order}</strong>
                <span>{humanizeStatus(stop.status)}</span>
                <span>{stop.technician_notes ?? "No route notes"}</span>
              </article>
            ))}
          </DetailPanel>

          <DetailPanel title="Checklist and photos" empty="No field proof yet.">
            {visits.map((visit) => {
              const checklist = checklists.find(
                (item) => item.service_visit_id === visit.id,
              );
              const documents = context.checklistDocuments.filter(
                (document) => document.service_visit_id === visit.id,
              );
              const visitPhotos = photos.filter(
                (photo) => photo.service_visit_id === visit.id,
              );
              return (
                <article className="mini-record" key={visit.id}>
                  <strong>{visit.route_day ?? "Visit"}</strong>
                  <span>
                    Checklist:{" "}
                    {checklist?.service_completed ? "completed" : "not complete"}
                  </span>
                  <span>
                    {visitPhotos.filter((photo) => photo.photo_type === "before").length} before /{" "}
                    {visitPhotos.filter((photo) => photo.photo_type === "after").length} after
                  </span>
                  <span>{documents.length} checklist PDF(s)</span>
                  <Link href={`/admin/checklists/${visit.id}`}>Open checklist</Link>
                </article>
              );
            })}
          </DetailPanel>

          <DetailPanel title="Customer requests" empty="No requests yet.">
            {requests.map((request) => (
              <article className="mini-record" key={request.id}>
                <strong>{humanizeStatus(request.request_type)}</strong>
                <span>{humanizeStatus(request.status)}</span>
                <span>{request.message ?? "No message"}</span>
              </article>
            ))}
          </DetailPanel>

          <DetailPanel title="Account deletion requests" empty="No deletion requests.">
            {deletionRequests.map((request) => (
              <article className="mini-record" key={request.id}>
                <strong>{humanizeStatus(request.status)}</strong>
                <span>{request.request_reason ?? "No reason provided"}</span>
                <span>{formatDateTime(request.created_at)}</span>
                {request.admin_note ? <span>Internal note saved</span> : null}
              </article>
            ))}
          </DetailPanel>

          <DetailPanel title="Referral activity" empty="No referral activity yet.">
            {referrals.map((referral) => (
              <article className="mini-record" key={referral.id}>
                <strong>{referral.referral_code ?? "No code"}</strong>
                <span>{humanizeStatus(referral.status)}</span>
                <span>{referral.referred_email ?? "No referred email"}</span>
              </article>
            ))}
          </DetailPanel>

          <DetailPanel title="Activity log" empty="No activity events yet.">
            {activity.slice(0, 12).map((event) => (
              <article className="mini-record" key={event.id}>
                <strong>{humanizeStatus(event.event_type)}</strong>
                <span>{event.message}</span>
                <span>{formatDateTime(event.created_at)}</span>
              </article>
            ))}
          </DetailPanel>

          <DetailPanel title="Admin audit history" empty="No admin audit records yet.">
            {auditLogs.slice(0, 12).map((event) => (
              <article className="mini-record" key={event.id}>
                <strong>{humanizeStatus(event.action)}</strong>
                <span>{humanizeStatus(event.status)}</span>
                <span>{formatDateTime(event.created_at)}</span>
                {event.request_id ? <span>Request {event.request_id}</span> : null}
                {event.note ? <span>{event.note}</span> : null}
              </article>
            ))}
          </DetailPanel>

          <DetailPanel title="Service events" empty="No service events yet.">
            {serviceEvents.slice(0, 12).map((event) => (
              <article className="mini-record" key={event.id}>
                <strong>{humanizeStatus(event.event_type)}</strong>
                <span>{event.message}</span>
                <span>{formatDateTime(event.created_at)}</span>
              </article>
            ))}
          </DetailPanel>

          <DetailPanel title="Notifications" empty="No notifications yet.">
            {notificationEvents.slice(0, 12).map((event) => (
              <article className="mini-record" key={event.id}>
                <strong>{humanizeStatus(event.template_key)}</strong>
                <span>{humanizeStatus(event.status)}</span>
                <span>{formatDateTime(event.created_at)}</span>
              </article>
            ))}
          </DetailPanel>
        </section>
      </section>
    </AdminShell>
  );
}

function DetailPanel({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);

  return (
    <article className="detail-panel">
      <h2>{title}</h2>
      {hasChildren ? children : <p className="muted">{empty}</p>}
    </article>
  );
}

function BookingMiniRecord({ booking }: { booking: BookingRow }) {
  const foundingSpecial = getFoundingNeighborSpecialStatus({
    binCount: booking.bin_count,
    frequency: booking.frequency,
    addOns: booking.add_ons,
    neighborhood: booking.neighborhood,
    createdAt: booking.created_at,
    estimatedPrice: booking.estimated_price,
  });

  return (
    <article className="mini-record">
      <strong>{formatFrequency(booking.frequency)}</strong>
      <span>
        {humanizeStatus(booking.status)} | ${booking.estimated_price}
      </span>
      <span>{booking.confirmed_route_day ?? "Route day pending"}</span>
      <span>
        Founding Neighbor Special:{" "}
        {foundingSpecial.status === "applied"
          ? "Applied"
          : foundingSpecial.status === "eligible"
            ? "Eligible"
            : "Not eligible"}
      </span>
      <span>{foundingSpecial.reason}</span>
      <Link href={`/admin/bookings?q=${booking.id}`}>Open booking</Link>
    </article>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
