import type { Metadata } from "next";
import Link from "next/link";
import { updateReferralAdminAction } from "@/app/admin/actions";
import { AdminFilterBar } from "@/components/admin-filter-bar";
import { AdminShell } from "@/components/shells/admin-shell";
import { humanizeStatus, validReferralStatuses } from "@/lib/booking-utils";
import { getAdminContext } from "@/lib/admin-data";
import { bookingCustomerName, fullName, includesSearch } from "@/lib/admin-operations";
import type { BookingRow, ProfileRow, ReferralRow } from "@/types/database";

export const metadata: Metadata = {
  title: "Admin Referrals",
};

type AdminReferralsPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function AdminReferralsPage({
  searchParams,
}: AdminReferralsPageProps) {
  const params = await searchParams;
  const context = await getAdminContext("/admin/referrals");
  const referrals = filterReferrals(
    context.referrals,
    context.profiles,
    context.bookings,
    params,
  );

  return (
    <AdminShell title="Referrals" auth={context.auth}>
      <section className="placeholder-panel">
        <div className="admin-page-heading">
          <div>
            <p className="section-kicker">Referrals</p>
            <h1>Neighbor referral tracking.</h1>
            <p className="muted">
              Review referral links, qualify rewards, and mark service credits
              when they are ready or sent.
            </p>
          </div>
          <span className="status-badge">{context.referrals.length} total</span>
        </div>

        <AdminFilterBar
          searchValue={params.q}
          searchPlaceholder="Referral code, referrer, referred email, booking ID"
          resultCount={referrals.length}
          resetHref="/admin/referrals"
          selects={[
            {
              name: "status",
              label: "Status",
              value: params.status,
              options: [
                { label: "Any status", value: "" },
                ...validReferralStatuses.map((status) => ({
                  label: humanizeStatus(status),
                  value: status,
                })),
              ],
            },
          ]}
        />

        {referrals.length ? (
          <div className="admin-card-list">
            {referrals.map((referral) => {
              const referrer = context.profiles.find(
                (profile) => profile.id === referral.referrer_profile_id,
              );
              const referredProfile = context.profiles.find(
                (profile) => profile.id === referral.referred_profile_id,
              );
              const booking = context.bookings.find(
                (item) => item.id === referral.referred_booking_id,
              );

              return (
                <form
                  action={updateReferralAdminAction}
                  className="admin-edit-card"
                  key={referral.id}
                >
                  <input type="hidden" name="referralId" value={referral.id} />
                  <div className="admin-row-heading">
                    <div>
                      <h2>{referral.referral_code ?? "Referral code pending"}</h2>
                      <p className="muted">
                        Referrer: {referrer ? fullName(referrer) : "Unlinked"}
                      </p>
                      <p className="muted">
                        Referred:{" "}
                        {referredProfile
                          ? fullName(referredProfile)
                          : referral.referred_email ?? "Email pending"}
                      </p>
                    </div>
                    <span className={`status-badge status-${referral.status}`}>
                      {humanizeStatus(referral.status)}
                    </span>
                  </div>

                  <div className="admin-data-grid">
                    <div>
                      <span>Booking</span>
                      <strong>{booking?.id.slice(0, 8) ?? "No booking"}</strong>
                    </div>
                    <div>
                      <span>Booking status</span>
                      <strong>
                        {booking ? humanizeStatus(booking.status) : "Pending"}
                      </strong>
                    </div>
                    <div>
                      <span>Payment status</span>
                      <strong>
                        {booking ? humanizeStatus(booking.payment_status) : "Pending"}
                      </strong>
                    </div>
                    <div>
                      <span>Reward</span>
                      <strong>
                        ${referral.reward_value ?? 5}{" "}
                        {referral.reward_type ?? "service_credit"}
                      </strong>
                    </div>
                  </div>

                  {booking ? (
                    <p className="muted">
                      Booking customer: {bookingCustomerName(booking)} |{" "}
                      {booking.street_address}
                    </p>
                  ) : null}

                  <div className="form-grid">
                    <label className="field">
                      <span>Referral status</span>
                      <select name="status" defaultValue={referral.status}>
                        {validReferralStatuses.map((status) => (
                          <option value={status} key={status}>
                            {humanizeStatus(status)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="choice-card">
                      <input type="checkbox" name="sendRewardEmail" />
                      <span>Send referral reward email</span>
                    </label>
                  </div>
                  <label className="field">
                    <span>Admin notes</span>
                    <textarea
                      name="adminNotes"
                      defaultValue={referral.admin_notes ?? ""}
                    />
                  </label>

                  <div className="action-row">
                    <button className="button button-dark" type="submit">
                      Save Referral
                    </button>
                    {referrer ? (
                      <Link
                        className="button button-outline"
                        href={`/admin/customers/${referrer.id}`}
                      >
                        View Referrer
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
          <p>No referrals match those filters.</p>
        )}
      </section>
    </AdminShell>
  );
}

function filterReferrals(
  referrals: ReferralRow[],
  profiles: ProfileRow[],
  bookings: BookingRow[],
  params: Record<string, string | undefined>,
) {
  const query = params.q?.trim() ?? "";

  return referrals
    .filter((referral) => !params.status || referral.status === params.status)
    .filter((referral) => {
      const referrer = profiles.find(
        (profile) => profile.id === referral.referrer_profile_id,
      );
      const referredProfile = profiles.find(
        (profile) => profile.id === referral.referred_profile_id,
      );
      const booking = bookings.find(
        (item) => item.id === referral.referred_booking_id,
      );
      return includesSearch(
        [
          referral.referral_code,
          referral.referred_email,
          referrer ? fullName(referrer) : "",
          referrer?.email,
          referredProfile ? fullName(referredProfile) : "",
          booking?.id,
          booking?.email,
          booking?.street_address,
        ],
        query,
      );
    });
}
