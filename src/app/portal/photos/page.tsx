import type { Metadata } from "next";
import { PortalShell } from "@/components/shells/portal-shell";
import { getPortalContext } from "@/lib/portal-data";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { ServicePhotoRow } from "@/types/database";

export const metadata: Metadata = {
  title: "Portal Photos",
};

export default async function PortalPhotosPage() {
  const context = await getPortalContext("/portal/photos");
  const signedPhotos = await createSignedPhotos(context.photos);
  const photosByVisit = groupByVisit(signedPhotos);

  return (
    <PortalShell title="Before and after photos" auth={context.auth}>
      <section className="placeholder-panel">
        <p className="section-kicker">Photos</p>
        <h1>Before and after proof.</h1>
        {Object.entries(photosByVisit).length ? (
          <div className="detail-grid">
            {Object.entries(photosByVisit).map(([visitId, photos]) => {
              const visit = context.visits.find((item) => item.id === visitId);
              const booking = context.bookings.find((item) => item.id === visit?.booking_id);
              return (
                <article className="detail-panel" key={visitId}>
                  <h2>{visit?.route_day ?? booking?.confirmed_route_day ?? "Service visit"}</h2>
                  <p className="muted">
                    {booking?.street_address ?? "Service photos"} |{" "}
                    {photos.filter((photo) => photo.photo_type === "before").length} before /{" "}
                    {photos.filter((photo) => photo.photo_type === "after").length} after
                  </p>
                  <div className="field-photo-grid portal-photo-grid">
                    {photos.map((photo) => (
                      <figure key={photo.id}>
                        {photo.signedUrl ? (
                          // Supabase signed service-photo URLs are short-lived and intentionally rendered directly.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            alt={`${photo.photo_type} Clean Curb Co. service photo`}
                            src={photo.signedUrl}
                          />
                        ) : (
                          <div className="field-photo-placeholder">Photo unavailable</div>
                        )}
                        <figcaption>{photo.photo_type}</figcaption>
                      </figure>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p>
            Service photos will appear here after completed cleanings. They stay
            private to your account unless you give permission otherwise.
          </p>
        )}
      </section>
    </PortalShell>
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

function groupByVisit(photos: Array<ServicePhotoRow & { signedUrl: string | null }>) {
  return photos.reduce<Record<string, typeof photos>>((groups, photo) => {
    const key = photo.service_visit_id ?? "unlinked";
    groups[key] = groups[key] ? [...groups[key], photo] : [photo];
    return groups;
  }, {});
}
