"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type AdminOptimoRouteControlsProps = {
  routeDayId: string;
  routeDate: string;
  eligibleCount: number;
  needsReviewCount: number;
  syncedCount: number;
  importedCount: number;
  planningId?: number | null;
  planningStatus?: string | null;
};

type ApiResult = {
  ok?: boolean;
  error?: string;
  requestId?: string;
  synced?: unknown[];
  failed?: unknown[];
  skipped?: unknown[];
  planningId?: number | null;
  orderCount?: number;
  planningStatus?: string;
  percentageComplete?: number | null;
  imported?: unknown[];
  unscheduled?: unknown[];
  routeCount?: number;
  stopCount?: number;
  message?: string;
};

type ActionKey = "test" | "sync" | "start" | "status" | "import";

const endpoints: Record<ActionKey, string> = {
  test: "/api/admin/optimoroute/test-connection",
  sync: "/api/admin/optimoroute/sync",
  start: "/api/admin/optimoroute/start-planning",
  status: "/api/admin/optimoroute/planning-status",
  import: "/api/admin/optimoroute/import-schedule",
};

export function AdminOptimoRouteControls({
  routeDayId,
  routeDate,
  eligibleCount,
  needsReviewCount,
  syncedCount,
  importedCount,
  planningId,
  planningStatus,
}: AdminOptimoRouteControlsProps) {
  const router = useRouter();
  const [includePaymentBlocked, setIncludePaymentBlocked] = useState(false);
  const [includeNotApproved, setIncludeNotApproved] = useState(false);
  const [pendingAction, setPendingAction] = useState<ActionKey | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAction(action: ActionKey) {
    setPendingAction(action);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(endpoints[action], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routeDayId,
          includePaymentBlocked,
          includeNotApproved,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as ApiResult;

      if (!response.ok || result.error) {
        setError(
          [
            result.error ?? "OptimoRoute action failed.",
            result.requestId ? `Request ${result.requestId}` : "",
          ]
            .filter(Boolean)
            .join(" "),
        );
        return;
      }

      setMessage(formatSuccess(action, result));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "OptimoRoute action failed.");
    } finally {
      setPendingAction(null);
    }
  }

  const hasSyncedStops = syncedCount > 0 || importedCount > 0;
  const canImport = ["finished", "imported"].includes(planningStatus ?? "");
  const busy = pendingAction !== null;

  return (
    <div className="optimoroute-controls">
      <div className="optimoroute-stats" aria-label={`OptimoRoute status for ${routeDate}`}>
        <span>
          <strong>{eligibleCount}</strong> eligible
        </span>
        <span>
          <strong>{needsReviewCount}</strong> needs review
        </span>
        <span>
          <strong>{syncedCount}</strong> synced
        </span>
        <span>
          <strong>{importedCount}</strong> imported
        </span>
      </div>

      <div className="inline-check-grid">
        <label className="inline-check">
          <input
            checked={includePaymentBlocked}
            onChange={(event) => setIncludePaymentBlocked(event.target.checked)}
            type="checkbox"
          />
          <span>Include payment holds intentionally</span>
        </label>
        <label className="inline-check">
          <input
            checked={includeNotApproved}
            onChange={(event) => setIncludeNotApproved(event.target.checked)}
            type="checkbox"
          />
          <span>Include not-approved bookings intentionally</span>
        </label>
      </div>

      <div className="button-row compact-actions">
        <button
          className="button button-outline"
          disabled={busy}
          onClick={() => runAction("test")}
          type="button"
        >
          {pendingAction === "test" ? "Testing..." : "Test Connection"}
        </button>
        <button
          className="button button-dark"
          disabled={busy || (!eligibleCount && !includePaymentBlocked && !includeNotApproved)}
          onClick={() => runAction("sync")}
          type="button"
        >
          {pendingAction === "sync" ? "Syncing..." : "Sync Stops"}
        </button>
        <button
          className="button button-outline"
          disabled={busy || !hasSyncedStops}
          onClick={() => runAction("start")}
          type="button"
        >
          {pendingAction === "start" ? "Starting..." : "Start Optimization"}
        </button>
        <button
          className="button button-outline"
          disabled={busy || !planningId}
          onClick={() => runAction("status")}
          type="button"
        >
          {pendingAction === "status" ? "Checking..." : "Check Status"}
        </button>
        <button
          className="button button-primary"
          disabled={busy || !hasSyncedStops || !canImport}
          onClick={() => runAction("import")}
          type="button"
        >
          {pendingAction === "import" ? "Importing..." : "Import Optimized Route"}
        </button>
      </div>

      <p className="optimoroute-note">
        {planningId ? `Planning #${planningId}` : "No planning job yet"}
        {planningStatus ? ` - ${planningStatus}` : ""}. Clean Curb Co remains the
        source of truth for service, payment, photos, notes, and checklists.
        {!canImport && hasSyncedStops ? " Import unlocks after planning status is finished." : ""}
      </p>
      {message ? <p className="optimoroute-message success">{message}</p> : null}
      {error ? <p className="optimoroute-message error">{error}</p> : null}
    </div>
  );
}

function formatSuccess(action: ActionKey, result: ApiResult) {
  if (action === "test") {
    return `${result.message ?? "OptimoRoute connection test completed."} Routes returned for preflight date: ${result.routeCount ?? 0}; stops: ${result.stopCount ?? 0}.`;
  }
  if (action === "sync") {
    return `Synced ${(result.synced ?? []).length} stop(s); ${(result.failed ?? []).length} failed; ${(result.skipped ?? []).length} skipped.`;
  }
  if (action === "start") {
    return `Optimization started for ${result.orderCount ?? 0} stop(s).`;
  }
  if (action === "status") {
    return `Planning status: ${result.planningStatus ?? "unknown"}${
      typeof result.percentageComplete === "number"
        ? ` (${result.percentageComplete}% complete)`
        : ""
    }.`;
  }
  return `Imported ${(result.imported ?? []).length} stop(s); ${(result.unscheduled ?? []).length} needs review.`;
}
