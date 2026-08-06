import type { Metadata } from "next";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  DollarSign,
  Search,
  UserRound,
} from "lucide-react";
import Link from "next/link";

import { FieldShell } from "@/components/shells/field-shell";
import {
  formatBookingAddress,
  humanizeStatus,
} from "@/lib/booking-utils";
import {
  getFieldHistoryPage,
  type FieldHistoryQuery,
  type FieldHistoryRecord,
} from "@/lib/server/field-history";
import { isAdminRole } from "@/lib/supabase/roles";

export const metadata: Metadata = {
  title: "Service History | CCC Field",
};

type HistoryPageProps = {
  searchParams?: Promise<
    FieldHistoryQuery
  >;
};

export default async function FieldHistoryPage({
  searchParams,
}: HistoryPageProps) {
  const query =
    (
      await searchParams
    ) ?? {};

  const history =
    await getFieldHistoryPage(
      query,
      "/field/history",
    );

  const {
    filters,
    metrics,
    pagination,
  } = history;

  const searchTerm =
    filters.search;

  const selectedYear =
    filters.year;

  const selectedMonth =
    filters.month;

  const selectedDay =
    filters.day;

  const selectedStatus =
    filters.status;

  const selectedTechnician =
    filters.technician;

  const selectedTime =
    filters.time;

  const selectedProof =
    filters.proof;

  const issuesOnly =
    filters.issuesOnly;

  const selectedSort =
    filters.sort;

  if (
    history.auth.status !==
    "ok"
  ) {
    return (
      <FieldShell
        title="History"
        auth={
          history.auth
        }
      >
        <section className="field-empty-state">
          <h2>
            History is unavailable.
          </h2>

          <p>
            Please sign in again to review service records.
          </p>
        </section>
      </FieldShell>
    );
  }

  const canViewAllHistory =
    isAdminRole(
      history.auth
        .profile.role,
    );

  const availableYears =
    history.availableYears.map(
      String,
    );

  const availableTechnicians =
    history.technicians;

  const filteredRecords =
    history.records;

  const groupedRecords =
    groupRecordsByMonth(
      filteredRecords,
    );

  const hasActiveFilters =
    Boolean(
      searchTerm ||
      selectedYear ||
      selectedMonth ||
      selectedDay ||
      selectedStatus ||
      selectedTechnician ||
      selectedTime ||
      selectedProof ||
      issuesOnly ||
      selectedSort !==
        "newest",
    );

  const activeFilterCount = [
    searchTerm,
    selectedYear,
    selectedMonth,
    selectedDay,
    selectedStatus,
    selectedTechnician,
    selectedTime,
    selectedProof,
    issuesOnly
      ? "issues"
      : "",
    selectedSort !==
      "newest"
      ? selectedSort
      : "",
  ].filter(
    Boolean,
  ).length;

  const previousPageHref =
    pagination.page > 1
      ? buildHistoryPageHref(
          query,
          pagination.page - 1,
        )
      : null;

  const nextPageHref =
    pagination.page <
    pagination.pageCount
      ? buildHistoryPageHref(
          query,
          pagination.page + 1,
        )
      : null;
  
  return (
    <FieldShell
      title={
        canViewAllHistory
          ? "Service History"
          : "My Service History"
      }
      subtitle={
        canViewAllHistory
          ? "Completed work and field exceptions across the company."
          : "Your completed services and follow-up records."
      }
      auth={history.auth}
    >
      <section className="field-history-hero">
        <div>
          <p className="section-kicker">
            {canViewAllHistory
              ? "Company Archive"
              : "Your Archive"}
          </p>

          <h2>
            {canViewAllHistory
              ? "Every completed service, all in one place."
              : "The work you handled, all in one place."}
          </h2>

          <p>
            Find completed stops, review proof of work,
            and revisit anything that needed follow-up.
          </p>
        </div>

        <div className="field-history-scope">
          <UserRound size={22} aria-hidden="true" />

          <div>
            <strong>
              {canViewAllHistory
                ? "All technicians"
                : "Only your work"}
            </strong>

            <small>
              {canViewAllHistory
                ? "Owner/admin visibility"
                : "Technician-specific history"}
            </small>
          </div>
        </div>
      </section>

      <section className="field-history-stats">
        <HistoryMetric
          icon={CheckCircle2}
          label="Completed"
          value={metrics.completedCount}
        />

        <HistoryMetric
          icon={AlertTriangle}
          label="Follow-Ups"
          tone="warning"
          value={metrics.followUpCount}
        />

        <HistoryMetric
          icon={ClipboardCheck}
          label="Proof Complete"
          tone="success"
          value={metrics.proofCompleteCount}
        />

        <HistoryMetric
          icon={DollarSign}
          label="Serviced"
          value={formatMoney(
            metrics.servicedRevenue,
          )}
        />
      </section>

      {history.loadError ? (
        <section
          className="field-history-empty"
          role="alert"
        >
          <AlertTriangle
            size={42}
            aria-hidden="true"
          />

          <div>
            <h2>
              History could not be loaded
            </h2>

            <p>
              {history.loadError}
            </p>
          </div>
        </section>
      ) : null}
      
      <details
        className="field-history-filter-panel"
        open={hasActiveFilters}
      >
        <summary>
          <div>
            <Search size={21} aria-hidden="true" />
      
            <span>
              <strong>Search & Filter</strong>
      
              <small>
                Find a service by customer, date, technician,
                status, proof, or time.
              </small>
            </span>
          </div>
      
          {activeFilterCount > 0 ? (
            <span className="field-history-filter-count">
              {activeFilterCount} active
            </span>
          ) : (
            <span className="field-history-filter-count is-empty">
              All records
            </span>
          )}
        </summary>
      
        <form
          action="/field/history"
          className="field-history-filter-form"
          method="get"
        >
          <label className="field-history-filter-search">
            <span>Customer, address, route, or notes</span>
      
            <input
              defaultValue={query?.q ?? ""}
              name="q"
              placeholder={
                canViewAllHistory
                  ? "Search customer, address, technician, or route"
                  : "Search customer, address, or route"
              }
              type="search"
            />
          </label>
      
          <div className="field-history-filter-grid">
            <label>
              <span>Year</span>
      
              <select
                defaultValue={selectedYear}
                name="year"
              >
                <option value="">All years</option>
      
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
      
            <label>
              <span>Month</span>
      
              <select
                defaultValue={selectedMonth}
                name="month"
              >
                <option value="">All months</option>
                <option value="01">January</option>
                <option value="02">February</option>
                <option value="03">March</option>
                <option value="04">April</option>
                <option value="05">May</option>
                <option value="06">June</option>
                <option value="07">July</option>
                <option value="08">August</option>
                <option value="09">September</option>
                <option value="10">October</option>
                <option value="11">November</option>
                <option value="12">December</option>
              </select>
            </label>
      
            <label>
              <span>Specific day</span>
      
              <input
                defaultValue={selectedDay}
                name="day"
                type="date"
              />
            </label>
      
            <label>
              <span>Status</span>
      
              <select
                defaultValue={selectedStatus}
                name="status"
              >
                <option value="">All statuses</option>
                <option value="completed">Completed</option>
                <option value="needs_follow_up">
                  Needs Follow-Up
                </option>
                <option value="skipped">Skipped</option>
              </select>
            </label>
      
            <label>
              <span>Time of day</span>
      
              <select
                defaultValue={selectedTime}
                name="time"
              >
                <option value="">Any time</option>
                <option value="morning">
                  Morning — before 12 PM
                </option>
                <option value="afternoon">
                  Afternoon — 12 to 5 PM
                </option>
                <option value="evening">
                  Evening — after 5 PM
                </option>
              </select>
            </label>
      
            <label>
              <span>Proof status</span>
      
              <select
                defaultValue={selectedProof}
                name="proof"
              >
                <option value="">Any proof status</option>
                <option value="complete">
                  Complete proof
                </option>
                <option value="missing_before">
                  Missing before photo
                </option>
                <option value="missing_checklist">
                  Missing checklist
                </option>
                <option value="missing_after">
                  Missing after photo
                </option>
              </select>
            </label>
      
            {canViewAllHistory ? (
              <label>
                <span>Technician</span>
      
                <select
                  defaultValue={selectedTechnician}
                  name="technician"
                >
                  <option value="">All technicians</option>
      
                  {availableTechnicians.map(
                    (technician) => (
                      <option
                        key={technician.id}
                        value={technician.id}
                      >
                        {technician.name}
                      </option>
                    ),
                  )}
                </select>
              </label>
            ) : null}
      
            <label>
              <span>Sort records</span>
      
              <select
                defaultValue={selectedSort}
                name="sort"
              >
                <option value="newest">
                  Newest first
                </option>
      
                <option value="oldest">
                  Oldest first
                </option>
      
                <option value="customer_asc">
                  Customer A–Z
                </option>
      
                <option value="customer_desc">
                  Customer Z–A
                </option>
      
                <option value="time_asc">
                  Earliest time first
                </option>
      
                <option value="time_desc">
                  Latest time first
                </option>
              </select>
            </label>
          </div>
      
          <label className="field-history-filter-checkbox">
            <input
              defaultChecked={issuesOnly}
              name="issues"
              type="checkbox"
              value="true"
            />
      
            <span>
              <strong>Issues only</strong>
              <small>
                Show follow-ups, issue flags, and issue photos.
              </small>
            </span>
          </label>
      
          <div className="field-history-filter-actions">
            <button type="submit">
              Apply Filters
            </button>
      
            {hasActiveFilters ? (
              <Link href="/field/history">
                Clear Everything
              </Link>
            ) : null}
          </div>
        </form>
      </details>

      <div className="field-history-results-note">
        <strong>
          {pagination.totalCount}{" "}
          {pagination.totalCount ===
          1
            ? "record"
            : "records"}
        </strong>

        <span>
          {hasActiveFilters
            ? `matched from ${metrics.scopeCount} available`
            : "available in this history"}

          {pagination.pageCount >
          1
            ? ` · page ${pagination.page} of ${pagination.pageCount}`
            : ""}
        </span>
      </div>

      {groupedRecords.length ? (
        <div className="field-history-months">
          {groupedRecords.map((group) => (
            <section
              className="field-history-month"
              key={group.monthKey}
            >
              <div className="field-history-month-heading">
                <h2>{group.monthLabel}</h2>
                <span>{group.records.length}</span>
              </div>

              <div className="field-history-records">
                {group.records.map((record) => (
                  <HistoryCard
                    canViewAllHistory={
                      canViewAllHistory
                    }
                    key={record.stop.id}
                    record={record}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <section className="field-history-empty">
          <ClipboardCheck
            size={42}
            aria-hidden="true"
          />

          <div>
            <h2>
              {hasActiveFilters
                ? "No matching service records"
                : "No service history yet"}
            </h2>

            <p>
              {hasActiveFilters
                ? "Try removing a filter or choosing a broader date range."
                : "Completed stops and follow-up records will appear here."}
            </p>
          </div>

          {searchTerm ? (
            <Link
              className="button button-outline"
              href="/field/history"
            >
              Clear Filters
            </Link>
          ) : (
            <Link
              className="button button-primary"
              href="/field/today"
            >
              Open Today
            </Link>
          )}
        </section>
      )}

      {pagination.pageCount >
      1 ? (
        <nav
          aria-label="Service history pages"
          className="field-history-filter-actions"
        >
          {previousPageHref ? (
            <Link
              href={
                previousPageHref
              }
            >
              <ChevronLeft
                size={19}
                aria-hidden="true"
              />

              Previous
            </Link>
          ) : (
            <span>
              First page
            </span>
          )}

          <strong>
            Page{" "}
            {pagination.page}{" "}
            of{" "}
            {pagination.pageCount}
          </strong>

          {nextPageHref ? (
            <Link
              href={
                nextPageHref
              }
            >
              Next

              <ChevronRight
                size={19}
                aria-hidden="true"
              />
            </Link>
          ) : (
            <span>
              Last page
            </span>
          )}
        </nav>
      ) : null}
    </FieldShell>
  );
}

function HistoryCard({
  record,
  canViewAllHistory,
}: {
  record: FieldHistoryRecord;
  canViewAllHistory: boolean;
}) {
  const {
    stop,
    visit,
    booking,
    checklist,
    payment,
    technician,
    beforePhotoCount,
    afterPhotoCount,
    issuePhotoCount,
    beforeProofComplete,
    afterProofComplete,
    eventDate,
  } = record;

  const customerName = booking
    ? [booking.first_name, booking.last_name]
        .filter(Boolean)
        .join(" ") || "Customer"
    : "Unlinked customer";

  const address = booking
    ? formatBookingAddress(booking)
    : "No service address linked";

  const checklistComplete =
    checklist?.status === "submitted";

  const paymentStatus =
    payment?.status ??
    booking?.payment_status ??
    "unknown";

  const technicianName = technician
    ? [technician.first_name, technician.last_name]
        .filter(Boolean)
        .join(" ") ||
      technician.email ||
      "Technician"
    : "Technician not recorded";

  const hasIssue =
    stop.status === "needs_follow_up" ||
    stop.issue_flags.length > 0 ||
    issuePhotoCount > 0;

  return (
    <details
      className={[
        "field-history-card",
        hasIssue ? "has-issue" : "",
        stop.status === "completed"
          ? "is-complete"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <summary className="field-history-card-summary">
        <div className="field-history-summary-status">
          <span
            className={
              stop.status === "completed"
                ? "history-status-icon is-complete"
                : "history-status-icon has-issue"
            }
            aria-hidden="true"
          >
            {stop.status === "completed" ? "✓" : "!"}
          </span>
        </div>
  
        <div className="field-history-summary-main">
          <strong>{customerName}</strong>
          <span>{address}</span>
  
          <small>
            {formatServiceDate(eventDate)}
            {" · "}
            {booking?.bin_count ?? 0}{" "}
            {(booking?.bin_count ?? 0) === 1
              ? "bin"
              : "bins"}
          </small>
        </div>
  
        <div className="field-history-summary-badges">
          <span
            className={`status-badge status-${stop.status}`}
          >
            {humanizeStatus(stop.status)}
          </span>
  
          <small>
            {checklistComplete &&
            beforeProofComplete &&
            afterProofComplete
              ? "Proof complete"
              : "Proof incomplete"}
          </small>
        </div>
  
        <ChevronRight
          className="field-history-summary-chevron"
          size={22}
          aria-hidden="true"
        />
      </summary>
  
      <div className="field-history-card-details">
        <div className="field-history-service-meta">
          <span>
            {booking?.bin_count ?? 0}{" "}
            {(booking?.bin_count ?? 0) === 1
              ? "bin"
              : "bins"}
          </span>
  
          <span>
            {humanizeStatus(
              booking?.frequency ?? "one_time",
            )}
          </span>
  
          <span>
            Payment: {humanizeStatus(paymentStatus)}
          </span>
  
          {canViewAllHistory ? (
            <span>Tech: {technicianName}</span>
          ) : null}
        </div>
  
        <div className="field-history-proof">
          <ProofItem
            complete={
              beforeProofComplete
            }
            icon={Camera}
            label="Before"
            value={
              beforePhotoCount >
              0
                ? beforePhotoCount
                : beforeProofComplete
                  ? "Exception"
                  : 0
            }
          />
  
          <ProofItem
            complete={checklistComplete}
            icon={ClipboardCheck}
            label="Checklist"
            value={checklistComplete ? "Done" : "Missing"}
          />
  
          <ProofItem
            complete={
              afterProofComplete
            }
            icon={Camera}
            label="After"
            value={
              afterPhotoCount >
              0
                ? afterPhotoCount
                : afterProofComplete
                  ? "Exception"
                  : 0
            }
          />
        </div>
  
        {hasIssue ? (
          <div className="field-history-issue">
            <AlertTriangle
              size={20}
              aria-hidden="true"
            />
  
            <div>
              <strong>
                {stop.status === "needs_follow_up"
                  ? "Follow-up required"
                  : "Issue documented"}
              </strong>
  
              <p>
                {stop.technician_notes ||
                  stop.issue_flags
                    .map(humanizeStatus)
                    .join(", ") ||
                  "Review the service record for details."}
              </p>
            </div>
          </div>
        ) : null}
  
        {visit ? (
          <Link
            className="field-history-open-button"
            href={`/field/stops/${visit.id}`}
          >
            <span>View Full Service Record</span>
  
            <ChevronRight
              size={22}
              aria-hidden="true"
            />
          </Link>
        ) : (
          <div className="field-history-no-link">
            Service visit is not linked to this record.
          </div>
        )}
      </div>
    </details>
  );
}

function ProofItem({
  icon: Icon,
  label,
  value,
  complete,
}: {
  icon: typeof Camera;
  label: string;
  value: number | string;
  complete: boolean;
}) {
  return (
    <div
      className={
        complete
          ? "field-history-proof-item is-complete"
          : "field-history-proof-item is-missing"
      }
    >
      <Icon size={19} aria-hidden="true" />

      <span>{label}</span>

      <strong>{value}</strong>
    </div>
  );
}

function HistoryMetric({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: number | string;
  tone?: "default" | "success" | "warning";
}) {
  return (
    <article
      className={`field-history-metric field-history-metric-${tone}`}
    >
      <Icon size={21} aria-hidden="true" />

      <span>{label}</span>

      <strong>{value}</strong>
    </article>
  );
}

function groupRecordsByMonth(
  records:
    FieldHistoryRecord[],
) {
  const groups =
    new Map<
      string,
      FieldHistoryRecord[]
    >();

  records.forEach((record) => {
    const date = new Date(record.eventDate);

    const monthKey = new Intl.DateTimeFormat(
      "en-US",
      {
        year: "numeric",
        month: "2-digit",
        timeZone: "America/New_York",
      },
    ).format(date);

    const existing = groups.get(monthKey) ?? [];
    existing.push(record);
    groups.set(monthKey, existing);
  });

  return Array.from(groups.entries()).map(
    ([monthKey, monthRecords]) => ({
      monthKey,
      monthLabel: new Intl.DateTimeFormat(
        "en-US",
        {
          month: "long",
          year: "numeric",
          timeZone: "America/New_York",
        },
      ).format(
        new Date(monthRecords[0].eventDate),
      ),
      records: monthRecords,
    }),
  );
}

function buildHistoryPageHref(
  query:
    FieldHistoryQuery,
  page:
    number,
) {
  const params =
    new URLSearchParams();

  Object.entries(
    query,
  ).forEach(
    (
      [
        key,
        value,
      ],
    ) => {
      const cleaned =
        value?.trim() ?? "";

      if (
        !cleaned ||
        key === "page"
      ) {
        return;
      }

      params.set(
        key,
        cleaned,
      );
    },
  );

  if (page > 1) {
    params.set(
      "page",
      String(
        page,
      ),
    );
  }

  const search =
    params.toString();

  return search
    ? `/field/history?${search}`
    : "/field/history";
}

function formatServiceDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(new Date(value));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
