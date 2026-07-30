import "server-only";

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

import { formatBookingAddress } from "@/lib/booking-utils";
import { brand } from "@/lib/site";
import type {
  BookingRow,
  ChecklistItemStatus,
  ProfileRow,
  ServiceChecklistItemRow,
  ServiceChecklistRow,
  ServiceVisitRow,
} from "@/types/database";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const PAGE_SIZE: [number, number] = [PAGE_WIDTH, PAGE_HEIGHT];

const MARGIN = 32;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const CONTENT_BOTTOM = 54;
const MAIN_CHECKLIST_BOTTOM = 190;

const colors = {
  deepGreen: rgb(7 / 255, 85 / 255, 54 / 255),
  green: rgb(12 / 255, 106 / 255, 70 / 255),
  greenSoft: rgb(237 / 255, 247 / 255, 241 / 255),
  greenRow: rgb(247 / 255, 249 / 255, 247 / 255),
  gold: rgb(215 / 255, 169 / 255, 40 / 255),
  goldSoft: rgb(251 / 255, 246 / 255, 231 / 255),
  purple: rgb(116 / 255, 24 / 255, 143 / 255),
  purpleSoft: rgb(248 / 255, 241 / 255, 250 / 255),
  charcoal: rgb(23 / 255, 23 / 255, 23 / 255),
  muted: rgb(102 / 255, 102 / 255, 102 / 255),
  line: rgb(215 / 255, 215 / 255, 210 / 255),
  white: rgb(1, 1, 1),
};

type Fonts = {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
};

type ChecklistPdfInput = {
  checklist: ServiceChecklistRow;
  items: ServiceChecklistItemRow[];
  booking: BookingRow;
  visit: ServiceVisitRow;
  submittedBy?: ProfileRow | null;
};

type ChecklistGroup = {
  sectionKey: string;
  sectionName: string;
  items: ServiceChecklistItemRow[];
};

type CommentEntry = {
  sectionName: string;
  title: string;
  statusLabel: string;
  status: ChecklistItemStatus | "overall";
  text: string;
};

export async function generateChecklistPdf(input: ChecklistPdfInput) {
  const pdf = await PDFDocument.create();

  const fonts: Fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
  };

  const customerName =
    `${input.booking.first_name} ${input.booking.last_name}`.trim() ||
    "Clean Curb Co. Customer";

  const serviceDateValue =
    input.visit.route_day ??
    input.booking.confirmed_route_day ??
    input.checklist.submitted_at ??
    new Date().toISOString();

  const serviceDate = formatDate(serviceDateValue);
  const submittedAt = formatTimestamp(
    input.checklist.submitted_at ?? new Date().toISOString(),
  );

  const reportReference = makeReportReference(
    serviceDateValue,
    input.checklist.id,
  );

  const serviceDescription = `Residential Bin Cleaning - ${
    input.booking.bin_count
  } ${input.booking.bin_count === 1 ? "bin" : "bins"}`;

  const additionalServices = input.checklist.services_performed.filter(
    (service) =>
      service.trim() &&
      service.trim().toLowerCase() !== "bin cleaning",
  );

  const groupedItems = groupChecklistItems(input.items);

  const itemComments: CommentEntry[] = input.items
    .filter((item) => Boolean(item.notes?.trim()))
    .map((item) => ({
      sectionName: displaySectionName(item.section_key, item.section_name),
      title: item.label,
      statusLabel: checklistStatusLabel(item.status),
      status: item.status,
      text: item.notes?.trim() ?? "",
    }));

  const hasRecordedIssue = input.items.some(
    (item) => item.status === "issue_found",
  );

  pdf.setTitle(`Residential Service Report - ${customerName}`);
  pdf.setAuthor("Stonebranch Capital LLC d/b/a Clean Curb Co.");
  pdf.setSubject("Residential service completion report");
  pdf.setCreator("Clean Curb Co. Service Checklist System");

  let page = pdf.addPage(PAGE_SIZE);

  drawMainHeader(page, fonts, reportReference);

  drawSummaryCards({
    page,
    fonts,
    customerName,
    address: formatBookingAddress(input.booking),
    serviceDescription,
    additionalServices,
    serviceDate,
    submittedBy: displayProfile(input.submittedBy),
    submittedAt,
  });

  drawCompletionStrip(page, fonts, hasRecordedIssue);

  drawSectionTitle(page, fonts, "SERVICE CHECKLIST", 491);

  let y = drawChecklistTableHeader(page, fonts, 471);
  let checklistBottom = MAIN_CHECKLIST_BOTTOM;

  for (const group of groupedItems) {
    const firstItem = group.items[0];
    const firstRowHeight = firstItem
      ? checklistRowHeight(firstItem.label, fonts)
      : 18;

    if (y - 18 - firstRowHeight < checklistBottom) {
      const continuation = startChecklistContinuationPage(
        pdf,
        fonts,
        reportReference,
      );

      page = continuation.page;
      y = continuation.y;
      checklistBottom = CONTENT_BOTTOM + 6;
    }

    y = drawChecklistSectionBand(
      page,
      fonts,
      displaySectionName(group.sectionKey, group.sectionName),
      y,
    );

    for (let index = 0; index < group.items.length; index += 1) {
      const item = group.items[index];
      const rowHeight = checklistRowHeight(item.label, fonts);

      if (y - rowHeight < checklistBottom) {
        const continuation = startChecklistContinuationPage(
          pdf,
          fonts,
          reportReference,
        );

        page = continuation.page;
        y = continuation.y;
        checklistBottom = CONTENT_BOTTOM + 6;

        y = drawChecklistSectionBand(
          page,
          fonts,
          `${displaySectionName(
            group.sectionKey,
            group.sectionName,
          )} - CONTINUED`,
          y,
        );
      }

      y = drawChecklistItemRow(
        page,
        fonts,
        item,
        y,
        rowHeight,
        index,
      );
    }
  }

  const notesResult = drawServiceNotesArea({
    pdf,
    page,
    y,
    fonts,
    reportReference,
    overallNotes: input.checklist.overall_notes,
  });

  page = notesResult.page;

  const commentEntries: CommentEntry[] = [];

  if (notesResult.overallNotesOverflow) {
    commentEntries.push({
      sectionName: "OVERALL SERVICE NOTES",
      title: "Service visit summary",
      statusLabel: "Customer-Facing Note",
      status: "overall",
      text: input.checklist.overall_notes?.trim() ?? "",
    });
  }

  commentEntries.push(...itemComments);

  if (commentEntries.length) {
    drawAdditionalCommentsPages(
      pdf,
      fonts,
      reportReference,
      commentEntries,
    );
  }

  const pages = pdf.getPages();

  pages.forEach((pdfPage, index) => {
    drawFooter(pdfPage, fonts, index + 1, pages.length);
  });

  return Buffer.from(await pdf.save());
}

