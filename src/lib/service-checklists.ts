import "server-only";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatBookingAddress, humanizeStatus } from "@/lib/booking-utils";
import { brand } from "@/lib/site";
import type { getSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  BookingRow,
  ChecklistItemStatus,
  ProfileRow,
  RouteStopRow,
  ServiceChecklistDocumentRow,
  ServiceChecklistItemRow,
  ServiceChecklistRow,
  ServiceVisitRow,
} from "@/types/database";

type AdminClient = ReturnType<typeof getSupabaseAdmin>;

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
    name: "Arrival Checklist",
    items: [
      "Confirm correct customer, address, and scheduled service.",
      "Confirm access to bins/service area.",
      "Check for locked gates, pets, blocked access, or safety hazards.",
      "Review visible pre-service condition.",
      "Confirm equipment/supplies are ready.",
      "Document any arrival issues.",
    ],
  },
  bin_cleaning: {
    name: "Bin Cleaning Checklist",
    items: [
      "Confirm number of bins to be serviced.",
      "Inspect bins for damage, biohazards, excessive weight, or blocked access.",
      "Clean/rinse bin interior.",
      "Clean exterior touchpoints/handles/lid area as applicable.",
      "Remove visible residue as reasonably possible.",
      "Apply deodorizer if included in service.",
      "Return bins to proper location.",
      "Document any unserviceable bin, remaining stuck-on debris, damage, or issue.",
    ],
  },
  trash_pad_refresh: {
    name: "Trash Pad Refresh Checklist",
    items: [
      "Inspect trash pad/service area condition.",
      "Remove loose debris from service area.",
      "Rinse/clean pad or designated area.",
      "Treat odor/staining as applicable.",
      "Confirm area is left tidy.",
      "Document remaining stains, damage, or access issues.",
    ],
  },
  deodorizer_boost: {
    name: "Deodorizer Boost Checklist",
    items: [
      "Confirm deodorizer service is included.",
      "Apply deodorizer to appropriate bins/areas.",
      "Avoid over-application or customer property exposure.",
      "Confirm odor-control treatment is complete.",
      "Document any odor concerns or unusual conditions.",
    ],
  },
  heavy_grime_cleanup: {
    name: "Heavy Grime Cleanup Checklist",
    items: [
      "Confirm heavy grime cleanup was booked/approved.",
      "Document excessive buildup before service.",
      "Pre-treat affected areas as applicable.",
      "Perform extra cleaning/agitation/rinse as needed.",
      "Confirm improved condition after cleaning.",
      "Document any permanent staining, stuck-on material, or remaining issue.",
    ],
  },
  driveway_sidewalk_spot_clean: {
    name: "Driveway/Sidewalk Spot Clean Checklist",
    items: [
      "Confirm target spot/area.",
      "Inspect surface before cleaning.",
      "Clean/rinse designated spot area.",
      "Manage runoff as reasonably possible.",
      "Confirm surrounding area is left clean.",
      "Document remaining stains, surface damage, or limitations.",
    ],
  },
  pet_waste_cleanup: {
    name: "Pet Waste Cleanup Checklist",
    items: [
      "Walk the designated cleanup area.",
      "Remove visible pet waste from agreed area.",
      "Dispose of collected waste appropriately.",
      "Apply odor/sanitation treatment if included.",
      "Confirm area is completed.",
      "Document inaccessible areas, excessive waste, hazards, or limitations.",
    ],
  },
  departure: {
    name: "Departure Checklist",
    items: [
      "Confirm all booked services were completed or properly marked with issues.",
      "Confirm bins/items were returned to proper location.",
      "Confirm service area was left clean/tidy.",
      "Confirm gates/access points were closed/secured if applicable.",
      "Record final notes/issues for customer/admin.",
      "Technician final sign-off.",
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
  const existingKeys = new Set((existingItems ?? []).map((item) => item.item_key));
  const missingItems = templateItems.filter((item) => !existingKeys.has(item.itemKey));

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
        sectionName: item.section_name,
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

export async function generateChecklistPdf(input: {
  checklist: ServiceChecklistRow;
  items: ServiceChecklistItemRow[];
  booking: BookingRow;
  visit: ServiceVisitRow;
  submittedBy?: ProfileRow | null;
}) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [612, 792];
  const margin = 46;
  const width = pageSize[0] - margin * 2;
  let page = pdf.addPage(pageSize);
  let y = 742;

  const draw = (text: string, options: { bold?: boolean; size?: number } = {}) => {
    const size = options.size ?? 10;
    const activeFont = options.bold ? bold : font;
    const lines = wrapText(text, activeFont, size, width);
    lines.forEach((line) => {
      if (y < 60) {
        drawFooter(page, font);
        page = pdf.addPage(pageSize);
        y = 742;
      }
      page.drawText(line, {
        x: margin,
        y,
        size,
        font: activeFont,
        color: rgb(0.07, 0.07, 0.07),
      });
      y -= size + 5;
    });
  };

  page.drawRectangle({
    x: 0,
    y: 720,
    width: pageSize[0],
    height: 72,
    color: rgb(0.02, 0.02, 0.02),
  });
  page.drawText("Clean Curb Co.", {
    x: margin,
    y: 756,
    size: 22,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(brand.tagline, {
    x: margin,
    y: 735,
    size: 11,
    font: bold,
    color: rgb(1, 0.87, 0.34),
  });

  y = 694;
  draw("Service Checklist Report", { bold: true, size: 18 });
  draw(`Customer: ${input.booking.first_name} ${input.booking.last_name}`);
  draw(`Service address: ${formatBookingAddress(input.booking)}`);
  draw(
    `Service date: ${input.visit.route_day ?? input.booking.confirmed_route_day ?? "Not scheduled"}`,
  );
  draw(`Services performed: ${input.checklist.services_performed.join(", ")}`);
  draw(
    `Submitted by: ${displayProfile(input.submittedBy)}`,
  );
  draw(
    `Submitted at: ${
      input.checklist.submitted_at
        ? new Date(input.checklist.submitted_at).toLocaleString("en-US")
        : new Date().toLocaleString("en-US")
    }`,
  );
  y -= 8;

  groupChecklistItems(input.items).forEach((section) => {
    draw(section.sectionName, { bold: true, size: 13 });
    section.items.forEach((item) => {
      draw(`- ${checklistStatusLabel(item.status)}: ${item.label}`);
      if (item.notes) draw(`  Note: ${item.notes}`);
    });
    y -= 4;
  });

  draw("Overall Service Notes", { bold: true, size: 13 });
  draw(input.checklist.overall_notes || "No overall notes recorded.");
  y -= 8;
  draw(
    "This service record documents work completed or conditions observed during the listed service visit.",
  );
  drawFooter(page, font);

  return Buffer.from(await pdf.save());
}

function drawFooter(page: import("pdf-lib").PDFPage, font: import("pdf-lib").PDFFont) {
  page.drawText(`${brand.name} | ${brand.phone} | ${brand.email}`, {
    x: 46,
    y: 28,
    size: 8,
    font,
    color: rgb(0.35, 0.35, 0.35),
  });
}

function wrapText(
  text: string,
  font: import("pdf-lib").PDFFont,
  size: number,
  maxWidth: number,
) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";

  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      line = next;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  });

  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function displayProfile(profile?: ProfileRow | null) {
  if (!profile) return "Clean Curb Co. team member";
  return (
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
    profile.email ||
    "Clean Curb Co. team member"
  );
}
