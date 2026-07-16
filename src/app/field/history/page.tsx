import type { Metadata } from "next";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
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
import { getFieldContext } from "@/lib/field-data";
import { isAdminRole } from "@/lib/supabase/roles";

export const metadata: Metadata = {
  title: "Service History | CCC Field",
};

type HistoryPageProps = {
  searchParams?: Promise<{
    q?: string;
    year?: string;
    month?: string;
    day?: string;
    status?: string;
    technician?: string;
    time?: string;
    proof?: string;
    issues?: string;
    sort?: string;
  }>;
};

type HistoryRecord = {
  stop: Awaited<
    ReturnType<typeof getFieldContext>
  >["routeStops"][number];
  visit:
    | Awaited<
        ReturnType<typeof getFieldContext>
      >["visits"][number]
    | null;
  booking:
    | Awaited<
        ReturnType<typeof getFieldContext>
      >["bookings"][number]
    | null;
  routeDay:
    | Awaited<
        ReturnType<typeof getFieldContext>
      >["routeDays"][number]
    | null;
  checklist:
    | Awaited<
        ReturnType<typeof getFieldContext>
      >["checklists"][number]
    | null;
  payment:
    | Awaited<
        ReturnType<typeof getFieldContext>
      >["payments"][number]
    | null;
  technician:
    | Awaited<
        ReturnType<typeof getFieldContext>
      >["profiles"][number]
    | null;
  beforePhotoCount: number;
  afterPhotoCount: number;
  issuePhotoCount: number;
  completedBy: string | null;
  eventDate: string;
};