function drawMainHeader(
  page: PDFPage,
  fonts: Fonts,
  reportReference: string,
) {
  page.drawRectangle({
    x: 0,
    y: 692,
    width: PAGE_WIDTH,
    height: 100,
    color: colors.deepGreen,
  });

  page.drawRectangle({
    x: 0,
    y: 688,
    width: PAGE_WIDTH,
    height: 4,
    color: colors.gold,
  });

  page.drawText("Clean Curb Co.", {
    x: MARGIN,
    y: 754,
    size: 23,
    font: fonts.bold,
    color: colors.white,
  });

  page.drawText(sanitizePdfText(brand.tagline), {
    x: MARGIN,
    y: 733,
    size: 10,
    font: fonts.italic,
    color: colors.gold,
  });

  page.drawText(
    sanitizePdfText(
      `${displayPhone()}  |  ${brand.email}`,
    ),
    {
      x: MARGIN,
      y: 713,
      size: 7.8,
      font: fonts.regular,
      color: colors.white,
    },
  );

  drawRightText(
    page,
    "RESIDENTIAL SERVICE REPORT",
    PAGE_WIDTH - MARGIN,
    756,
    8.5,
    fonts.bold,
    colors.gold,
  );

  drawRightText(
    page,
    "SERVICE COMPLETE",
    PAGE_WIDTH - MARGIN,
    731,
    20,
    fonts.bold,
    colors.white,
  );

  drawRightText(
    page,
    reportReference,
    PAGE_WIDTH - MARGIN,
    711,
    9,
    fonts.bold,
    colors.gold,
  );
}

