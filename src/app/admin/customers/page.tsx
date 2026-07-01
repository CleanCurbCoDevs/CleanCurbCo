import type { Metadata } from "next";
import Link from "next/link";
import { AdminFilterBar } from "@/components/admin-filter-bar";
import { AdminShell } from "@/components/shells/admin-shell";
import { humanizeStatus } from "@/lib/booking-utils";
import { getAdminContext } from "@/lib/admin-data";
import {
  currentFrequency,
  estimatedRevenue,
  fullName,
  getCustomerBookings,
  getCustomerReferrals,
  getPrimaryAddress,
  includesSearch,
  uniqueValues,
  unpaidBalance,
} from "@/lib/admin-operations";
import { formatFrequency } from "@/lib/pricing";
import type { BookingRow, ProfileRow, ReferralRow, ServiceAddressRow } from "@/types/database";

export const metadata: Metadata = {
  title: "Admin Customers",
};

type AdminCustomersPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

const roleOptions = [
  { label: "Any role", value: "" },
  { label: "Customer", value: "customer" },
  { label: "Admin", value: "admin" },
  { label: "Owner", value: "owner" },
];

const customerFilterOptions = [
  { label: "All customers", value: "" },
  { label: "Has recurring service", value: "recurring" },
  { label: "One-time service only", value: "one_time_only" },
  { label: "Has unpaid booking", value: "unpaid" },
  { label: "Has active booking", value: "active" },
  { label: "Has completed booking", value: "completed" },
  { label: "Has referral activity", value: "referrals" },
  { label: "Created this month", value: "created_this_month" },
];

const sortOptions = [
  { label: "Newest customer", value: "newest" },
  { label: "Oldest customer", value: "oldest" },
  { label: "Name A-Z", value: "name" },
  { label: "Most bookings", value: "bookings" },
  { label: "Highest estimated revenue", value: "revenue" },
  { label: "Unpaid balance", value: "unpaid" },
  { label: "Neighborhood", value: "neighborhood" },
];

