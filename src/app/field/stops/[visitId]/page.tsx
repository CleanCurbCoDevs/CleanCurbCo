import type { Metadata } from "next";
import Link from "next/link";
import {
  completeStopAction,
  deleteServicePhotoAction,
  markManualPaidAction,
  readyForNextStopAction,
  saveTechnicianNotesAction,
  startBreakAction,
  uploadServicePhotosAction,
} from "@/app/field/actions";
import {
  ActionSubmitButton,
  FeedbackForm,
} from "@/components/action-feedback";
import { FieldPaymentEmailForm } from "@/components/field-payment-email-form";
import { FieldStopActions } from "@/components/field-stop-actions";
import { PaymentLinkButton } from "@/components/payment-link-button";
import { ServiceChecklistPanel } from "@/components/service-checklist-panel";
import { FieldShell } from "@/components/shells/field-shell";
import { formatBookingAddress, humanizeStatus } from "@/lib/booking-utils";
import { getFieldContext } from "@/lib/field-data";
import { getServiceClearanceStatus } from "@/lib/payment-clearance";
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
  const isPaid =
    booking.payment_status === "paid" ||
    latestPayment?.status === "paid";
  
  const clearance = getServiceClearanceStatus(
    booking,
    latestPayment,
  );
  
  const paymentCollectionAllowed =
    context.auth.status === "ok" &&
    (
      clearance.requiresCollection ||
      isAdminRole(context.auth.profile.role)
    );
  const displayStopNumber = stop.optimoroute_stop_sequence ?? stop.stop_order ?? 1;
  const scheduledTime = stop.optimoroute_scheduled_at
    ? formatFieldTime(stop.optimoroute_scheduled_at)
    : null;
  const eta = stop.optimoroute_eta ? formatFieldTime(stop.optimoroute_eta) : null;

  return (
    <FieldShell title={`Stop #${displayStopNumber}`} auth={context.auth}>
      <section className="field-card field-summary-card">
        <div className="field-card-top">
          <div className="status-stack">
            {stop.optimoroute_stop_sequence ? (
              <span className="status-badge status-imported">
                Optimized #{stop.optimoroute_stop_sequence}
              </span>
            ) : (
              <span className="status-badge status-neutral">
                Manual #{stop.stop_order || 1}
              </span>
            )}
            <span className={`status-badge status-${stop.status}`}>
              {humanizeStatus(stop.status)}
            </span>
          <span className={`status-badge status-${booking.payment_status}`}>
            {humanizeStatus(booking.payment_status)}
          </span>
          
          {clearance.requiresCollection ? (
            <span className="status-badge status-pending">
              PAYMENT DUE AT STOP
            </span>
          ) : null}
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
          <span>
            OptimoRoute:{" "}
            {stop.optimoroute_stop_sequence
              ? `Stop ${stop.optimoroute_stop_sequence}`
              : "not imported"}
          </span>
          <span>
            Schedule:{" "}
            {scheduledTime
              ? `${scheduledTime}${eta && eta !== scheduledTime ? ` ETA ${eta}` : ""}`
              : "not imported"}
          </span>
          <span>
            Travel:{" "}
            {stop.optimoroute_travel_time_seconds
              ? formatDuration(stop.optimoroute_travel_time_seconds)
              : "not imported"}
            {stop.optimoroute_distance_meters
              ? ` / ${formatDistance(stop.optimoroute_distance_meters)}`
              : ""}
          </span>
          <span>Driver: {stop.optimoroute_driver_name ?? "not assigned"}</span>
        </div>
        {booking.customer_notes || address?.notes || stop.technician_notes ? (
          <div className="field-note">
            <strong>Notes:</strong>{" "}
            {booking.customer_notes ?? address?.notes ?? stop.technician_notes}
          </div>
        ) : null}
      </section>

      <FieldStopActions
        clearance={clearance}
        initialStatus={stop.status}
        visitId={visit.id}
      />

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
        <FeedbackForm
          action={saveTechnicianNotesAction}
          className="field-form"
          pendingMessage="Saving notes..."
          successMessage="Technician notes saved."
        >
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
          <ActionSubmitButton className="button button-dark" pendingLabel="Saving...">
            Save Notes
          </ActionSubmitButton>
        </FeedbackForm>
      </section>

      <section className="field-card">
        <p className="section-kicker">Service Clearance</p>
        <div className={`field-payment-clearance clearance-${clearance.tone}`}>
          <div>
            <h2>{clearance.label}</h2>
            <p>{clearance.detail}</p>
          </div>
          <p>
            <strong>Field action:</strong> {clearance.action}
          </p>
        </div>
        <p>
          Estimated service price: <strong>${booking.estimated_price}</strong>{" "}
          | Raw payment status:{" "}
          <strong>
            {humanizeStatus(
              isPaid
                ? "paid"
                : latestPayment?.status ?? booking.payment_status,
            )}
          </strong>
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
          <FieldPaymentEmailForm
            bookingId={booking.id}
            hasPaymentLink={Boolean(currentPaymentLink)}
            isPaid={isPaid}
            routeStopId={stop.id}
            visitId={visit.id}
          />
        {!isPaid && paymentCollectionAllowed ? (
          <FeedbackForm
            action={markManualPaidAction}
            className="field-form inline-payment-form"
            pendingMessage="Recording payment..."
            successMessage="Payment and tip recorded."
          >
            <input
              type="hidden"
              name="visitId"
              value={visit.id}
            />
        
            <label>
              Service amount
              <input
                name="serviceAmount"
                type="number"
                min="0.01"
                max="5000"
                step="0.01"
                defaultValue={Number(
                  booking.estimated_price,
                ).toFixed(2)}
                required
              />
            </label>
        
            <label>
              Tip amount
              <input
                name="tipAmount"
                type="number"
                min="0"
                max="5000"
                step="0.01"
                defaultValue="0.00"
              />
            </label>
        
            <label>
              Payment method
              <select
                name="paymentMethod"
                defaultValue={
                  booking.payment_preference === "venmo_business"
                    ? "venmo_business"
                    : booking.payment_preference === "zelle"
                      ? "zelle"
                      : "cash"
                }
              >
                <option value="cash">Cash</option>
                <option value="venmo_business">
                  Venmo Business — confirmed received
                </option>
                <option value="zelle">
                  Zelle — confirmed received
                </option>
                <option value="other">Other</option>
              </select>
            </label>
        
            <label>
              Payment notes
              <textarea
                name="paymentNotes"
                placeholder="Optional for cash, Venmo, or Zelle. Required when choosing Other."
              />
            </label>
        
            <p className="muted">
              The service charge and tip are recorded separately.
              Confirm that the money was actually received before submitting.
            </p>
        
            <ActionSubmitButton
              className="button button-primary"
              pendingLabel="Recording..."
            >
              Record Collected Payment
            </ActionSubmitButton>
          </FeedbackForm>
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
        <FeedbackForm
          action={completeStopAction}
          pendingMessage="Completing stop..."
          successMessage="Stop completed."
        >
          <input type="hidden" name="visitId" value={visit.id} />
          <ActionSubmitButton
            className="button button-primary field-big-button"
            pendingLabel="Completing..."
          >
            End Service / Complete Stop
          </ActionSubmitButton>
        </FeedbackForm>
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
                  <input type="hidden" name="routeStopId" value={stop.id} />
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
                    <textarea
                      name="notes"
                      placeholder="Required for equipment issue, weather pause, customer delay, or other"
                    />
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
      <FeedbackForm
        action={uploadServicePhotosAction}
        className="field-form"
        pendingMessage="Uploading photos..."
        successMessage={`${title} uploaded.`}
      >
        <input type="hidden" name="visitId" value={visitId} />
        <input type="hidden" name="photoType" value={photoType} />
        <input accept="image/*" capture="environment" multiple name="photos" type="file" />
        <ActionSubmitButton className="button button-dark" pendingLabel="Uploading...">
          {actionLabel}
        </ActionSubmitButton>
      </FeedbackForm>
      {photos.length ? (
        <div className="field-photo-grid">
          {photos.map((photo) => (
            <figure key={photo.id}>
              {photo.signedUrl ? (
                // Supabase signed service-photo URLs are short-lived and intentionally rendered directly.
                // eslint-disable-next-line @next/next/no-img-element
                <img alt={`${photo.photo_type} service upload`} src={photo.signedUrl} />
              ) : (
                <div className="field-photo-placeholder">Photo unavailable</div>
              )}
              <FeedbackForm
                action={deleteServicePhotoAction}
                pendingMessage="Deleting photo..."
                successMessage="Photo deleted."
              >
                <input type="hidden" name="photoId" value={photo.id} />
                <input type="hidden" name="visitId" value={visitId} />
                <ActionSubmitButton
                  className="link-button destructive"
                  pendingLabel="Deleting..."
                >
                  Delete / Retry
                </ActionSubmitButton>
              </FeedbackForm>
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

function formatFieldTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDuration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

function formatDistance(meters: number) {
  const miles = meters / 1609.344;
  if (miles < 0.1) return `${meters} m`;
  return `${miles.toFixed(1)} mi`;
}
