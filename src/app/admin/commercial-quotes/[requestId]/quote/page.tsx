import type {
  Metadata,
} from "next";

import Link from "next/link";

import "./commercial-quote-builder.css";

import {
  CommercialQuoteComposer,
} from "@/components/admin/commercial-quote-composer";

import {
  CustomerFileArchivePanel,
} from "@/components/admin/customer-file-archive-panel";

import {
  AdminShell,
} from "@/components/shells/admin-shell";

import {
  commercialPricingProfileRowToValues,
} from "@/lib/commercial-pricing-profile";

import {
  COMMERCIAL_QUOTE_DOCUMENT_TYPE,
  getCommercialQuoteSourceSnapshotHash,
} from "@/lib/customer-file-archive";

import {
  getSupabaseAdmin,
} from "@/lib/supabase/admin";

import {
  requireAdmin,
} from "@/lib/supabase/auth";

import {
  commercialPropertyTypeLabels,
  commercialServiceInterestLabels,
} from "@/types/commercial";

export const metadata:
  Metadata = {
    title:
      "Commercial Quote Builder",
  };

type CommercialQuoteBuilderPageProps = {
  params: Promise<{
    requestId: string;
  }>;
};

export default async function CommercialQuoteBuilderPage({
  params,
}: CommercialQuoteBuilderPageProps) {
  const {
    requestId,
  } = await params;

  const path =
    `/admin/commercial-quotes/${requestId}/quote`;

  const auth =
    await requireAdmin(path);

  if (auth.status !== "ok") {
    return (
      <AdminShell
        title="Commercial Quote Builder"
        auth={auth}
      />
    );
  }

  const admin =
    getSupabaseAdmin();

  const [
    requestResult,
    pricingProfileResult,
    draftResult,
    customerFilesResult,
    customerDeliveriesResult,
  ] = await Promise.all([
    admin
      .from(
        "commercial_quote_requests",
      )
      .select("*")
      .eq("id", requestId)
      .maybeSingle(),

    admin
      .from(
        "commercial_pricing_profiles",
      )
      .select("*")
      .eq("is_active", true)
      .maybeSingle(),

    admin
      .from("commercial_quotes")
      .select("*")
      .eq(
        "request_id",
        requestId,
      )
      .in(
        "status",
        [
          "draft",
          "sent",
        ],
      )
      .order(
        "version_number",
        {
          ascending: false,
        },
      )
      .limit(1)
      .maybeSingle(),
    
    admin
      .from(
        "customer_files",
      )
      .select("*")
      .eq(
        "commercial_request_id",
        requestId,
      )
      .order(
        "created_at",
        {
          ascending: false,
        },
      ),

    admin
      .from(
        "customer_deliveries",
      )
      .select("*")
      .eq(
        "commercial_request_id",
        requestId,
      )
      .order(
        "created_at",
        {
          ascending: false,
        },
      ),
  ]);

  const request =
    requestResult.data;

  if (!request) {
    return (
      <AdminShell
        title="Commercial Quote Builder"
        auth={auth}
      >
        <section className="placeholder-panel">
          <p className="section-kicker">
            Request Missing
          </p>

          <h1>
            That commercial request
            could not be loaded.
          </h1>

          <p className="muted">
            It may have been removed,
            or the link may be
            incomplete.
          </p>

          <Link
            className="button button-outline"
            href="/admin/commercial-quotes"
          >
            Back to Commercial
            Quotes
          </Link>
        </section>
      </AdminShell>
    );
  }

  const pricingProfileRow =
    pricingProfileResult.data ??
    null;

  const pricingProfile =
    commercialPricingProfileRowToValues(
      pricingProfileRow,
    );

  const existingDraft =
    draftResult.data ?? null;

  const quoteLineItems =
    existingDraft
      ? (
          await admin
            .from(
              "commercial_quote_line_items",
            )
            .select("*")
            .eq(
              "quote_id",
              existingDraft.id,
            )
            .eq(
              "is_customer_visible",
              true,
            )
            .order(
              "sort_order",
              {
                ascending:
                  true,
              },
            )
        ).data ?? []
      : [];

  
  const customerFiles =
    customerFilesResult.data ??
    [];
  
  const customerDeliveries =
    customerDeliveriesResult.data ??
    [];
  
  const latestCustomerCopy =
    customerFiles
      .filter(
        (file) =>
          file.document_type ===
            COMMERCIAL_QUOTE_DOCUMENT_TYPE &&
          file.status !== "void",
      )
      .sort(
        (
          left,
          right,
        ) =>
          right.version_number -
          left.version_number,
      )[0] ?? null;

  const latestCustomerCopyMatchesSavedQuote =
    Boolean(
      existingDraft &&
        latestCustomerCopy &&
        latestCustomerCopy
          .source_snapshot_hash ===
          getCommercialQuoteSourceSnapshotHash(
            request,
            existingDraft,
            quoteLineItems,
          )
    );
  
  const services =
    request.service_interests.map(
      (service) =>
        commercialServiceInterestLabels[
          service
        ],
    );

  const propertyType =
    request.property_type ===
      "other" &&
    request.property_type_other
      ? request.property_type_other
      : commercialPropertyTypeLabels[
          request.property_type
        ];

  return (
    <AdminShell
      title="Commercial Quote Builder"
      auth={auth}
    >
      <div className="commercial-quote-builder-page">
        <section className="placeholder-panel commercial-builder-context">
          <div className="admin-page-heading">
            <div>
              <p className="section-kicker">
                Quote Workspace
              </p>

              <h1>
                {request.business_name}
              </h1>

              <p className="muted">
                {request.street_address},{" "}
                {request.city},{" "}
                {request.state}{" "}
                {request.zip_code}
              </p>
            </div>

            <div className="admin-action-cluster">
              <Link
                className="button button-outline"
                href={`/admin/commercial-quotes?q=${request.id}`}
              >
                Back to Request
              </Link>
            </div>
          </div>

          <div className="admin-record-overview">
            <ContextTile
              label="Property type"
              value={propertyType}
            />

            <ContextTile
              label="Contact"
              value={
                request.contact_name
              }
            />

            <ContextTile
              label="Locations"
              value={String(
                request.location_count,
              )}
            />

            <ContextTile
              label="Container count"
              value={
                request.container_count
                  ? String(
                      request.container_count,
                    )
                  : "Not provided"
              }
            />

            <ContextTile
              label="Requested services"
              value={
                services.join(", ") ||
                "Not specified"
              }
            />

            <ContextTile
              label="Payment structure"
              value="10% to reserve service; 10%-50% total before service based on project price"
            />
            
            <ContextTile
              label="Quote status"
              value={
                existingDraft
                  ? `${
                      existingDraft.status ===
                      "sent"
                        ? "Sent"
                        : "Draft"
                    } v${existingDraft.version_number}`
                  : "No quote yet"
              }
            />
          </div>
        </section>

        <CommercialQuoteComposer
          request={request}
          pricingProfile={
            pricingProfile
          }
          pricingProfileId={
            pricingProfileRow?.id ??
            null
          }
          pricingProfileName={
            pricingProfileRow?.name ??
            "Clean Curb Co. default pricing"
          }
          existingDraft={
            existingDraft
          }
          latestCustomerCopy={
            latestCustomerCopy
          }
          latestCustomerCopyMatchesSavedQuote={
            latestCustomerCopyMatchesSavedQuote
          }
        />
        
        <CustomerFileArchivePanel
          files={customerFiles}
          deliveries={
            customerDeliveries
          }
          requestId={
            request.id
          }
          recipientName={
            request.contact_name
          }
          recipientEmail={
            request.email
          }
          latestQuoteFileId={
            latestCustomerCopy?.id ??
            null
          }
          latestQuoteMatchesSavedQuote={
            latestCustomerCopyMatchesSavedQuote
          }
        />
      </div>
    </AdminShell>
  );
}

function ContextTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
