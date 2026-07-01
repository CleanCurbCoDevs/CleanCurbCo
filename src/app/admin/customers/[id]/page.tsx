import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { updateCustomerProfileAdminAction } from "@/app/admin/actions";
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
import { formatFrequency } from "@/lib/pricing";

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
  const referrals = getCustomerReferrals(profile.id, context.referrals);
  const addresses = context.addresses.filter(
    (address) => address.customer_id === profile.id,
  );
  const primaryAddress = getPrimaryAddress(profile.id, context.addresses);
  const visits = context.visits.filter((visit) => visit.customer_id === profile.id);
  const activity = context.activity.filter(
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
              <input value={profile.email ?? "No email"} readOnly />
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
              <article className="mini-record" key={booking.id}>
                <strong>{formatFrequency(booking.frequency)}</strong>
                <span>
                  {humanizeStatus(booking.status)} | ${booking.estimated_price}
                </span>
                <span>{booking.confirmed_route_day ?? "Route day pending"}</span>
                <Link href={`/admin/bookings?q=${booking.id}`}>Open booking</Link>
              </article>
            ))}
          </DetailPanel>

          <DetailPanel title="Payment history" empty="No payment records.">
            {bookings.map((booking) => (
              <article className="mini-record" key={booking.id}>
                <strong>${booking.estimated_price}</strong>
                <span>{humanizeStatus(booking.payment_status)}</span>
                <span>{booking.payment_method ?? "No method recorded"}</span>
              </article>
            ))}
          </DetailPanel>

          <DetailPanel title="Service visits" empty="No service visits yet.">
            {visits.map((visit) => (
              <article className="mini-record" key={visit.id}>
                <strong>{visit.route_day ?? "Route day pending"}</strong>
                <span>{humanizeStatus(visit.status)}</span>
                <span>{visit.technician_notes ?? "No technician notes"}</span>
              </article>
            ))}
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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
