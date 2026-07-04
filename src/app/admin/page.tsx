import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/shells/admin-shell";
import { humanizeStatus } from "@/lib/booking-utils";
import { getAdminContext } from "@/lib/admin-data";

export const metadata: Metadata = {
  title: "Admin Command Center",
  description: "Clean Curb Co. admin command center.",
};

export default async function AdminPage() {
  const context = await getAdminContext("/admin");
  const stats = getCommandCenterStats(context);

const recentBookings = context.bookings
  .filter((booking) => !["cancelled"].includes(booking.status))
  .slice(0, 5);

const activeRequests = context.requests
  .filter((request) => ["new", "reviewing", "approved"].includes(request.status))
  .slice(0, 5);

const recentNotifications = context.adminNotifications.slice(0, 5);

  return (
    <AdminShell title="Admin portal" auth={context.auth}>
      <section className="placeholder-panel admin-command-page">
        <div className="admin-page-heading">
          <div>
            <p className="section-kicker">Command Center</p>
            <h1>Today’s operating picture.</h1>
            <p className="muted">
              Start here to see what needs action, what may block service, and
              where to jump next.
            </p>
          </div>

          <div className="status-stack">
            <span className="status-badge">{context.bookings.length} bookings</span>
            <span className="status-badge">{context.profiles.length} customers</span>
            <span className="status-badge">{context.routeDays.length} routes</span>
          </div>
        </div>

        <section className="admin-command-section">
          <div className="admin-row-heading">
            <div>
              <p className="section-kicker">Needs Action</p>
              <h2>Handle these first.</h2>
            </div>
          </div>

          <div className="admin-command-grid">
            <CommandStatCard
              href="/admin/bookings"
              label="New bookings"
              value={stats.newBookings}
              detail="Accept, follow up, or route."
              tone={stats.newBookings ? "warning" : "good"}
            />

            <CommandStatCard
              href="/admin/bookings?status=needs_follow_up"
              label="Needs follow-up"
              value={stats.needsFollowUp}
              detail="Customers or bookings waiting on us."
              tone={stats.needsFollowUp ? "warning" : "good"}
            />

            <CommandStatCard
              href="/admin/payments"
              label="Payment issues"
              value={stats.paymentIssues}
              detail="Failed, missing, or pending payment setup."
              tone={stats.paymentIssues ? "danger" : "good"}
            />

            <CommandStatCard
              href="/admin/requests"
              label="Active requests"
              value={stats.activeRequests}
              detail="Customer changes awaiting a decision."
              tone={stats.activeRequests ? "warning" : "good"}
            />

            <CommandStatCard
              href="/admin/routes"
              label="Routes needing work"
              value={stats.routesNeedingWork}
              detail="Routes with no stops or routing still pending."
              tone={stats.routesNeedingWork ? "warning" : "good"}
            />

            <CommandStatCard
              href="/admin/checklists"
              label="Checklist follow-up"
              value={stats.checklistFollowUp}
              detail="Incomplete field proof or service records."
              tone={stats.checklistFollowUp ? "warning" : "good"}
            />
          </div>
        </section>

        <section className="admin-command-section">
          <div className="admin-row-heading">
            <div>
              <p className="section-kicker">Main Workflows</p>
              <h2>Jump to the right tool.</h2>
            </div>
          </div>

          <div className="admin-workflow-grid">
            <WorkflowCard
              href="/admin/bookings"
              title="Bookings"
              description="Review new bookings, approve route dates, send payment setup, and manage booking status."
            />
            <WorkflowCard
              href="/admin/routes"
              title="Routes"
              description="Create route days, add stops, run OptimoRoute, import optimized order, and prep the field app."
            />
            <WorkflowCard
              href="/admin/payments"
              title="Payments"
              description="Track payment links, setup status, failures, manual updates, and service clearance."
            />
            <WorkflowCard
              href="/admin/requests"
              title="Requests"
              description="Approve, deny, complete, or archive customer service-change requests."
            />
            <WorkflowCard
              href="/admin/customers"
              title="Customers"
              description="Find customer profiles, addresses, bookings, requests, payment history, and service records."
            />
            <WorkflowCard
              href="/field/today"
              title="Field App"
              description="Open the technician view for today’s stops, checklists, photos, and route progress."
            />
          </div>
        </section>

        <section className="command-feed-board">
          <CommandFeedPanel
            title="Recent bookings"
            empty="No active booking records yet."
            actionHref="/admin/bookings"
            actionLabel="View all"
          >
            {recentBookings.map((booking) => (
              <Link
                className="command-feed-row"
                href={`/admin/bookings?q=${booking.id}`}
                key={booking.id}
              >
                <div>
                  <strong>
                    {booking.first_name} {booking.last_name}
                  </strong>
                  <span>{booking.street_address}</span>
                </div>

                <div className="command-feed-meta">
                  <span className={`status-badge status-${booking.status}`}>
                    {humanizeStatus(booking.status)}
                  </span>
                  <small>${booking.estimated_price}</small>
                </div>
              </Link>
            ))}
          </CommandFeedPanel>

          <CommandFeedPanel
            title="Active customer requests"
            empty="No active customer requests."
            actionHref="/admin/requests"
            actionLabel="View queue"
          >
            {activeRequests.map((request) => (
              <Link
                className="command-feed-row"
                href={`/admin/requests?q=${request.id}`}
                key={request.id}
              >
                <div>
                  <strong>{humanizeStatus(request.request_type)}</strong>
                  <span>{request.message ?? "No customer message."}</span>
                </div>

                <div className="command-feed-meta">
                  <span className={`status-badge status-${request.status}`}>
                    {humanizeStatus(request.status)}
                  </span>
                  <small>{formatDateTime(request.created_at)}</small>
                </div>
              </Link>
            ))}
          </CommandFeedPanel>

          <CommandFeedPanel
            title="Admin notifications"
            empty="No admin notifications."
            actionHref="/admin/settings"
            actionLabel="System status"
          >
            {recentNotifications.map((notification) => (
              <Link
                className="command-feed-row"
                href={notification.href ?? "/admin/settings"}
                key={notification.id}
              >
                <div>
                  <strong>{notification.title}</strong>
                  <span>{notification.message}</span>
                </div>

                <div className="command-feed-meta">
                  <span className={`status-badge status-${notification.severity}`}>
                    {humanizeStatus(notification.severity)}
                  </span>
                  <small>{formatDateTime(notification.created_at)}</small>
                </div>
              </Link>
            ))}
          </CommandFeedPanel>
        </section>
      </section>
    </AdminShell>
  );
}