function drawSummaryCards(input: {
  page: PDFPage;
  fonts: Fonts;
  customerName: string;
  address: string;
  serviceDescription: string;
  additionalServices: string[];
  serviceDate: string;
  submittedBy: string;
  submittedAt: string;
}) {
  const cardY = 568;
  const cardHeight = 102;

  const customerX = MARGIN;
  const customerWidth = 174;

  const detailsX = customerX + customerWidth + 10;
  const detailsWidth = 246;

  const statusX = detailsX + detailsWidth + 10;
  const statusWidth = PAGE_WIDTH - MARGIN - statusX;

  drawCard(
    input.page,
    customerX,
    cardY,
    customerWidth,
    cardHeight,
  );

  drawCard(
    input.page,
    detailsX,
    cardY,
    detailsWidth,
    cardHeight,
  );

  drawCard(
    input.page,
    statusX,
    cardY,
    statusWidth,
    cardHeight,
  );

  drawPersonIcon(input.page, customerX + 18, 649);

  input.page.drawText("CUSTOMER", {
    x: customerX + 38,
    y: 646,
    size: 8.5,
    font: input.fonts.bold,
    color: colors.gold,
  });

  const customerNameSize = fitTextSize(
    input.customerName,
    input.fonts.bold,
    10.5,
    8,
    customerWidth - 54,
  );

  input.page.drawText(sanitizePdfText(input.customerName), {
    x: customerX + 38,
    y: 624,
    size: customerNameSize,
    font: input.fonts.bold,
    color: colors.charcoal,
  });

  input.page.drawText("Service address", {
    x: customerX + 38,
    y: 608,
    size: 6.6,
    font: input.fonts.regular,
    color: colors.muted,
  });

  drawTextLines(
    input.page,
    wrapText(
      input.address,
      input.fonts.regular,
      8.1,
      customerWidth - 54,
    ).slice(0, 3),
    customerX + 38,
    596,
    8.1,
    9.6,
    input.fonts.regular,
    colors.charcoal,
  );

  drawCalendarIcon(input.page, detailsX + 18, 649);

  input.page.drawText("VISIT DETAILS", {
    x: detailsX + 38,
    y: 646,
    size: 8.5,
    font: input.fonts.bold,
    color: colors.gold,
  });

  let serviceY = 624;

  drawDetailRow({
    page: input.page,
    fonts: input.fonts,
    x: detailsX + 16,
    rightX: detailsX + detailsWidth - 16,
    y: serviceY,
    label: "Service",
    value: input.serviceDescription,
  });

  if (input.additionalServices.length) {
    const additionalText = `Additional: ${input.additionalServices.join(
      ", ",
    )}`;

    const additionalSize = fitTextSize(
      additionalText,
      input.fonts.regular,
      6.8,
      5.8,
      detailsWidth - 32,
    );

    input.page.drawText(sanitizePdfText(additionalText), {
      x: detailsX + 16,
      y: 612,
      size: additionalSize,
      font: input.fonts.regular,
      color: colors.muted,
    });

    serviceY = 596;
  } else {
    serviceY = 605;
  }

  drawDetailRow({
    page: input.page,
    fonts: input.fonts,
    x: detailsX + 16,
    rightX: detailsX + detailsWidth - 16,
    y: serviceY,
    label: "Service date",
    value: input.serviceDate,
  });

  drawDetailRow({
    page: input.page,
    fonts: input.fonts,
    x: detailsX + 16,
    rightX: detailsX + detailsWidth - 16,
    y: serviceY - 18,
    label: "Submitted by",
    value: input.submittedBy,
  });

  drawDetailRow({
    page: input.page,
    fonts: input.fonts,
    x: detailsX + 16,
    rightX: detailsX + detailsWidth - 16,
    y: serviceY - 36,
    label: "Completed at",
    value: input.submittedAt,
  });

  input.page.drawText("STATUS", {
    x: statusX + 26,
    y: 646,
    size: 8.5,
    font: input.fonts.bold,
    color: colors.gold,
  });

  input.page.drawCircle({
    x: statusX + statusWidth / 2,
    y: 614,
    size: 18,
    color: colors.green,
  });

  drawCheckMark(
    input.page,
    statusX + statusWidth / 2,
    614,
    10,
    colors.white,
    2,
  );

  const statusText = "Completed";
  const statusSize = fitTextSize(
    statusText,
    input.fonts.bold,
    13,
    10,
    statusWidth - 18,
  );

  const statusWidthValue =
    input.fonts.bold.widthOfTextAtSize(statusText, statusSize);

  input.page.drawText(statusText, {
    x: statusX + (statusWidth - statusWidthValue) / 2,
    y: 581,
    size: statusSize,
    font: input.fonts.bold,
    color: colors.green,
  });
}

function drawCompletionStrip(
  page: PDFPage,
  fonts: Fonts,
  hasRecordedIssue: boolean,
) {
  const y = 514;
  const height = 42;

  page.drawRectangle({
    x: MARGIN,
    y,
    width: CONTENT_WIDTH,
    height,
    color: colors.greenSoft,
    borderColor: colors.line,
    borderWidth: 0.7,
  });

  page.drawRectangle({
    x: MARGIN,
    y,
    width: 4,
    height,
    color: colors.green,
  });

  drawShieldCheckIcon(page, MARGIN + 33, y + height / 2);

  const text = hasRecordedIssue
    ? "The service visit was completed and documented. Review the recorded comments included with this report."
    : "Everything scheduled for this service visit was completed and documented.";

  const lines = wrapText(
    text,
    fonts.regular,
    8.8,
    CONTENT_WIDTH - 82,
  );

  drawTextLines(
    page,
    lines.slice(0, 2),
    MARGIN + 58,
    y + 24,
    8.8,
    10.5,
    fonts.regular,
    colors.charcoal,
  );
}

function drawChecklistTableHeader(
  page: PDFPage,
  fonts: Fonts,
  topY: number,
) {
  const height = 20;

  page.drawRectangle({
    x: MARGIN,
    y: topY - height,
    width: CONTENT_WIDTH,
    height,
    color: colors.white,
    borderColor: colors.line,
    borderWidth: 0.7,
  });

  page.drawText("SERVICE CHECKLIST", {
    x: MARGIN + 10,
    y: topY - 14,
    size: 7.5,
    font: fonts.bold,
    color: colors.gold,
  });

  drawRightText(
    page,
    "STATUS",
    PAGE_WIDTH - MARGIN - 10,
    topY - 14,
    7.5,
    fonts.bold,
    colors.gold,
  );

  return topY - height;
}

