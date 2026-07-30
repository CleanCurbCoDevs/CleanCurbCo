import "server-only";

import { humanizeStatus } from "@/lib/booking-utils";
import type { getSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  BookingRow,
  ChecklistItemStatus,
  RouteStopRow,
  ServiceChecklistDocumentRow,
  ServiceChecklistItemRow,
  ServiceChecklistRow,
  ServiceVisitRow,
} from "@/types/database";

type AdminClient = ReturnType<typeof getSupabaseAdmin>;

export { generateChecklistPdf } from "@/lib/service-checklist-pdf";

export type ChecklistTemplateItem = {
  sectionKey: string;
  sectionName: string;
  itemKey: string;
  label: string;
  sortOrder: number;
  isRequired: boolean;
};

export type ServiceChecklistBundle = {
  visit: ServiceVisitRow;
  booking: BookingRow;
  stop: RouteStopRow | null;
  checklist: ServiceChecklistRow;
  items: ServiceChecklistItemRow[];
  documents: ServiceChecklistDocumentRow[];
};

export const checklistStatuses: readonly ChecklistItemStatus[] = [
  "pending",
  "completed",
  "not_applicable",
  "issue_found",
];

const sections = {
  arrival: {
    name: "Arrival",
    items: [
      "Service address and bin count confirmed.",
      "Bins are accessible and safe to service.",
      "Before-service photos captured.",
    ],
  },

  bin_cleaning: {
    name: "Bin Cleaning",
    items: [
      "Bin interiors washed and rinsed.",
      "Lids, handles, wheels, and exterior touchpoints cleaned.",
      "Visible residue removed as reasonably possible.",
      "Deodorizer applied.",
      "Bins returned to the requested location.",
    ],
  },

  trash_pad_refresh: {
    name: "Trash Pad Refresh",
    items: [
      "Loose debris removed.",
      "Service area cleaned and rinsed.",
      "Area left tidy.",
    ],
  },

  deodorizer_boost: {
    name: "Deodorizer Boost",
    items: [
      "Deodorizer applied to the appropriate bins or areas.",
      "Treatment completed without overspray or property exposure.",
    ],
  },

  heavy_grime_cleanup: {
    name: "Heavy Grime Cleanup",
    items: [
      "Heavy buildup documented before service.",
      "Affected areas pre-treated and agitated as needed.",
      "Improved condition confirmed after cleaning.",
    ],
  },

  driveway_sidewalk_spot_clean: {
    name: "Driveway / Sidewalk Spot Clean",
    items: [
      "Target area confirmed.",
      "Target area cleaned and rinsed.",
      "Surrounding area left clean.",
    ],
  },

  pet_waste_cleanup: {
    name: "Pet Waste Cleanup",
    items: [
      "Agreed cleanup area checked.",
      "Visible pet waste removed.",
      "Collected waste disposed of appropriately.",
      "Area confirmed complete.",
    ],
  },

  departure: {
    name: "Final Walkthrough",
    items: [
      "All scheduled services completed.",
      "After-service photos captured.",
      "Gates and surrounding service area left secure and tidy.",
    ],
  },
} as const;

const addOnSectionKeys = [
  "trash_pad_refresh",
  "deodorizer_boost",
  "heavy_grime_cleanup",
  "driveway_sidewalk_spot_clean",
  "pet_waste_cleanup",
] as const;

export function servicesPerformedForBooking(booking: BookingRow) {
  const serviceNames = ["Bin Cleaning"];

  addOnSectionKeys.forEach((key) => {
    if (booking.add_ons.includes(key)) {
      serviceNames.push(sections[key].name.replace(" Checklist", ""));
    }
  });

  return serviceNames;
}

export function buildChecklistTemplate(booking: BookingRow): ChecklistTemplateItem[] {
  const sectionKeys = [
    "arrival",
    "bin_cleaning",
    ...addOnSectionKeys.filter((key) => booking.add_ons.includes(key)),
    "departure",
  ] as const;

  return sectionKeys.flatMap((sectionKey, sectionIndex) => {
    const section = sections[sectionKey];
    return section.items.map((label, itemIndex) => ({
      sectionKey,
      sectionName: section.name,
      itemKey: `${sectionKey}_${itemIndex + 1}`,
      label,
      sortOrder: sectionIndex * 100 + itemIndex + 1,
      isRequired: true,
    }));
  });
}