export default async function AdminCustomersPage({
  searchParams,
}: AdminCustomersPageProps) {
  const params = await searchParams;
  const context = await getAdminContext("/admin/customers");
  const customers = filterAndSortCustomers(
    context.profiles,
    context.bookings,
    context.addresses,
    context.referrals,
    params,
  );

  return (
    <AdminShell title="Customers" auth={context.auth}>
      <section className="placeholder-panel">
        <div className="admin-page-heading">
          <div>
            <p className="section-kicker">Customers</p>
            <h1>Customer accounts and route history.</h1>
            <p className="muted">
              Find neighbors by contact info, address, service state, and
              referral activity.
            </p>
          </div>
          <span className="status-badge">{context.profiles.length} total</span>
        </div>

        <AdminFilterBar
          searchValue={params.q}
          searchPlaceholder="Name, email, phone, street address, neighborhood"
          resultCount={customers.length}
          resetHref="/admin/customers"
          selects={[
            { name: "role", label: "Role", value: params.role, options: roleOptions },
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
            {
              name: "customerFilter",
              label: "Customer filter",
              value: params.customerFilter,
              options: customerFilterOptions,
            },
            { name: "sort", label: "Sort", value: params.sort, options: sortOptions },
          ]}
        />

        {customers.length ? (
          <div className="data-table admin-table">
            {customers.map((profile) => {
              const bookings = getCustomerBookings(profile.id, context.bookings);
              const address = getPrimaryAddress(profile.id, context.addresses);
              const referrals = getCustomerReferrals(profile.id, context.referrals);
              const current = currentFrequency(bookings);
              const unpaid = unpaidBalance(bookings);

              return (
                <article className="data-row customer-row" key={profile.id}>
                  <div>
                    <strong>{fullName(profile)}</strong>
                    <span>{profile.email ?? "No email"}</span>
                    <span>{profile.phone ?? "No phone"}</span>
                  </div>
                  <div>
                    <strong>{address?.street_address ?? "No address linked"}</strong>
                    <span>{address?.neighborhood ?? "Neighborhood pending"}</span>
                  </div>
                  <div>
                    <span>{bookings.length} bookings</span>
                    <span>
                      {current === "none"
                        ? "No current frequency"
                        : formatFrequency(current)}
                    </span>
                    <span>
                      {unpaid > 0 ? `$${unpaid} unpaid` : "No unpaid balance"}
                    </span>
                  </div>
                  <div>
                    <span className={`status-badge status-${profile.role}`}>
                      {humanizeStatus(profile.role)}
                    </span>
                    <span>{referrals.length} referrals</span>
                    <span>{formatDate(profile.created_at)}</span>
                  </div>
                  <div className="action-row compact-actions">
                    <Link
                      className="button button-dark"
                      href={`/admin/customers/${profile.id}`}
                    >
                      View Detail
                    </Link>
                    <Link
                      className="button button-outline"
                      href={`/admin/bookings?q=${profile.email ?? profile.id}`}
                    >
                      Bookings
                    </Link>
                    <Link
                      className="button button-outline"
                      href={`/admin/payments?q=${profile.email ?? profile.id}`}
                    >
                      Payments
                    </Link>
                    <Link
                      className="button button-outline"
                      href={`/admin/referrals?q=${profile.email ?? profile.id}`}
                    >
                      Referrals
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p>No customer accounts match those filters.</p>
        )}
      </section>
    </AdminShell>
  );
}

function filterAndSortCustomers(
  profiles: ProfileRow[],
  bookings: BookingRow[],
  addresses: ServiceAddressRow[],
  referrals: ReferralRow[],
  params: Record<string, string | undefined>,
) {
  const query = params.q?.trim() ?? "";
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  return profiles
    .filter((profile) => {
      const address = getPrimaryAddress(profile.id, addresses);
      return includesSearch(
        [
          fullName(profile),
          profile.email,
          profile.phone,
          address?.street_address,
          address?.neighborhood,
        ],
        query,
      );
    })
    .filter((profile) => !params.role || profile.role === params.role)
    .filter((profile) => {
      if (!params.neighborhood) return true;
      return getPrimaryAddress(profile.id, addresses)?.neighborhood === params.neighborhood;
    })
    .filter((profile) => {
      const customerBookings = getCustomerBookings(profile.id, bookings);
      const customerReferrals = getCustomerReferrals(profile.id, referrals);
      if (params.customerFilter === "recurring") {
        return customerBookings.some((booking) => booking.frequency !== "one_time");
      }
      if (params.customerFilter === "one_time_only") {
        return (
          customerBookings.length > 0 &&
          customerBookings.every((booking) => booking.frequency === "one_time")
        );
      }
      if (params.customerFilter === "unpaid") {
        return unpaidBalance(customerBookings) > 0;
      }
      if (params.customerFilter === "active") {
        return customerBookings.some((booking) =>
          ["new", "confirmed", "scheduled", "in_progress"].includes(booking.status),
        );
      }
      if (params.customerFilter === "completed") {
        return customerBookings.some((booking) =>
          ["completed", "paid"].includes(booking.status),
        );
      }
      if (params.customerFilter === "referrals") {
        return customerReferrals.length > 0;
      }
      if (params.customerFilter === "created_this_month") {
        return new Date(profile.created_at) >= monthStart;
      }
      return true;
    })
    .sort((a, b) => {
      const aBookings = getCustomerBookings(a.id, bookings);
      const bBookings = getCustomerBookings(b.id, bookings);
      if (params.sort === "oldest") return a.created_at.localeCompare(b.created_at);
      if (params.sort === "name") return fullName(a).localeCompare(fullName(b));
      if (params.sort === "bookings") return bBookings.length - aBookings.length;
      if (params.sort === "revenue") {
        return estimatedRevenue(bBookings) - estimatedRevenue(aBookings);
      }
      if (params.sort === "unpaid") {
        return unpaidBalance(bBookings) - unpaidBalance(aBookings);
      }
      if (params.sort === "neighborhood") {
        return (getPrimaryAddress(a.id, addresses)?.neighborhood ?? "").localeCompare(
          getPrimaryAddress(b.id, addresses)?.neighborhood ?? "",
        );
      }
      return b.created_at.localeCompare(a.created_at);
    });
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