function drawChecklistSectionBand(
  page: PDFPage,
  fonts: Fonts,
  sectionName: string,
  topY: number,
) {
  const height = 18;

  page.drawRectangle({
    x: MARGIN,
    y: topY - height,
    width: CONTENT_WIDTH,
    height,
    color: colors.greenSoft,
    borderColor: colors.line,
    borderWidth: 0.6,
  });

  page.drawRectangle({
    x: MARGIN,
    y: topY - height,
    width: 4,
    height,
    color: colors.green,
  });

  page.drawText(sanitizePdfText(sectionName.toUpperCase()), {
    x: MARGIN + 14,
    y: topY - 13,
    size: 8.2,
    font: fonts.bold,
    color: colors.deepGreen,
  });

  return topY - height;
}

function checklistRowHeight(label: string, fonts: Fonts) {
  const labelLines = wrapText(
    label,
    fonts.regular,
    8.2,
    CONTENT_WIDTH - 152,
  );

  return Math.max(18, 8 + labelLines.length * 8.7);
}

function drawChecklistItemRow(
  page: PDFPage,
  fonts: Fonts,
  item: ServiceChecklistItemRow,
  topY: number,
  rowHeight: number,
  rowIndex: number,
) {
  page.drawRectangle({
    x: MARGIN,
    y: topY - rowHeight,
    width: CONTENT_WIDTH,
    height: rowHeight,
    color: rowIndex % 2 === 0 ? colors.white : colors.greenRow,
    borderColor: colors.line,
    borderWidth: 0.45,
  });

  drawChecklistStatusIcon(
    page,
    item.status,
    MARGIN + 17,
    topY - rowHeight / 2,
  );

  const labelLines = wrapText(
    item.label,
    fonts.regular,
    8.2,
    CONTENT_WIDTH - 152,
  );

  const lineHeight = 8.7;
  const textBlockHeight = labelLines.length * lineHeight;

  drawTextLines(
    page,
    labelLines,
    MARGIN + 34,
    topY - (rowHeight - textBlockHeight) / 2 - 7.2,
    8.2,
    lineHeight,
    fonts.regular,
    colors.charcoal,
  );

  drawRightText(
    page,
    checklistStatusLabel(item.status),
    PAGE_WIDTH - MARGIN - 10,
    topY - rowHeight / 2 - 3,
    7.7,
    fonts.bold,
    checklistStatusColor(item.status),
  );

  return topY - rowHeight;
}

function drawServiceNotesArea(input: {
  pdf: PDFDocument;
  page: PDFPage;
  y: number;
  fonts: Fonts;
  reportReference: string;
  overallNotes: string | null;
}) {
  let page = input.page;
  let y = input.y - 8;

  const normalizedNotes = input.overallNotes?.trim() ?? "";

  const completeLines = wrapText(
    normalizedNotes || "No additional service notes were recorded.",
    input.fonts.regular,
    8.1,
    CONTENT_WIDTH - 34,
  );

  const overallNotesOverflow = normalizedNotes
    ? completeLines.length > 3
    : false;

  const displayedText = overallNotesOverflow
    ? "A longer customer-facing service note was recorded. See Additional Service Comments for the complete note."
    : normalizedNotes || "No additional service notes were recorded.";

  const displayedLines = wrapText(
    displayedText,
    input.fonts.regular,
    8.1,
    CONTENT_WIDTH - 34,
  );

  const boxHeight = Math.max(
    46,
    18 + displayedLines.length * 9.5,
  );

  const requiredHeight = 20 + boxHeight + 10 + 34 + 22;

  if (y - requiredHeight < CONTENT_BOTTOM) {
    const continuation = startServiceContinuationPage(
      input.pdf,
      input.fonts,
      input.reportReference,
    );

    page = continuation.page;
    y = continuation.y;
  }

  drawSectionTitle(page, input.fonts, "SERVICE NOTES", y);
  y -= 20;

  page.drawRectangle({
    x: MARGIN,
    y: y - boxHeight,
    width: CONTENT_WIDTH,
    height: boxHeight,
    color: colors.white,
    borderColor: colors.purple,
    borderWidth: 0.8,
  });

  page.drawRectangle({
    x: MARGIN,
    y: y - boxHeight,
    width: 5,
    height: boxHeight,
    color: colors.purple,
  });

  drawTextLines(
    page,
    displayedLines,
    MARGIN + 16,
    y - 16,
    8.1,
    9.5,
    input.fonts.regular,
    colors.charcoal,
  );

  y -= boxHeight + 10;

  drawNextStepStrip(page, input.fonts, y);

  y -= 42;

  page.drawText(
    "This service record documents work completed or conditions observed during the listed service visit.",
    {
      x: MARGIN + 2,
      y,
      size: 6.7,
      font: input.fonts.regular,
      color: colors.muted,
    },
  );

  return {
    page,
    y: y - 10,
    overallNotesOverflow,
  };
}