export async function ensureServiceChecklistBundle(
  admin: AdminClient,
  visitId: string,
): Promise<ServiceChecklistBundle | null> {
  const { data: visit } = await admin
    .from("service_visits")
    .select("*")
    .eq("id", visitId)
    .maybeSingle();

  if (!visit?.booking_id) return null;

  const [{ data: booking }, { data: stop }] = await Promise.all([
    admin.from("bookings").select("*").eq("id", visit.booking_id).maybeSingle(),
    admin
      .from("route_stops")
      .select("*")
      .eq("service_visit_id", visit.id)
      .maybeSingle(),
  ]);

  if (!booking) return null;

  const servicesPerformed = servicesPerformedForBooking(booking);
  let { data: checklist } = await admin
    .from("service_checklists")
    .select("*")
    .eq("service_visit_id", visit.id)
    .maybeSingle();

  if (!checklist) {
    const { data: createdChecklist, error } = await admin
      .from("service_checklists")
      .insert({
        service_visit_id: visit.id,
        route_stop_id: stop?.id ?? null,
        booking_id: booking.id,
        customer_id: booking.customer_id,
        services_performed: servicesPerformed,
        status: "draft",
      })
      .select("*")
      .single();

    if (error || !createdChecklist) return null;
    checklist = createdChecklist;
  } else if (checklist.status !== "submitted") {
    const { data: updatedChecklist } = await admin
      .from("service_checklists")
      .update({
        route_stop_id: checklist.route_stop_id ?? stop?.id ?? null,
        booking_id: checklist.booking_id ?? booking.id,
        customer_id: checklist.customer_id ?? booking.customer_id,
        services_performed: servicesPerformed,
      })
      .eq("id", checklist.id)
      .select("*")
      .single();
    checklist = updatedChecklist ?? checklist;
  }

const templateItems = buildChecklistTemplate(booking);

const { data: existingItems } = await admin
  .from("service_checklist_items")
  .select("*")
  .eq("checklist_id", checklist.id)
  .order("sort_order", { ascending: true });

const currentItems = existingItems ?? [];
const templateKeys = new Set(
  templateItems.map((item) => item.itemKey),
);

if (checklist.status !== "submitted") {
  const obsoleteItemIds = currentItems
    .filter((item) => !templateKeys.has(item.item_key))
    .map((item) => item.id);

  if (obsoleteItemIds.length) {
    await admin
      .from("service_checklist_items")
      .delete()
      .in("id", obsoleteItemIds);
  }
}

const retainedItems =
  checklist.status === "submitted"
    ? currentItems
    : currentItems.filter((item) =>
        templateKeys.has(item.item_key),
      );

const existingKeys = new Set(
  retainedItems.map((item) => item.item_key),
);

const missingItems = templateItems.filter(
  (item) => !existingKeys.has(item.itemKey),
);

  if (missingItems.length && checklist.status !== "submitted") {
    await admin.from("service_checklist_items").insert(
      missingItems.map((item) => ({
        checklist_id: checklist.id,
        service_visit_id: visit.id,
        booking_id: booking.id,
        section_key: item.sectionKey,
        section_name: item.sectionName,
        item_key: item.itemKey,
        label: item.label,
        sort_order: item.sortOrder,
        is_required: item.isRequired,
      })),
    );
  }

  const [{ data: items }, { data: documents }] = await Promise.all([
    admin
      .from("service_checklist_items")
      .select("*")
      .eq("checklist_id", checklist.id)
      .order("sort_order", { ascending: true }),
    admin
      .from("service_checklist_documents")
      .select("*")
      .eq("checklist_id", checklist.id)
      .order("generated_at", { ascending: false }),
  ]);

  return {
    visit,
    booking,
    stop: stop ?? null,
    checklist,
    items: items ?? [],
    documents: documents ?? [],
  };
}

export function checklistProgress(items: ServiceChecklistItemRow[]) {
  const total = items.filter((item) => item.is_required).length;
  const resolved = items.filter(
    (item) => item.is_required && item.status !== "pending",
  ).length;
  return { total, resolved };
}

export function unresolvedChecklistItems(items: ServiceChecklistItemRow[]) {
  return items.filter((item) => item.is_required && item.status === "pending");
}

export function groupChecklistItems(items: ServiceChecklistItemRow[]) {
  return items.reduce<
    Array<{ sectionKey: string; sectionName: string; items: ServiceChecklistItemRow[] }>
  >((groups, item) => {
    const existing = groups.find((group) => group.sectionKey === item.section_key);
    if (existing) {
      existing.items.push(item);
      return groups;
    }
    return [
      ...groups,
      {
        sectionKey: item.section_key,
        sectionName:
          item.section_key === "departure" || item.section_name === "Finish Up"
            ? "Final Walkthrough"
            : item.section_name,
        items: [item],
      },
    ];
  }, []);
}

export function checklistStatusLabel(status: ChecklistItemStatus) {
  if (status === "not_applicable") return "Not Applicable";
  if (status === "issue_found") return "Issue Found";
  return humanizeStatus(status);
}
