import type { Metadata } from "next";
import Link from "next/link";
import {
  completeStopAction,
  deleteServicePhotoAction,
  markManualPaidAction,
  readyForNextStopAction,
  saveTechnicianNotesAction,
  sendPaymentLinkFromFieldAction,
  startBreakAction,
  updateStopStatusAction,
  uploadServicePhotosAction,
} from "@/app/field/actions";
import { PaymentLinkButton } from "@/components/payment-link-button";
import { ServiceChecklistPanel } from "@/components/service-checklist-panel";
import { FieldShell } from "@/components/shells/field-shell";
import { formatBookingAddress, humanizeStatus } from "@/lib/booking-utils";
import { getFieldContext } from "@/lib/field-data";
import { ensureServiceChecklistBundle } from "@/lib/service-checklists";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isAdminRole } from "@/lib/supabase/roles";
import type { ServicePhotoRow } from "@/types/database";

export const metadata: Metadata = {
  title: "Field Stop",
};

type FieldStopPageProps = {
  params: Promise<{ visitId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

const issueFlags = [
  ["bin_inaccessible", "Bin inaccessible"],
  ["bins_not_empty", "Bins not empty"],
  ["no_water_access", "No water access"],
  ["hazardous_material", "Hazardous material"],
  ["customer_issue", "Customer issue"],
  ["equipment_issue", "Equipment issue"],
  ["weather_delay", "Weather delay"],
  ["needs_follow_up", "Needs follow-up"],
] as const;

const breakReasons = [
  ["lunch", "Lunch"],
  ["bathroom", "Bathroom"],
  ["tank_empty", "Tank empty"],
  ["tank_refill", "Tank refill"],
  ["equipment_issue", "Equipment issue"],
  ["fuel_stop", "Fuel stop"],
  ["weather_pause", "Weather pause"],
  ["customer_delay", "Customer delay"],
  ["other", "Other"],
] as const;

export default async function FieldStopPage({
  params,
  searchParams,
}: FieldStopPageProps) {
  const [{ visitId }, query] = await Promise.all([params, searchParams]);
  const context = await getFieldContext(`/field/stops/${visitId}`);
  const visit = context.visits.find((item) => item.id === visitId);
  const stop = context.routeStops.find((item) => item.service_visit_id === visitId);
  const booking = context.bookings.find((item) => item.id === visit?.booking_id);
  const routeDay = context.routeDays.find((item) => item.id === stop?.route_day_id);
  const address = context.addresses.find(
    (item) => item.customer_id === booking?.customer_id && item.is_primary,
  );
  const payments = context.payments.filter(
    (item) => item.booking_id === booking?.id || item.service_visit_id === visit?.id,
  );
  const latestPayment = payments[0] ?? null;
  const photos = context.photos.filter((item) => item.route_stop_id === stop?.id);
  const signedPhotos = await createSignedPhotos(photos);
  const serviceChecklistBundle = await createChecklistBundle(visitId);
  const signedChecklistDocuments = serviceChecklistBundle
    ? await createSignedChecklistDocuments(serviceChecklistBundle.documents)
    : [];
  const manualPaymentAllowed =
    context.auth.status === "ok" && isAdminRole(context.auth.profile.role);

  if (!visit || !stop || !booking) {
    return (
      <FieldShell title="Stop Details" auth={context.auth}>
        <section className="field-card">
          <span className="status-badge status-needs_follow_up">Missing Link</span>
          <h2>This stop could not be loaded.</h2>
          <p>Check that the route stop has a service visit and booking attached.</p>
          <Link className="button button-dark" href="/field/today">
            Back to Today
          </Link>
        </section>
      </FieldShell>
    );
  }

  const addressText = formatBookingAddress(booking);
  const encodedAddress = encodeURIComponent(addressText);
  const appleMaps = `https://maps.apple.com/?q=${encodedAddress}`;
  const googleMaps = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
  const beforePhotos = signedPhotos.filter((photo) => photo.photo_type === "before");
  const afterPhotos = signedPhotos.filter((photo) => photo.photo_type === "after");
  const issuePhotos = signedPhotos.filter(
    (photo) => photo.photo_type === "issue" || photo.photo_type === "other",
  );
  const currentPaymentLink = latestPayment?.checkout_url ?? booking.payment_link ?? "";
  const isPaid = (latestPayment?.status ?? booking.payment_status) === "paid";

  return (
    <FieldShell title={`Stop #${stop.stop_order || 1}`} auth={context.auth}>
      <section className="field-card field-summary-card">
        <div className="field-card-top">
          <div className="status-stack">
            <span className={`status-badge status-${stop.status}`}>
              {humanizeStatus(stop.status)}
            </span>
            <span className={`status-badge status-${booking.payment_status}`}>
              {humanizeStatus(booking.payment_status)}
            </span>
          </div>
          <Link className="button button-outline" href="/field/today">
            Today
          </Link>
        </div>
        <h2>
          {booking.first_name} {booking.last_name}
        </h2>
        <p className="field-address">{addressText}</p>
        <div className="field-actions">
          <a className="button button-outline" href={appleMaps} target="_blank" rel="noreferrer">
            Apple Maps
          </a>
          <a className="button button-outline" href={googleMaps} target="_blank" rel="noreferrer">
            Google Maps
          </a>
          <a className="button button-outline" href={`tel:${booking.phone}`}>
            Call
          </a>
          <a className="button button-outline" href={`mailto:${booking.email}`}>
            Email
          </a>
        </div>
        <div className="field-meta-grid">
          <span>Neighborhood: {booking.neighborhood ?? "Not listed"}</span>
          <span>Bins: {booking.bin_count}</span>
          <span>Types: {booking.bin_types.join(", ") || "Not listed"}</span>
          <span>Add-ons: {booking.add_ons.join(", ") || "None"}</span>
          <span>Route day: {routeDay?.route_date ?? visit.route_day ?? "Not set"}</span>
          <span>Arrival: {formatArrivalWindow(visit.arrival_window_start, visit.arrival_window_end)}</span>
          <span>Gate: {address?.gate_code ?? "None"}</span>
          <span>Water: {booking.water_spigot_available ?? "not sure"}</span>
        </div>
        {booking.customer_notes || address?.notes || stop.technician_notes ? (
          <div className="field-note">
            <strong>Notes:</strong>{" "}
            {booking.customer_notes ?? address?.notes ?? stop.technician_notes}
          </div>
        ) : null}
      </section>

      <section className="field-card">
        <p className="section-kicker">Status Actions</p>
        <div className="field-actions">
          <StatusButton visitId={visit.id} status="on_the_way" label="Mark On The Way" />
          <StatusButton visitId={visit.id} status="arrived" label="Mark Arrived Internally" />
          <StatusButton visitId={visit.id} status="in_progress" label="Start Service" />
          <StatusButton visitId={visit.id} status="needs_follow_up" label="Skip / Needs Follow-Up" />
          <StatusButton visitId={visit.id} status="rescheduled" label="Reschedule Request" />
        </div>
        <p className="muted">
          Arrival is tracked internally only. No customer &quot;we are here&quot; message
          is sent yet.
        </p>
      </section>

      <PhotoSection
        actionLabel="Upload Before Photos"
        photos={beforePhotos}
        photoType="before"
        title="Before Photos"
        visitId={visit.id}
      />

      <section className="field-card">
        <p className="section-kicker">Service Checklist</p>
        {serviceChecklistBundle ? (
          <ServiceChecklistPanel
            bundle={serviceChecklistBundle}
            documents={signedChecklistDocuments}
            notice={query.checklist}
            returnTo={`/field/stops/${visit.id}`}
          />
        ) : (
          <p className="muted">Full checklist is not available for this stop yet.</p>
        )}
      </section>

      <PhotoSection
        actionLabel="Upload After Photos"
        photos={afterPhotos}
        photoType="after"
        title="After Photos"
        visitId={visit.id}
      />

      <PhotoSection
        actionLabel="Upload Issue Photos"
        photos={issuePhotos}
        photoType="issue"
        title="Issue / Other Photos"
        visitId={visit.id}
      />

      <section className="field-card">
        <p className="section-kicker">Technician Notes</p>
        <form action={saveTechnicianNotesAction} className="field-form">
          <input type="hidden" name="visitId" value={visit.id} />
          <label>
            Internal notes
            <textarea
              name="technicianNotes"
              defaultValue={stop.technician_notes ?? visit.technician_notes ?? ""}
              placeholder="Bin condition, access notes, anything admin should know."
            />
          </label>
          <div className="field-checklist compact">
            {issueFlags.map(([value, label]) => (
              <label key={value}>
                <input
                  type="checkbox"
                  name="issueFlags"
                  value={value}
                  defaultChecked={stop.issue_flags.includes(value)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <button className="button button-dark" type="submit">
            Save Notes
          </button>
        </form>
      </section>

      <section className="field-card">
        <p className="section-kicker">Payment / Invoice</p>
        <h2>{humanizeStatus(latestPayment?.status ?? booking.payment_status)}</h2>
        <p>
          Estimated service price: <strong>${booking.estimated_price}</strong>
        </p>
        {currentPaymentLink ? (
          <a className="button button-outline" href={currentPaymentLink} target="_blank" rel="noreferrer">
            Open Current Link
          </a>
        ) : null}
        {!isPaid ? (
          <PaymentLinkButton
            addOns={booking.add_ons}
            amount={booking.estimated_price}
            binCount={booking.bin_count}
            bookingId={booking.id}
            existingCheckoutUrl={currentPaymentLink}
            frequency={booking.frequency}
            paymentId={latestPayment?.id}
            paymentType="payment_link"
            returnPath={`/field/stops/${visit.id}`}
            routeStopId={stop.id}
            serviceVisitId={visit.id}
          />
        ) : null}
        <div className="field-actions">
          {!isPaid ? (
            <form action={sendPaymentLinkFromFieldAction}>
              <input type="hidden" name="bookingId" value={booking.id} />
              <input type="hidden" name="visitId" value={visit.id} />
              <input type="hidden" name="routeStopId" value={stop.id} />
              <button className="button button-outline" type="submit">
                Send Payment Email
              </button>
            </form>
          ) : null}
          {!isPaid && manualPaymentAllowed ? (
            <form action={markManualPaidAction} className="field-form inline-payment-form">
              <input type="hidden" name="bookingId" value={booking.id} />
              <input type="hidden" name="visitId" value={visit.id} />
              <input
                name="manualPaymentMethod"
                placeholder="Cash, Zelle, Venmo, check"
              />
              <input name="manualPaymentNotes" placeholder="Optional payment note" />
              <button className="button button-outline" type="submit">
                Mark Manual Paid
              </button>
            </form>
          ) : null}
        </div>
      </section>

      <section className="field-card">
        <p className="section-kicker">End Service</p>
        <h2>Complete this stop.</h2>
        <p>
          This saves completion, marks the visit complete, updates the booking,
          and sends the completion email if email is configured.
        </p>
        <form action={completeStopAction}>
          <input type="hidden" name="visitId" value={visit.id} />
          <button className="button button-primary field-big-button" type="submit">
            End Service / Complete Stop
          </button>
        </form>
        {stop.status === "completed" ? (
          <div className="field-complete-panel">
            <h3>Stop completed</h3>
            <p>Would you like to move to the next stop now?</p>
            <div className="field-actions">
              <form action={readyForNextStopAction}>
                <input type="hidden" name="routeStopId" value={stop.id} />
                <button className="button button-dark" type="submit">
                  Ready for Next Stop
                </button>
              </form>
              <details className="field-break-details">
                <summary className="button button-outline">Take a Break</summary>
                <form action={startBreakAction} className="field-form">
                  <input type="hidden" name="routeDayId" value={stop.route_day_id ?? ""} />
                  <label>
                    Reason
                    <select name="reason" defaultValue="lunch">
                      {breakReasons.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Notes
                    <textarea name="notes" placeholder="Optional break note" />
                  </label>
                  <button className="button button-dark" type="submit">
                    Start Break
                  </button>
                </form>
              </details>
              <Link className="button button-outline" href={`/field/stops/${visit.id}`}>
                Stay Here
              </Link>
            </div>
          </div>
        ) : null}
      </section>
    </FieldShell>
  );
}

function StatusButton({
  visitId,
  status,
  label,
}: {
  visitId: string;
  status: string;
  label: string;
}) {
  return (
    <form action={updateStopStatusAction}>
      <input type="hidden" name="visitId" value={visitId} />
      <input type="hidden" name="status" value={status} />
      <button className="button button-outline" type="submit">
        {label}
      </button>
    </form>
  );
}

function PhotoSection({
  title,
  actionLabel,
  photoType,
  visitId,
  photos,
}: {
  title: string;
  actionLabel: string;
  photoType: "before" | "after" | "issue";
  visitId: string;
  photos: Array<ServicePhotoRow & { signedUrl: string | null }>;
}) {
  return (
    <section className="field-card">
      <p className="section-kicker">{title}</p>
      <form action={uploadServicePhotosAction} className="field-form">
        <input type="hidden" name="visitId" value={visitId} />
        <input type="hidden" name="photoType" value={photoType} />
        <input accept="image/*" capture="environment" multiple name="photos" type="file" />
        <button className="button button-dark" type="submit">
          {actionLabel}
        </button>
      </form>
      {photos.length ? (
        <div className="field-photo-grid">
          {photos.map((photo) => (
            <figure key={photo.id}>
              {photo.signedUrl ? (
                <img alt={`${photo.photo_type} service upload`} src={photo.signedUrl} />
              ) : (
                <div className="field-photo-placeholder">Photo unavailable</div>
              )}
              <form action={deleteServicePhotoAction}>
                <input type="hidden" name="photoId" value={photo.id} />
                <input type="hidden" name="visitId" value={visitId} />
                <button className="link-button destructive" type="submit">
                  Delete / Retry
                </button>
              </form>
            </figure>
          ))}
        </div>
      ) : (
        <p className="muted">No {photoType} photos uploaded yet.</p>
      )}
    </section>
  );
}

async function createSignedPhotos(photos: ServicePhotoRow[]) {
  const admin = getSupabaseAdmin();
  return Promise.all(
    photos.map(async (photo) => {
      const { data } = await admin.storage
        .from(photo.storage_bucket)
        .createSignedUrl(photo.storage_path, 60 * 60);
      return { ...photo, signedUrl: data?.signedUrl ?? null };
    }),
  );
}

async function createChecklistBundle(visitId: string) {
  const admin = getSupabaseAdmin();
  return ensureServiceChecklistBundle(admin, visitId);
}

async function createSignedChecklistDocuments(
  documents: Array<{
    id: string;
    storage_bucket: string;
    storage_path: string;
    generated_at: string;
  }>,
) {
  const admin = getSupabaseAdmin();
  return Promise.all(
    documents.map(async (document) => {
      const { data } = await admin.storage
        .from(document.storage_bucket)
        .createSignedUrl(document.storage_path, 60 * 60);
      return {
        id: document.id,
        storage_path: document.storage_path,
        generated_at: document.generated_at,
        signedUrl: data?.signedUrl ?? null,
      };
    }),
  );
}

function formatArrivalWindow(start: string | null, end: string | null) {
  if (!start && !end) return "Not set";
  return [start, end].filter(Boolean).join(" - ");
}