function drawNextStepStrip(
  page: PDFPage,
  fonts: Fonts,
  topY: number,
) {
  const height = 32;

  page.drawRectangle({
    x: MARGIN,
    y: topY - height,
    width: CONTENT_WIDTH,
    height,
    color: colors.goldSoft,
    borderColor: colors.gold,
    borderWidth: 0.6,
  });

  drawConversationIcon(
    page,
    MARGIN + 21,
    topY - height / 2,
  );

  page.drawText("NEXT STEP / QUESTIONS", {
    x: MARGIN + 43,
    y: topY - 20,
    size: 7.5,
    font: fonts.bold,
    color: colors.gold,
  });

  const body =
    "Need anything adjusted? Reach out within 3 business days and we'll take a look.";

  const bodySize = fitTextSize(
    body,
    fonts.regular,
    7.3,
    6.3,
    CONTENT_WIDTH - 190,
  );

  page.drawText(body, {
    x: MARGIN + 180,
    y: topY - 20,
    size: bodySize,
    font: fonts.regular,
    color: colors.charcoal,
  });
}

function drawAdditionalCommentsPages(
  pdf: PDFDocument,
  fonts: Fonts,
  reportReference: string,
  entries: CommentEntry[],
) {
  let state = startCommentsPage(
    pdf,
    fonts,
    reportReference,
    true,
  );

  for (const entry of entries) {
    state = drawCommentEntry({
      pdf,
      page: state.page,
      y: state.y,
      fonts,
      reportReference,
      entry,
    });
  }
}

function drawCommentEntry(input: {
  pdf: PDFDocument;
  page: PDFPage;
  y: number;
  fonts: Fonts;
  reportReference: string;
  entry: CommentEntry;
}) {
  let page = input.page;
  let y = input.y;

  const titleLines = wrapText(
    input.entry.title,
    input.fonts.bold,
    9.2,
    CONTENT_WIDTH - 150,
  );

  let remainingLines = wrapText(
    input.entry.text,
    input.fonts.regular,
    8.2,
    CONTENT_WIDTH - 34,
  );

  let part = 1;

  while (remainingLines.length) {
    const fixedHeight = 58 + titleLines.length * 9.5;
    const availableHeight = y - CONTENT_BOTTOM;

    const completeHeight =
      fixedHeight + remainingLines.length * 9.4;

    const maximumFreshHeight = 640 - CONTENT_BOTTOM;

    if (
      completeHeight <= maximumFreshHeight &&
      completeHeight > availableHeight
    ) {
      const continuation = startCommentsPage(
        input.pdf,
        input.fonts,
        input.reportReference,
        false,
      );

      page = continuation.page;
      y = continuation.y;
      continue;
    }

    if (availableHeight < fixedHeight + 20) {
      const continuation = startCommentsPage(
        input.pdf,
        input.fonts,
        input.reportReference,
        false,
      );

      page = continuation.page;
      y = continuation.y;
      continue;
    }

    const maximumLineCount = Math.max(
      1,
      Math.floor((availableHeight - fixedHeight) / 9.4),
    );

    const linesForThisCard = remainingLines.slice(
      0,
      maximumLineCount,
    );

    remainingLines = remainingLines.slice(
      linesForThisCard.length,
    );

    const cardHeight =
      fixedHeight + linesForThisCard.length * 9.4;

    page.drawRectangle({
      x: MARGIN,
      y: y - cardHeight,
      width: CONTENT_WIDTH,
      height: cardHeight,
      color: colors.white,
      borderColor: colors.line,
      borderWidth: 0.7,
    });

    page.drawRectangle({
      x: MARGIN,
      y: y - cardHeight,
      width: 5,
      height: cardHeight,
      color:
        input.entry.status === "overall"
          ? colors.purple
          : checklistStatusColor(input.entry.status),
    });

    page.drawText(
      sanitizePdfText(input.entry.sectionName.toUpperCase()),
      {
        x: MARGIN + 16,
        y: y - 16,
        size: 7.1,
        font: input.fonts.bold,
        color: colors.gold,
      },
    );

    const continuedTitle =
      part > 1
        ? `${input.entry.title} - Continued`
        : input.entry.title;

    const continuedTitleLines = wrapText(
      continuedTitle,
      input.fonts.bold,
      9.2,
      CONTENT_WIDTH - 150,
    );

    drawTextLines(
      page,
      continuedTitleLines,
      MARGIN + 16,
      y - 33,
      9.2,
      9.5,
      input.fonts.bold,
      colors.charcoal,
    );

    drawRightText(
      page,
      input.entry.statusLabel,
      PAGE_WIDTH - MARGIN - 14,
      y - 33,
      7.2,
      input.fonts.bold,
      input.entry.status === "overall"
        ? colors.purple
        : checklistStatusColor(input.entry.status),
    );

    const commentLabelY =
      y - 38 - continuedTitleLines.length * 9.5;

    page.drawText("COMMENT", {
      x: MARGIN + 16,
      y: commentLabelY,
      size: 6.8,
      font: input.fonts.bold,
      color: colors.purple,
    });

    drawTextLines(
      page,
      linesForThisCard,
      MARGIN + 16,
      commentLabelY - 15,
      8.2,
      9.4,
      input.fonts.regular,
      colors.charcoal,
    );

    y -= cardHeight + 10;
    part += 1;

    if (remainingLines.length) {
      const continuation = startCommentsPage(
        input.pdf,
        input.fonts,
        input.reportReference,
        false,
      );

      page = continuation.page;
      y = continuation.y;
    }
  }

  return { page, y };
}

