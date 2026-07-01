import type { Metadata } from "next";
import { updateCareerApplicationAdminAction } from "@/app/admin/actions";
import { AdminFilterBar } from "@/components/admin-filter-bar";
import { AdminShell } from "@/components/shells/admin-shell";
import { humanizeStatus } from "@/lib/booking-utils";
import { getAdminContext } from "@/lib/admin-data";
import { includesSearch, uniqueValues } from "@/lib/admin-operations";
import type { CareerApplicationRow } from "@/types/database";

export const metadata: Metadata = {
  title: "Admin Careers",
};

type AdminCareersPageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

const statusOptions = [
  "new",
  "reviewing",
  "contacted",
  "not_now",
  "hired",
  "archived",
] as const;

const sortOptions = [
  { label: "Newest first", value: "newest" },
  { label: "Oldest first", value: "oldest" },
];

export default async function AdminCareersPage({
  searchParams,
}: AdminCareersPageProps) {
  const params = await searchParams;
  const context = await getAdminContext("/admin/careers");
  const applications = filterApplications(context.careerApplications, params);

  return (
    <AdminShell title="Careers" auth={context.auth}>
      <section className="placeholder-panel">
        <div className="admin-page-heading">
          <div>
            <p className="section-kicker">Careers</p>
            <h1>Career interest forms.</h1>
            <p className="muted">
              Review future technician, route lead, launch help, and support
              interest without exposing applicant data publicly.
            </p>
          </div>
          <span className="status-badge">
            {context.careerApplications.length} total
          </span>
        </div>

        <AdminFilterBar
          searchValue={params.q}
          searchPlaceholder="Name, email, phone, city, role, message"
          resultCount={applications.length}
          resetHref="/admin/careers"
          selects={[
            {
              name: "status",
              label: "Status",
              value: params.status,
              options: [
                { label: "Any status", value: "" },
                ...statusOptions.map((status) => ({
                  label: humanizeStatus(status),
                  value: status,
                })),
              ],
            },
            {
              name: "role",
              label: "Role interest",
              value: params.role,
              options: [
                { label: "Any role", value: "" },
                ...uniqueValues(
                  context.careerApplications.map((application) => application.role_interest),
                ).map((role) => ({ label: role, value: role })),
              ],
            },
            {
              name: "sort",
              label: "Sort",
              value: params.sort,
              options: sortOptions,
            },
          ]}
        />

        {applications.length ? (
          <div className="admin-card-list">
            {applications.map((application) => (
              <form
                action={updateCareerApplicationAdminAction}
                className="admin-edit-card"
                key={application.id}
              >
                <input type="hidden" name="applicationId" value={application.id} />
                <div className="admin-row-heading">
                  <div>
                    <h2>
                      {application.first_name} {application.last_name}
                    </h2>
                    <p className="muted">
                      {application.email} | {application.phone ?? "No phone"}
                      <br />
                      {[application.city, application.state, application.zip]
                        .filter(Boolean)
                        .join(", ") || "Location not provided"}
                    </p>
                  </div>
                  <span className={`status-badge status-${application.status}`}>
                    {humanizeStatus(application.status)}
                  </span>
                </div>

                <div className="admin-data-grid">
                  <div>
                    <span>Role interest</span>
                    <strong>{application.role_interest ?? "General Interest"}</strong>
                  </div>
                  <div>
                    <span>Availability</span>
                    <strong>{application.availability.join(", ") || "Not provided"}</strong>
                  </div>
                  <div>
                    <span>Submitted</span>
                    <strong>{formatDate(application.created_at)}</strong>
                  </div>
                  <div>
                    <span>Driver&apos;s license</span>
                    <strong>{application.has_valid_drivers_license ? "Yes" : "No"}</strong>
                  </div>
                </div>

                <div className="detail-grid">
                  <article className="mini-record">
                    <span>Experience</span>
                    <p>{application.experience ?? "Not provided"}</p>
                  </article>
                  <article className="mini-record">
                    <span>Message</span>
                    <p>{application.message ?? "Not provided"}</p>
                  </article>
                </div>

                <div className="form-grid">
                  <label className="field">
                    <span>Status</span>
                    <select name="status" defaultValue={application.status}>
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {humanizeStatus(status)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Admin notes</span>
                    <textarea
                      name="adminNotes"
                      defaultValue={application.admin_notes ?? ""}
                    />
                  </label>
                </div>

                <div className="action-row">
                  <button className="button button-dark" type="submit">
                    Save Applicant
                  </button>
                  <a className="button button-outline" href={`mailto:${application.email}`}>
                    Email Applicant
                  </a>
                  {application.phone ? (
                    <a className="button button-outline" href={`tel:${application.phone}`}>
                      Call
                    </a>
                  ) : null}
                </div>
              </form>
            ))}
          </div>
        ) : (
          <p>No career applications match those filters.</p>
        )}
      </section>
    </AdminShell>
  );
}

function filterApplications(
  applications: CareerApplicationRow[],
  params: Record<string, string | undefined>,
) {
  const query = params.q?.trim() ?? "";

  return applications
    .filter((application) =>
      includesSearch(
        [
          `${application.first_name} ${application.last_name}`,
          application.email,
          application.phone,
          application.city,
          application.state,
          application.role_interest,
          application.message,
          application.experience,
        ],
        query,
      ),
    )
    .filter((application) => !params.status || application.status === params.status)
    .filter((application) => !params.role || application.role_interest === params.role)
    .sort((a, b) =>
      params.sort === "oldest"
        ? a.created_at.localeCompare(b.created_at)
        : b.created_at.localeCompare(a.created_at),
    );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
