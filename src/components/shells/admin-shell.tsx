import Link from "next/link";
import { Bell } from "lucide-react";
import {
  markAdminNotificationReadAction,
  markAllAdminNotificationsReadAction,
} from "@/app/admin/actions";
import { LogoutButton } from "@/components/logout-button";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin, type AuthResult } from "@/lib/supabase/auth";

const adminLinks = [
  { label: "Dashboard", href: "/admin" },
  { label: "Field App", href: "/field" },
  { label: "Bookings", href: "/admin/bookings" },
  { label: "Routes", href: "/admin/routes" },
  { label: "Checklists", href: "/admin/checklists" },
  { label: "Customers", href: "/admin/customers" },
  { label: "Payments", href: "/admin/payments" },
  { label: "Requests", href: "/admin/requests" },
  { label: "Referrals", href: "/admin/referrals" },
  { label: "Careers", href: "/admin/careers" },
  { label: "Reviews", href: "/admin/reviews" },
  { label: "Settings", href: "/admin/settings" },
];

export async function AdminShell({
  title,
  children,
  auth,
}: {
  title: string;
  children?: React.ReactNode;
  auth?: AuthResult;
}) {
  const currentAuth = auth ?? (await requireAdmin("/admin"));

  if (currentAuth.status !== "ok") {
    return (
      <main className="section section-cream">
        <div className="container shell-layout">
          <section className="placeholder-panel">
            <p className="section-kicker">Protected Area</p>
            <h1>{title}</h1>
            <p>{currentAuth.message}</p>
          </section>
        </div>
      </main>
    );
  }

  const { data: notifications } = await getSupabaseAdmin()
    .from("admin_notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);
  const recentNotifications = notifications ?? [];
  const unreadCount = recentNotifications.filter((item) => !item.read_at).length;

  return (
    <main className="section section-cream">
      <div className="container shell-layout">
        <div className="shell-topbar">
          <nav className="shell-nav" aria-label="Admin navigation">
            {adminLinks.map((link) => (
              <Link href={link.href} key={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
          <details className="admin-notification-menu">
            <summary aria-label="Admin notifications">
              <Bell size={20} aria-hidden="true" />
              {unreadCount ? (
                <span className="admin-notification-badge">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </summary>
            <div className="admin-notification-dropdown">
              <div className="admin-notification-header">
                <strong>Notifications</strong>
                {unreadCount ? (
                  <form action={markAllAdminNotificationsReadAction}>
                    <button className="button-link" type="submit">
                      Mark all read
                    </button>
                  </form>
                ) : null}
              </div>
              {recentNotifications.length ? (
                recentNotifications.map((notification) => (
                  <article
                    className={`admin-notification-item ${
                      notification.read_at ? "" : "is-unread"
                    }`}
                    key={notification.id}
                  >
                    <div>
                      <strong>{notification.title}</strong>
                      <p>{notification.message}</p>
                      <small>{formatNotificationDate(notification.created_at)}</small>
                    </div>
                    <div className="admin-notification-actions">
                      {notification.href ? (
                        <Link href={notification.href}>Open</Link>
                      ) : null}
                      {!notification.read_at ? (
                        <form action={markAdminNotificationReadAction}>
                          <input
                            type="hidden"
                            name="notificationId"
                            value={notification.id}
                          />
                          <button className="button-link" type="submit">
                            Mark read
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </article>
                ))
              ) : (
                <p className="muted">No admin notifications yet.</p>
              )}
            </div>
          </details>
          <LogoutButton />
        </div>
        {children ?? (
          <section className="placeholder-panel">
            <p className="section-kicker">Protected Area</p>
            <h1>{title}</h1>
            <p>
              Admin tools are available after sign-in.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}

function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