function startChecklistContinuationPage(
  pdf: PDFDocument,
  fonts: Fonts,
  reportReference: string,
) {
  const page = pdf.addPage(PAGE_SIZE);

  drawSlimHeader(page, fonts, reportReference);

  drawSectionTitle(
    page,
    fonts,
    "SERVICE CHECKLIST - CONTINUED",
    700,
  );

  const y = drawChecklistTableHeader(page, fonts, 676);

  return { page, y };
}

function startServiceContinuationPage(
  pdf: PDFDocument,
  fonts: Fonts,
  reportReference: string,
) {
  const page = pdf.addPage(PAGE_SIZE);

  drawSlimHeader(page, fonts, reportReference);

  drawSectionTitle(
    page,
    fonts,
    "SERVICE REPORT - CONTINUED",
    700,
  );

  return { page, y: 672 };
}

function startCommentsPage(
  pdf: PDFDocument,
  fonts: Fonts,
  reportReference: string,
  firstPage: boolean,
) {
  const page = pdf.addPage(PAGE_SIZE);

  drawSlimHeader(page, fonts, reportReference);

  drawSectionTitle(
    page,
    fonts,
    firstPage
      ? "ADDITIONAL SERVICE COMMENTS"
      : "ADDITIONAL SERVICE COMMENTS - CONTINUED",
    700,
  );

  let y = 672;

  if (firstPage) {
    const intro =
      "The following comments were recorded during this service visit and are included as part of the customer service record.";

    const introLines = wrapText(
      intro,
      fonts.regular,
      8,
      CONTENT_WIDTH,
    );

    drawTextLines(
      page,
      introLines,
      MARGIN,
      y,
      8,
      10,
      fonts.regular,
      colors.muted,
    );

    y -= introLines.length * 10 + 14;
  }

  return { page, y };
}

function drawSlimHeader(
  page: PDFPage,
  fonts: Fonts,
  reportReference: string,
) {
  page.drawRectangle({
    x: 0,
    y: 732,
    width: PAGE_WIDTH,
    height: 60,
    color: colors.deepGreen,
  });

  page.drawRectangle({
    x: 0,
    y: 728,
    width: PAGE_WIDTH,
    height: 4,
    color: colors.gold,
  });

  page.drawText("Clean Curb Co.", {
    x: MARGIN,
    y: 754,
    size: 18,
    font: fonts.bold,
    color: colors.white,
  });

  drawRightText(
    page,
    `${reportReference} - CONTINUED`,
    PAGE_WIDTH - MARGIN,
    756,
    8,
    fonts.bold,
    colors.gold,
  );
}

function drawFooter(
  page: PDFPage,
  fonts: Fonts,
  pageNumber: number,
  pageCount: number,
) {
  page.drawLine({
    start: { x: MARGIN, y: 43 },
    end: { x: PAGE_WIDTH - MARGIN, y: 43 },
    thickness: 0.6,
    color: colors.gold,
  });

  const legalText =
    "Clean Curb Co. - A trade name of Stonebranch Capital LLC - Local, veteran-owned small business";

  const legalSize = fitTextSize(
    legalText,
    fonts.regular,
    6.4,
    5.7,
    365,
  );

  page.drawText(legalText, {
    x: MARGIN,
    y: 24,
    size: legalSize,
    font: fonts.regular,
    color: colors.muted,
  });

  drawRightText(
    page,
    `Page ${pageNumber} of ${pageCount}  |  ${brand.tagline}`,
    PAGE_WIDTH - MARGIN,
    24,
    6.4,
    fonts.bold,
    colors.charcoal,
  );
}

function drawSectionTitle(
  page: PDFPage,
  fonts: Fonts,
  title: string,
  y: number,
) {
  page.drawText(sanitizePdfText(title), {
    x: MARGIN,
    y,
    size: 8.5,
    font: fonts.bold,
    color: colors.gold,
  });

  page.drawLine({
    start: { x: MARGIN, y: y - 7 },
    end: { x: PAGE_WIDTH - MARGIN, y: y - 7 },
    thickness: 0.7,
    color: colors.charcoal,
  });
}

