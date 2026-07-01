import type { Metadata } from "next";
import Link from "next/link";
import { ServiceChecklistPanel } from "@/components/service-checklist-panel";
import { AdminShell } from "@/components/shells/admin-shell";
import { ensureServiceChecklistBundle } from "@/lib/service-checklists";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Admin Service Checklist",
};

type AdminChecklistPageProps = {
  params: Promise<{ visitId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function AdminChecklistPage({
  params,
  searchParams,
}: AdminChecklistPageProps) {
  const [{ visitId }, query] = await Promise.all([params, searchParams]);
  const auth = await requireAdmin(`/admin/checklists/${visitId}`);
  const admin = getSupabaseAdmin();
  const bundle =
    auth.status === "ok" ? await ensureServiceChecklistBundle(admin, visitId) : null;
  const signedDocuments = bundle ? await createSignedDocuments(bundle.documents) : [];

  return (
    <AdminShell title="Service checklist" auth={auth}>
      <section className="placeholder-panel">
        <div className="admin-page-heading">
          <div>
            <p className="section-kicker">Checklist</p>
            <h1>Appointment checklist.</h1>
          </div>
          <Link className="button button-outline" href="/admin/checklists">
            All Checklists
          </Link>
        </div>
        {bundle ? (
          <ServiceChecklistPanel
            adminMode
            bundle={bundle}
            documents={signedDocuments}
            notice={query.checklist}
            returnTo={`/admin/checklists/${visitId}`}
          />
        ) : (
          <p>Checklist could not be loaded for this service visit.</p>
        )}
      </section>
    </AdminShell>
  );
}

async function createSignedDocuments(
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
