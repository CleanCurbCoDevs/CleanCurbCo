import type {
  BookingRow,
  CustomerRequestRow,
  ProfileRow,
  ReferralRow,
  ServiceFrequency,
  ServiceAddressRow,
} from "@/types/database";

export function fullName(profile: Pick<ProfileRow, "first_name" | "last_name" | "email">) {
  return (
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    profile.email ||
    "Customer"
  );
}

export function bookingCustomerName(booking: Pick<BookingRow, "first_name" | "last_name" | "email">) {
  return [booking.first_name, booking.last_name].filter(Boolean).join(" ") || booking.email;
}

export function includesSearch(haystack: Array<string | null | undefined>, query: string) {
  if (!query) return true;
  const normalized = query.toLowerCase();
  return haystack.some((value) => (value ?? "").toLowerCase().includes(normalized));
}

export function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean) as string[])).sort((a, b) =>
    a.localeCompare(b),
  );
}

export function createdThisMonth(createdAt: string) {
  const date = new Date(createdAt);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export function createdThisWeek(createdAt: string) {
  const date = new Date(createdAt).getTime();
  const now = Date.now();
  return now - date <= 7 * 24 * 60 * 60 * 1000;
}

export function getPrimaryAddress(profileId: string, addresses: ServiceAddressRow[]) {
  return (
    addresses.find((address) => address.customer_id === profileId && address.is_primary) ??
    addresses.find((address) => address.customer_id === profileId) ??
    null
  );
}

export function getCustomerBookings(profileId: string, bookings: BookingRow[]) {
  return bookings.filter((booking) => booking.customer_id === profileId);
}

export function getCustomerReferrals(profileId: string, referrals: ReferralRow[]) {
  return referrals.filter(
    (referral) =>
      referral.referrer_profile_id === profileId ||
      referral.referred_profile_id === profileId,
  );
}

export function getCustomerRequests(profileId: string, requests: CustomerRequestRow[]) {
  return requests.filter((request) => request.customer_id === profileId);
}

export function estimatedRevenue(bookings: BookingRow[]) {
  return bookings.reduce((total, booking) => total + booking.estimated_price, 0);
}

export function unpaidBalance(bookings: BookingRow[]) {
  return bookings
    .filter((booking) => booking.payment_status !== "paid" && booking.payment_status !== "refunded")
    .reduce((total, booking) => total + booking.estimated_price, 0);
}

export function currentFrequency(bookings: BookingRow[]): ServiceFrequency | "none" {
  const recurring = bookings.find((booking) => booking.frequency !== "one_time");
  return recurring?.frequency ?? bookings[0]?.frequency ?? "none";
}