function drawCard(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: colors.white,
    borderColor: colors.line,
    borderWidth: 0.8,
  });
}

function drawDetailRow(input: {
  page: PDFPage;
  fonts: Fonts;
  x: number;
  rightX: number;
  y: number;
  label: string;
  value: string;
}) {
  input.page.drawText(sanitizePdfText(input.label), {
    x: input.x,
    y: input.y,
    size: 6.8,
    font: input.fonts.regular,
    color: colors.muted,
  });

  const maximumWidth = input.rightX - input.x - 72;

  const size = fitTextSize(
    input.value,
    input.fonts.regular,
    7.8,
    6.2,
    maximumWidth,
  );

  drawRightText(
    input.page,
    input.value,
    input.rightX,
    input.y,
    size,
    input.fonts.regular,
    colors.charcoal,
  );
}

function drawPersonIcon(
  page: PDFPage,
  x: number,
  y: number,
) {
  page.drawCircle({
    x,
    y: y + 4,
    size: 4,
    borderColor: colors.gold,
    borderWidth: 1,
  });

  page.drawLine({
    start: { x: x - 6, y: y - 7 },
    end: { x: x - 3, y: y - 1 },
    thickness: 1,
    color: colors.gold,
  });

  page.drawLine({
    start: { x: x - 3, y: y - 1 },
    end: { x: x + 3, y: y - 1 },
    thickness: 1,
    color: colors.gold,
  });

  page.drawLine({
    start: { x: x + 3, y: y - 1 },
    end: { x: x + 6, y: y - 7 },
    thickness: 1,
    color: colors.gold,
  });
}

function drawCalendarIcon(
  page: PDFPage,
  x: number,
  y: number,
) {
  page.drawRectangle({
    x: x - 7,
    y: y - 7,
    width: 14,
    height: 14,
    borderColor: colors.gold,
    borderWidth: 1,
  });

  page.drawLine({
    start: { x: x - 7, y: y + 2 },
    end: { x: x + 7, y: y + 2 },
    thickness: 1,
    color: colors.gold,
  });

  page.drawLine({
    start: { x: x - 3.5, y: y + 8 },
    end: { x: x - 3.5, y: y + 5 },
    thickness: 1.2,
    color: colors.gold,
  });

  page.drawLine({
    start: { x: x + 3.5, y: y + 8 },
    end: { x: x + 3.5, y: y + 5 },
    thickness: 1.2,
    color: colors.gold,
  });
}

function drawShieldCheckIcon(
  page: PDFPage,
  x: number,
  y: number,
) {
  page.drawCircle({
    x,
    y,
    size: 10,
    borderColor: colors.green,
    borderWidth: 1.2,
  });

  drawCheckMark(page, x, y, 6, colors.green, 1.3);
}

function drawConversationIcon(
  page: PDFPage,
  x: number,
  y: number,
) {
  page.drawCircle({
    x,
    y,
    size: 8,
    borderColor: colors.gold,
    borderWidth: 1,
  });

  page.drawLine({
    start: { x: x - 5, y: y - 6 },
    end: { x: x - 8, y: y - 10 },
    thickness: 1,
    color: colors.gold,
  });
}

function drawChecklistStatusIcon(
  page: PDFPage,
  status: ChecklistItemStatus,
  x: number,
  y: number,
) {
  const color = checklistStatusColor(status);

  page.drawCircle({
    x,
    y,
    size: 5.5,
    color,
  });

  if (status === "completed") {
    drawCheckMark(page, x, y, 3.5, colors.white, 1);
    return;
  }

  if (status === "issue_found") {
    page.drawLine({
      start: { x, y: y + 2.4 },
      end: { x, y: y - 0.8 },
      thickness: 1,
      color: colors.charcoal,
    });

    page.drawCircle({
      x,
      y: y - 3,
      size: 0.7,
      color: colors.charcoal,
    });

    return;
  }

  page.drawLine({
    start: { x: x - 2.5, y },
    end: { x: x + 2.5, y },
    thickness: 1,
    color: colors.white,
  });
}

function drawCheckMark(
  page: PDFPage,
  x: number,
  y: number,
  size: number,
  color: ReturnType<typeof rgb>,
  thickness: number,
) {
  page.drawLine({
    start: {
      x: x - size * 0.5,
      y: y,
    },
    end: {
      x: x - size * 0.12,
      y: y - size * 0.4,
    },
    thickness,
    color,
  });

  page.drawLine({
    start: {
      x: x - size * 0.12,
      y: y - size * 0.4,
    },
    end: {
      x: x + size * 0.58,
      y: y + size * 0.42,
    },
    thickness,
    color,
  });
}

function drawRightText(
  page: PDFPage,
  text: string,
  rightX: number,
  y: number,
  size: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>,
) {
  const safeText = sanitizePdfText(text);
  const width = font.widthOfTextAtSize(safeText, size);

  page.drawText(safeText, {
    x: rightX - width,
    y,
    size,
    font,
    color,
  });
}