export default async function FieldHistoryPage({
  searchParams,
}: HistoryPageProps) {
  const context = await getFieldContext("/field/history");
  const query = await searchParams;
  
  const searchTerm = query?.q?.trim().toLowerCase() ?? "";
  const selectedYear = query?.year ?? "";
  const selectedMonth = query?.month ?? "";
  const selectedDay = query?.day ?? "";
  const selectedStatus = query?.status ?? "";
  const selectedTechnician = query?.technician ?? "";
  const selectedTime = query?.time ?? "";
  const selectedProof = query?.proof ?? "";
  const issuesOnly = query?.issues === "true";
  const selectedSort = query?.sort ?? "newest";

  if (context.auth.status !== "ok") {
    return (
      <FieldShell title="History" auth={context.auth}>
        <section className="field-empty-state">
          <h2>History is unavailable.</h2>
          <p>Please sign in again to review service records.</p>
        </section>
      </FieldShell>
    );
  }

  const canViewAllHistory = isAdminRole(
    context.auth.profile.role,
  );

  const userId = context.auth.userId;

  const companyRecords: HistoryRecord[] =
    context.routeStops
      .filter((stop) =>
        [
          "completed",
          "needs_follow_up",
          "skipped",
        ].includes(stop.status),
      )
      .map((stop) => {
        const visit =
          context.visits.find(
            (item) =>
              item.id === stop.service_visit_id,
          ) ?? null;

        const booking =
          context.bookings.find(
            (item) => item.id === stop.booking_id,
          ) ?? null;

        const routeDay =
          context.routeDays.find(
            (item) => item.id === stop.route_day_id,
          ) ?? null;

        const checklist =
          context.checklists.find(
            (item) =>
              item.route_stop_id === stop.id ||
              item.service_visit_id ===
                stop.service_visit_id,
          ) ?? null;

        const payment =
          context.payments.find(
            (item) =>
              item.booking_id === stop.booking_id,
          ) ?? null;

        const completedBy =
          checklist?.completed_by ??
          checklist?.submitted_by ??
          null;

        const responsibleTechnicianId =
          completedBy ??
          routeDay?.assigned_technician_id ??
          null;

        const technician =
          context.profiles.find(
            (profile) =>
              profile.id === responsibleTechnicianId,
          ) ?? null;

        const stopPhotos = context.photos.filter(
          (photo) =>
            photo.route_stop_id === stop.id ||
            photo.service_visit_id ===
              stop.service_visit_id,
        );

        const eventDate =
          stop.completed_at ??
          checklist?.completed_at ??
          checklist?.submitted_at ??
          stop.updated_at;

        return {
          stop,
          visit,
          booking,
          routeDay,
          checklist,
          payment,
          technician,
          beforePhotoCount: stopPhotos.filter(
            (photo) => photo.photo_type === "before",
          ).length,
          afterPhotoCount: stopPhotos.filter(
            (photo) => photo.photo_type === "after",
          ).length,
          issuePhotoCount: stopPhotos.filter(
            (photo) => photo.photo_type === "issue",
          ).length,
          completedBy,
          eventDate,
        };
      })
      .sort((a, b) =>
        b.eventDate.localeCompare(a.eventDate),
      );

  /*
   * Permission boundary:
   *
   * Admins and owners receive all company records.
   *
   * Field technicians receive:
   * 1. Records where the checklist says they completed/submitted it.
   * 2. Older records with no recorded completer where they were the
   *    technician assigned to the route.
   *
   * This filtering happens before totals, searching, and grouping.
   */
  const visibleRecords = canViewAllHistory
    ? companyRecords
    : companyRecords.filter((record) => {
        if (record.completedBy) {
          return record.completedBy === userId;
        }

        return (
          record.routeDay?.assigned_technician_id ===
          userId
        );
      });

  const availableYears = Array.from(
    new Set(
      visibleRecords.map((record) =>
        getEasternDateParts(record.eventDate).year,
      ),
    ),
  ).sort((a, b) => Number(b) - Number(a));
  
  const availableTechnicians = Array.from(
    new Map(
      visibleRecords
        .filter((record) => record.technician)
        .map((record) => {
          const technician = record.technician!;
  
          const name =
            [technician.first_name, technician.last_name]
              .filter(Boolean)
              .join(" ") ||
            technician.email ||
            "Technician";
  
          return [
            technician.id,
            {
              id: technician.id,
              name,
            },
          ] as const;
        }),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));
  
  const filteredRecords = visibleRecords
    .filter((record) => {
      const booking = record.booking;
      const dateParts = getEasternDateParts(record.eventDate);
  
      if (searchTerm) {
        const searchableText = [
          booking?.first_name,
          booking?.last_name,
          booking?.email,
          booking?.phone,
          booking?.street_address,
          booking?.city,
          booking?.zip_code,
          record.routeDay?.route_name,
          record.routeDay?.service_area,
          record.technician?.first_name,
          record.technician?.last_name,
          record.stop.technician_notes,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
  
        if (!searchableText.includes(searchTerm)) {
          return false;
        }
      }
  
      if (
        selectedYear &&
        dateParts.year !== selectedYear
      ) {
        return false;
      }
  
      if (
        selectedMonth &&
        dateParts.month !== selectedMonth
      ) {
        return false;
      }
  
      if (
        selectedDay &&
        dateParts.date !== selectedDay
      ) {
        return false;
      }
  
      if (
        selectedStatus &&
        record.stop.status !== selectedStatus
      ) {
        return false;
      }
  
      if (
        canViewAllHistory &&
        selectedTechnician &&
        record.technician?.id !== selectedTechnician
      ) {
        return false;
      }
  
      if (
        selectedTime &&
        getTimeOfDay(record.eventDate) !== selectedTime
      ) {
        return false;
      }
  
      const checklistComplete =
        record.checklist?.status === "submitted";
  
      const proofComplete =
        record.beforePhotoCount > 0 &&
        checklistComplete &&
        record.afterPhotoCount > 0;
  
      if (
        selectedProof === "complete" &&
        !proofComplete
      ) {
        return false;
      }
  
      if (
        selectedProof === "missing_before" &&
        record.beforePhotoCount > 0
      ) {
        return false;
      }
  
      if (
        selectedProof === "missing_checklist" &&
        checklistComplete
      ) {
        return false;
      }
  
      if (
        selectedProof === "missing_after" &&
        record.afterPhotoCount > 0
      ) {
        return false;
      }
  
      const hasIssue =
        record.stop.status === "needs_follow_up" ||
        record.stop.issue_flags.length > 0 ||
        record.issuePhotoCount > 0;
  
      if (issuesOnly && !hasIssue) {
        return false;
      }
  
      return true;
    })
    .sort((a, b) =>
      sortHistoryRecords(a, b, selectedSort),
    );
  const completedRecords = visibleRecords.filter(
    (record) => record.stop.status === "completed",
  );

  const followUpRecords = visibleRecords.filter(
    (record) =>
      record.stop.status === "needs_follow_up",
  );

  const completedWithProof = completedRecords.filter(
    (record) =>
      record.beforePhotoCount > 0 &&
      record.afterPhotoCount > 0 &&
      record.checklist?.status === "submitted",
  );

  const servicedRevenue = completedRecords.reduce(
    (total, record) => {
      const amount =
        record.payment?.status === "paid"
          ? Number(record.payment.amount ?? 0)
          : Number(
              record.booking?.estimated_price ?? 0,
            );

      return total + (Number.isFinite(amount) ? amount : 0);
    },
    0,
  );

  const groupedRecords = groupRecordsByMonth(
    filteredRecords,
  );

  const hasActiveFilters = Boolean(
    searchTerm ||
      selectedYear ||
      selectedMonth ||
      selectedDay ||
      selectedStatus ||
      selectedTechnician ||
      selectedTime ||
      selectedProof ||
      issuesOnly ||
      selectedSort !== "newest",
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
    issuesOnly ? "issues" : "",
    selectedSort !== "newest" ? selectedSort : "",
  ].filter(Boolean).length;
  
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
      auth={context.auth}
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
          value={completedRecords.length}
        />

        <HistoryMetric
          icon={AlertTriangle}
          label="Follow-Ups"
          tone="warning"
          value={followUpRecords.length}
        />

        <HistoryMetric
          icon={ClipboardCheck}
          label="Proof Complete"
          tone="success"
          value={completedWithProof.length}
        />

        <HistoryMetric
          icon={DollarSign}
          label="Serviced"
          value={formatMoney(servicedRevenue)}
        />
      </section>

      <form
        action="/field/history"
        className="field-history-search"
        method="get"
      >
        <Search size={21} aria-hidden="true" />

        <input
          aria-label="Search service history"
          defaultValue={query?.q ?? ""}
          name="q"
          placeholder={
            canViewAllHistory
              ? "Search customer, address, technician, or route"
              : "Search customer, address, or route"
          }
          type="search"
        />

        <button type="submit">Search</button>

        {searchTerm ? (
          <Link href="/field/history">Clear</Link>
        ) : null}
      </form>

      {searchTerm ? (
        <div className="field-history-results-note">
          <strong>
            {filteredRecords.length}{" "}
            {filteredRecords.length === 1
              ? "record"
              : "records"}
          </strong>

          <span>
            matching “{query?.q?.trim()}”
          </span>
        </div>
      ) : null}

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
              {searchTerm
                ? "No matching service records"
                : "No service history yet"}
            </h2>

            <p>
              {searchTerm
                ? "Try another customer name, address, technician, or route."
                : "Completed stops and follow-up records will appear here."}
            </p>
          </div>

          {searchTerm ? (
            <Link
              className="button button-outline"
              href="/field/history"
            >
              Clear Search
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
    </FieldShell>
  );
}

function HistoryCard({
  record,
  canViewAllHistory,
}: {
  record: HistoryRecord;
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
    <article
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
      <div className="field-history-card-top">
        <div>
          <p className="section-kicker">
            {formatServiceDate(eventDate)}
          </p>

          <h3>{customerName}</h3>

          <p>{address}</p>
        </div>

        <span
          className={`status-badge status-${stop.status}`}
        >
          {humanizeStatus(stop.status)}
        </span>
      </div>

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
          complete={beforePhotoCount > 0}
          icon={Camera}
          label="Before"
          value={beforePhotoCount}
        />

        <ProofItem
          complete={checklistComplete}
          icon={ClipboardCheck}
          label="Checklist"
          value={checklistComplete ? "Done" : "Missing"}
        />

        <ProofItem
          complete={afterPhotoCount > 0}
          icon={Camera}
          label="After"
          value={afterPhotoCount}
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
              {stop.technician_notes ??
                stop.issue_flags
                  .map(humanizeStatus)
                  .join(", ") ??
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
          <span>View Service Record</span>
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
    </article>
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
  records: HistoryRecord[],
) {
  const groups = new Map<string, HistoryRecord[]>();

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