function CommandStatCard({
  href,
  label,
  value,
  detail,
  tone,
}: {
  href: string;
  label: string;
  value: number;
  detail: string;
  tone: "good" | "warning" | "danger";
}) {
  return (
    <Link className={`command-stat-card command-stat-${tone}`} href={href}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </Link>
  );
}

function WorkflowCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link className="workflow-card" href={href}>
      <h3>{title}</h3>
      <p>{description}</p>
      <span>Open →</span>
    </Link>
  );
}

function CommandFeedPanel({
  title,
  empty,
  actionHref,
  actionLabel,
  children,
}: {
  title: string;
  empty: string;
  actionHref: string;
  actionLabel: string;
  children: ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);

  return (
    <article className="command-feed-panel">
      <div className="command-feed-heading">
        <h2>{title}</h2>
        <Link href={actionHref}>{actionLabel}</Link>
      </div>

      <div className="command-feed-list">
        {hasChildren ? children : <p className="command-feed-empty">{empty}</p>}
      </div>
    </article>
  );
}

function getCommandCenterStats(context: Awaited<ReturnType<typeof getAdminContext>>) {
  const activeRequestStatuses = ["new", "reviewing", "approved"];
  const activeRouteStatuses = ["planned", "active"];

  const paymentIssues = context.bookings.filter((booking) => {
    const terminal = ["cancelled", "completed"].includes(booking.status);
    if (terminal) return false;

    if (booking.payment_status === "failed") return true;
    if (booking.payment_status !== "paid" && !booking.payment_method_on_file) {
      return true;
    }

    return false;
  }).length;

  const routesNeedingWork = context.routeDays.filter((routeDay) => {
    if (!activeRouteStatuses.includes(routeDay.status)) return false;

    const stops = context.routeStops.filter(
      (stop) => stop.route_day_id === routeDay.id,
    );

    if (!stops.length) return true;

    return stops.some((stop) =>
      ["scheduled", "needs_follow_up", "rescheduled"].includes(stop.status),
    );
  }).length;

  return {
    newBookings: context.bookings.filter((booking) => booking.status === "new").length,
    needsFollowUp: context.bookings.filter(
      (booking) => booking.status === "needs_follow_up",
    ).length,
    paymentIssues,
    activeRequests: context.requests.filter((request) =>
      activeRequestStatuses.includes(request.status),
    ).length,
    routesNeedingWork,
    checklistFollowUp: context.checklists.filter(
      (checklist) => !checklist.service_completed,
    ).length,
  };
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}