function drawTextLines(
  page: PDFPage,
  lines: string[],
  x: number,
  startY: number,
  size: number,
  lineHeight: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>,
) {
  lines.forEach((line, index) => {
    page.drawText(sanitizePdfText(line), {
      x,
      y: startY - index * lineHeight,
      size,
      font,
      color,
    });
  });
}

function groupChecklistItems(
  items: ServiceChecklistItemRow[],
): ChecklistGroup[] {
  return items.reduce<ChecklistGroup[]>((groups, item) => {
    const existing = groups.find(
      (group) => group.sectionKey === item.section_key,
    );

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

function displaySectionName(
  sectionKey: string,
  sectionName: string,
) {
  if (sectionKey === "departure") return "Final Walkthrough";
  if (sectionName === "Finish Up") return "Final Walkthrough";
  return sectionName;
}

function checklistStatusLabel(status: ChecklistItemStatus) {
  if (status === "completed") return "Completed";
  if (status === "issue_found") return "Issue Found";
  if (status === "not_applicable") return "Not Applicable";
  return "Pending";
}

function checklistStatusColor(status: ChecklistItemStatus) {
  if (status === "completed") return colors.green;
  if (status === "issue_found") return colors.gold;
  return colors.muted;
}

function displayProfile(profile?: ProfileRow | null) {
  if (!profile) return "Clean Curb Co. team member";

  return (
    [profile.first_name, profile.last_name]
      .filter(Boolean)
      .join(" ") ||
    profile.email ||
    "Clean Curb Co. team member"
  );
}

function displayPhone() {
  return brand.phone.replace(/^\+1\s*/, "");
}

function makeReportReference(
  serviceDateValue: string,
  checklistId: string,
) {
  const compactDate = dateReferencePart(serviceDateValue);

  const compactId =
    checklistId.replace(/[^a-zA-Z0-9]/g, "").slice(-8) ||
    "REPORT";

  return `CCC-SR-${compactDate}-${compactId.toUpperCase()}`;
}

function dateReferencePart(value: string) {
  const dateOnlyMatch = value.match(
    /^(\d{4})-(\d{2})-(\d{2})/,
  );

  if (dateOnlyMatch) {
    return `${dateOnlyMatch[1]}${dateOnlyMatch[2]}${dateOnlyMatch[3]}`;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return new Date()
      .toISOString()
      .slice(0, 10)
      .replaceAll("-", "");
  }

  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function formatDate(value: string) {
  const dateOnlyMatch = value.match(
    /^(\d{4})-(\d{2})-(\d{2})/,
  );

  const date = dateOnlyMatch
    ? new Date(
        Number(dateOnlyMatch[1]),
        Number(dateOnlyMatch[2]) - 1,
        Number(dateOnlyMatch[3]),
        12,
      )
    : new Date(value);

  if (Number.isNaN(date.getTime())) return "Not scheduled";

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not recorded";

  return date.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function sanitizePdfText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/\u00a0/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

function wrapText(
  value: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
) {
  const safeValue = sanitizePdfText(value);
  const paragraphs = safeValue.split(/\r?\n/);
  const lines: string[] = [];

  paragraphs.forEach((paragraph) => {
    const trimmed = paragraph.trim();

    if (!trimmed) {
      lines.push("");
      return;
    }

    const words = trimmed.split(/\s+/);
    let currentLine = "";

    words.forEach((word) => {
      const wordParts =
        font.widthOfTextAtSize(word, size) > maxWidth
          ? splitLongWord(word, font, size, maxWidth)
          : [word];

      wordParts.forEach((wordPart) => {
        const candidate = currentLine
          ? `${currentLine} ${wordPart}`
          : wordPart;

        if (
          font.widthOfTextAtSize(candidate, size) <= maxWidth
        ) {
          currentLine = candidate;
          return;
        }

        if (currentLine) lines.push(currentLine);
        currentLine = wordPart;
      });
    });

    if (currentLine) lines.push(currentLine);
  });

  return lines.length ? lines : [""];
}

function splitLongWord(
  word: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
) {
  const chunks: string[] = [];
  let chunk = "";

  for (const character of word) {
    const candidate = `${chunk}${character}`;

    if (
      chunk &&
      font.widthOfTextAtSize(candidate, size) > maxWidth
    ) {
      chunks.push(chunk);
      chunk = character;
    } else {
      chunk = candidate;
    }
  }

  if (chunk) chunks.push(chunk);

  return chunks;
}

function fitTextSize(
  value: string,
  font: PDFFont,
  startingSize: number,
  minimumSize: number,
  maximumWidth: number,
) {
  const safeValue = sanitizePdfText(value);
  let size = startingSize;

  while (
    size > minimumSize &&
    font.widthOfTextAtSize(safeValue, size) > maximumWidth
  ) {
    size -= 0.25;
  }

  return Math.max(size, minimumSize);
}
