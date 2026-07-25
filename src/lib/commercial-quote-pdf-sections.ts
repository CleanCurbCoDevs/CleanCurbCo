import {
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

import {
  buildCommercialCustomerProjectBasisFromQuote,
  getCommercialQuoteLineItemPhase,
  type CommercialCustomerProjectBasis,
} from "@/lib/commercial-quote-customer-breakdown";

import {
  COMMERCIAL_PAYMENT_OPTIONS_SUMMARY,
  COMMERCIAL_PRE_SERVICE_TIMING_SUMMARY,
  COMMERCIAL_PROJECT_SUPPORT_FOOTNOTE,
} from "@/lib/commercial-quote-policy";

import type {
  CommercialQuoteLineItemRow,
  CommercialQuoteRow,
} from "@/types/database";

type PdfColor =
  ReturnType<typeof rgb>;

type PdfQuoteFonts = {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
};

type PdfQuoteColors = {
  cream: PdfColor;
  white: PdfColor;
  black: PdfColor;
  gold: PdfColor;
  purple: PdfColor;
  muted: PdfColor;
  line: PdfColor;
};

type PdfParagraphOptions = {
  size?: number;
  leading?: number;
  color?: PdfColor;
  font?: PDFFont;
  width?: number;
  indent?: number;
  gapAfter?: number;
};

export type CommercialQuotePdfFlow = {
  pageWidth: number;
  pageMargin: number;
  contentWidth: number;
  contentBottom: number;

  fonts: PdfQuoteFonts;
  colors: PdfQuoteColors;

  getPage:
    () => PDFPage;

  getY:
    () => number;

  setY:
    (value: number) => void;

  addContinuationPage:
    () => void;

  drawSectionTitle:
    (title: string) => void;

  drawParagraph: (
    value: string,
    options?: PdfParagraphOptions,
  ) => void;

  drawBulletList:
    (items: string[]) => void;
};

type PdfCustomerPricingLine = {
  itemType: string;
  name: string;
  description: string | null;
  quantity: number;
  unitLabel: string | null;
  amountCents: number;
};

export function drawCommercialQuotePricingSections({
  quote,
  lineItems,
  flow,
}: {
  quote: CommercialQuoteRow;

  lineItems:
    CommercialQuoteLineItemRow[];

  flow:
    CommercialQuotePdfFlow;
}) {
  const initialPriceCents =
    Math.max(
      0,
      quote.final_initial_price_cents,
    );

  const recurringPriceCents =
    quote.final_recurring_price_cents !==
      null
      ? Math.max(
          0,
          quote
            .final_recurring_price_cents,
        )
      : null;

  const visibleLineItems =
    lineItems
      .filter(
        (item) =>
          item.is_customer_visible,
      )
      .sort(
        (
          left,
          right,
        ) =>
          left.sort_order -
          right.sort_order,
      );

  const initialLines =
    visibleLineItems
      .filter(
        (item) =>
          getCommercialQuoteLineItemPhase(
            item,
          ) === "initial",
      )
      .map(
        toPdfCustomerPricingLine,
      );

  const recurringLines =
    visibleLineItems
      .filter(
        (item) =>
          getCommercialQuoteLineItemPhase(
            item,
          ) === "recurring",
      )
      .map(
        toPdfCustomerPricingLine,
      );

  if (initialPriceCents > 0) {
    drawCustomerPricingTable({
      title:
        "Initial reset pricing",

      lines:
        initialLines.length
          ? initialLines
          : createFallbackPricingLines(
              "Initial commercial service",
              initialPriceCents,
            ),

      subtotalCents:
        initialPriceCents,

      taxCents:
        quote.tax_cents,

      flow,
    });
  }

  if (
    recurringPriceCents !== null &&
    recurringPriceCents > 0
  ) {
    drawCustomerPricingTable({
      title:
        `Recurring maintenance pricing - ${humanizeFrequency(
          quote.recurring_frequency,
        )}`,

      lines:
        recurringLines.length
          ? recurringLines
          : createFallbackPricingLines(
              "Recurring commercial service",
              recurringPriceCents,
            ),

      subtotalCents:
        recurringPriceCents,

      taxCents:
        quote.tax_cents,

      flow,
    });
  }

  drawPaymentSchedule(
    quote,
    flow,
  );

  drawCustomerProjectBasis(
    quote,
    initialPriceCents,
    recurringPriceCents,
    flow,
  );
}

function drawCustomerPricingTable({
  title,
  lines,
  subtotalCents,
  taxCents,
  flow,
}: {
  title: string;

  lines:
    PdfCustomerPricingLine[];

  subtotalCents: number;
  taxCents: number;

  flow:
    CommercialQuotePdfFlow;
}) {
  ensureSectionSpace(
    flow,
    76,
  );

  flow.drawSectionTitle(
    title,
  );

  drawPricingColumnHeader(
    flow,
  );

  for (
    const line of lines
  ) {
    drawPricingLine(
      line,
      title,
      flow,
    );
  }

  ensurePricingSpace(
    flow,
    84,
    title,
  );

  drawPricingSummaryRow({
    label:
      "Subtotal",

    amountCents:
      subtotalCents,

    height:
      26,

    fillColor:
      flow.colors.cream,

    font:
      flow.fonts.bold,

    flow,
  });

  drawPricingSummaryRow({
    label:
      "Tax",

    amountCents:
      taxCents,

    height:
      26,

    fillColor:
      flow.colors.white,

    font:
      flow.fonts.bold,

    flow,
  });

  drawPricingSummaryRow({
    label:
      "Total",

    amountCents:
      subtotalCents +
      taxCents,

    height:
      32,

    fillColor:
      flow.colors.black,

    font:
      flow.fonts.bold,

    textColor:
      flow.colors.white,

    amountSize:
      13,

    flow,
  });

  flow.setY(
    flow.getY() - 10,
  );

  if (
    lines.some(
      (line) =>
        line.itemType ===
        "fee",
    )
  ) {
    flow.drawParagraph(
      `*${COMMERCIAL_PROJECT_SUPPORT_FOOTNOTE}`,
      {
        size:
          7.4,

        leading:
          9.3,

        color:
          flow.colors.muted,

        gapAfter:
          15,
      },
    );
  }
}

function drawPricingColumnHeader(
  flow:
    CommercialQuotePdfFlow,
) {
  const headerHeight =
    24;

  const topY =
    flow.getY();

  const page =
    flow.getPage();

  page.drawRectangle({
    x:
      flow.pageMargin,

    y:
      topY -
      headerHeight,

    width:
      flow.contentWidth,

    height:
      headerHeight,

    color:
      flow.colors.cream,

    borderColor:
      flow.colors.line,

    borderWidth:
      1,
  });

  page.drawRectangle({
    x:
      flow.pageMargin,

    y:
      topY -
      3,

    width:
      flow.contentWidth,

    height:
      3,

    color:
      flow.colors.gold,
  });

  page.drawText(
    "CUSTOMER-FACING SERVICE",
    {
      x:
        flow.pageMargin +
        12,

      y:
        topY -
        17,

      size:
        7.1,

      font:
        flow.fonts.bold,

      color:
        flow.colors.black,
    },
  );

  drawRightText(
    page,
    "AMOUNT",
    flow.pageWidth -
      flow.pageMargin -
      12,
    topY - 17,
    flow.fonts.bold,
    7.1,
    flow.colors.black,
  );

  flow.setY(
    topY -
    headerHeight,
  );
}

function drawPricingLine(
  line:
    PdfCustomerPricingLine,

  tableTitle:
    string,

  flow:
    CommercialQuotePdfFlow,
) {
  const textWidth =
    flow.contentWidth -
    130;

  const nameLines =
    wrapPdfText(
      sanitizePdfText(
        line.name,
      ),
      flow.fonts.bold,
      8.8,
      textWidth,
    );

  const detail =
    formatPricingDetail(
      line,
    );

  const detailLines =
    detail
      ? wrapPdfText(
          sanitizePdfText(
            detail,
          ),
          flow.fonts.regular,
          7.4,
          textWidth,
        )
      : [];

  const rowHeight =
    13 +
    nameLines.length * 10 +
    (
      detailLines.length
        ? 4 +
          detailLines.length *
            8.6
        : 0
    ) +
    8;

  ensurePricingSpace(
    flow,
    rowHeight,
    tableTitle,
  );

  const topY =
    flow.getY();

  const bottomY =
    topY -
    rowHeight;

  const page =
    flow.getPage();

  page.drawRectangle({
    x:
      flow.pageMargin,

    y:
      bottomY,

    width:
      flow.contentWidth,

    height:
      rowHeight,

    color:
      line.itemType ===
      "fee"
        ? flow.colors.cream
        : flow.colors.white,

    borderColor:
      flow.colors.line,

    borderWidth:
      1,
  });

  let textY =
    topY -
    16;

  for (
    const textLine of nameLines
  ) {
    page.drawText(
      textLine,
      {
        x:
          flow.pageMargin +
          12,

        y:
          textY,

        size:
          8.8,

        font:
          flow.fonts.bold,

        color:
          flow.colors.black,
      },
    );

    textY -= 10;
  }

  if (
    detailLines.length
  ) {
    textY -= 1;

    for (
      const textLine of detailLines
    ) {
      page.drawText(
        textLine,
        {
          x:
            flow.pageMargin +
            12,

          y:
            textY,

          size:
            7.4,

          font:
            flow.fonts.regular,

          color:
            flow.colors.muted,
        },
      );

      textY -= 8.6;
    }
  }

  drawRightText(
    page,
    formatCurrencyCents(
      line.amountCents,
    ),
    flow.pageWidth -
      flow.pageMargin -
      12,
    topY - 19,
    flow.fonts.bold,
    11.5,
    flow.colors.black,
  );

  flow.setY(
    bottomY,
  );
}

function drawPricingSummaryRow({
  label,
  amountCents,
  height,
  fillColor,
  font,
  flow,
  textColor,
  amountSize = 10.5,
}: {
  label: string;
  amountCents: number;
  height: number;
  fillColor: PdfColor;
  font: PDFFont;

  flow:
    CommercialQuotePdfFlow;

  textColor?: PdfColor;
  amountSize?: number;
}) {
  const topY =
    flow.getY();

  const bottomY =
    topY -
    height;

  const page =
    flow.getPage();

  const color =
    textColor ??
    flow.colors.black;

  page.drawRectangle({
    x:
      flow.pageMargin,

    y:
      bottomY,

    width:
      flow.contentWidth,

    height,

    color:
      fillColor,

    borderColor:
      flow.colors.line,

    borderWidth:
      1,
  });

  page.drawText(
    sanitizePdfText(
      label,
    ),
    {
      x:
        flow.pageMargin +
        12,

      y:
        bottomY +
        (
          height -
          8
        ) /
        2,

      size:
        8.2,

      font,

      color,
    },
  );

  drawRightText(
    page,
    formatCurrencyCents(
      amountCents,
    ),
    flow.pageWidth -
      flow.pageMargin -
      12,
    bottomY +
      (
        height -
        amountSize
      ) /
      2,
    font,
    amountSize,
    color,
  );

  flow.setY(
    bottomY,
  );
}

function drawPaymentSchedule(
  quote:
    CommercialQuoteRow,

  flow:
    CommercialQuotePdfFlow,
) {
  ensureSectionSpace(
    flow,
    76,
  );

  flow.drawSectionTitle(
    "Payment schedule",
  );

  const totalPreServiceCents =
    quote
      .scheduling_deposit_cents +
    quote
      .additional_pre_service_cents;

  drawPaymentRow({
    label:
      `Scheduling deposit - ${quote.scheduling_deposit_percent}%`,

    amountCents:
      quote
        .scheduling_deposit_cents,

    description:
      "Due after both parties sign and reserves service capacity. Generally nonrefundable for a customer-caused cancellation; refunded when Clean Curb Co. cannot perform for a reason within its responsibility or control.",

    flow,
  });

  drawPaymentRow({
    label:
      `Additional pre-service payment - ${quote.additional_pre_service_percent}%`,

    amountCents:
      quote
        .additional_pre_service_cents,

    description:
      quote
        .additional_pre_service_percent >
      0
        ? `Due no later than ${quote.additional_pre_service_due_business_days} business days before service begins. Refundable until service begins.`
        : "No additional pre-service payment is required for this quote.",

    flow,
  });

  drawPaymentRow({
    label:
      `Completion balance - ${quote.completion_balance_percent}%`,

    amountCents:
      quote
        .completion_balance_cents,

    description:
      "Due when the accepted scope is completed.",

    flow,
  });

  drawPaymentRow({
    label:
      `Total required before service - ${quote.total_pre_service_percent}%`,

    amountCents:
      totalPreServiceCents,

    description:
      "Includes the scheduling deposit and any additional pre-service payment shown above.",

    emphasized:
      true,

    flow,
  });

  flow.drawParagraph(
    COMMERCIAL_PRE_SERVICE_TIMING_SUMMARY,
    {
      size:
        8,

      leading:
        10.5,

      color:
        flow.colors.muted,

      gapAfter:
        10,
    },
  );

  drawInformationBox({
    title:
      "Customer payment options",

    body:
      COMMERCIAL_PAYMENT_OPTIONS_SUMMARY,

    flow,
  });
}

function drawPaymentRow({
  label,
  amountCents,
  description,
  flow,
  emphasized = false,
}: {
  label: string;
  amountCents: number;
  description: string;

  flow:
    CommercialQuotePdfFlow;

  emphasized?: boolean;
}) {
  const descriptionLines =
    wrapPdfText(
      sanitizePdfText(
        description,
      ),
      flow.fonts.regular,
      7.7,
      flow.contentWidth - 24,
    );

  const rowHeight =
    38 +
    descriptionLines.length *
      8.8;

  ensureSectionSpace(
    flow,
    rowHeight + 4,
    "Payment schedule",
  );

  const topY =
    flow.getY();

  const bottomY =
    topY -
    rowHeight;

  const page =
    flow.getPage();

  page.drawRectangle({
    x:
      flow.pageMargin,

    y:
      bottomY,

    width:
      flow.contentWidth,

    height:
      rowHeight,

    color:
      emphasized
        ? flow.colors.cream
        : flow.colors.white,

    borderColor:
      emphasized
        ? flow.colors.gold
        : flow.colors.line,

    borderWidth:
      emphasized
        ? 1.3
        : 1,
  });

  page.drawText(
    sanitizePdfText(
      label,
    ),
    {
      x:
        flow.pageMargin +
        12,

      y:
        topY -
        17,

      size:
        8.5,

      font:
        flow.fonts.bold,

      color:
        flow.colors.black,
    },
  );

  drawRightText(
    page,
    formatCurrencyCents(
      amountCents,
    ),
    flow.pageWidth -
      flow.pageMargin -
      12,
    topY - 18,
    flow.fonts.bold,
    emphasized
      ? 12.5
      : 11,
    flow.colors.black,
  );

  let descriptionY =
    topY -
    34;

  for (
    const line of descriptionLines
  ) {
    page.drawText(
      line,
      {
        x:
          flow.pageMargin +
          12,

        y:
          descriptionY,

        size:
          7.7,

        font:
          flow.fonts.regular,

        color:
          flow.colors.muted,
      },
    );

    descriptionY -= 8.8;
  }

  flow.setY(
    bottomY - 4,
  );
}

function drawInformationBox({
  title,
  body,
  flow,
}: {
  title: string;
  body: string;

  flow:
    CommercialQuotePdfFlow;
}) {
  const bodyLines =
    wrapPdfText(
      sanitizePdfText(
        body,
      ),
      flow.fonts.regular,
      8,
      flow.contentWidth - 28,
    );

  const height =
    35 +
    bodyLines.length * 9.5 +
    12;

  ensureSectionSpace(
    flow,
    height + 8,
    "Payment schedule",
  );

  const topY =
    flow.getY();

  const bottomY =
    topY -
    height;

  const page =
    flow.getPage();

  page.drawRectangle({
    x:
      flow.pageMargin,

    y:
      bottomY,

    width:
      flow.contentWidth,

    height,

    color:
      flow.colors.cream,

    borderColor:
      flow.colors.purple,

    borderWidth:
      1,
  });

  page.drawText(
    sanitizePdfText(
      title.toUpperCase(),
    ),
    {
      x:
        flow.pageMargin +
        14,

      y:
        topY -
        18,

      size:
        7.5,

      font:
        flow.fonts.bold,

      color:
        flow.colors.purple,
    },
  );

  let textY =
    topY -
    35;

  for (
    const line of bodyLines
  ) {
    page.drawText(
      line,
      {
        x:
          flow.pageMargin +
          14,

        y:
          textY,

        size:
          8,

        font:
          flow.fonts.regular,

        color:
          flow.colors.black,
      },
    );

    textY -= 9.5;
  }

  flow.setY(
    bottomY - 15,
  );
}

function drawCustomerProjectBasis(
  quote:
    CommercialQuoteRow,

  initialPriceCents:
    number,

  recurringPriceCents:
    number | null,

  flow:
    CommercialQuotePdfFlow,
) {
  const initialBasis =
    initialPriceCents > 0
      ? buildCommercialCustomerProjectBasisFromQuote(
          quote,
          "initial",
        )
      : null;

  const recurringBasis =
    recurringPriceCents !==
      null &&
    recurringPriceCents > 0
      ? buildCommercialCustomerProjectBasisFromQuote(
          quote,
          "recurring",
        )
      : null;

  if (initialBasis) {
    drawProjectBasisSection({
      title:
        "Initial reset basis",

      basis:
        initialBasis,

      flow,
    });
  } else if (recurringBasis) {
    drawProjectBasisSection({
      title:
        "First recurring service basis",

      basis:
        recurringBasis,

      flow,
    });
  }

  if (
    initialBasis &&
    recurringBasis &&
    getProjectBasisKey(
      initialBasis,
    ) !==
      getProjectBasisKey(
        recurringBasis,
      )
  ) {
    drawProjectBasisSection({
      title:
        "Recurring service basis",

      basis:
        recurringBasis,

      flow,
    });
  }
}

function drawProjectBasisSection({
  title,
  basis,
  flow,
}: {
  title: string;

  basis:
    CommercialCustomerProjectBasis;

  flow:
    CommercialQuotePdfFlow;
}) {
  ensureSectionSpace(
    flow,
    88,
  );

  flow.drawSectionTitle(
    title,
  );

  flow.drawBulletList([
    ...basis
      .operatingSummaries,

    ...basis
      .workSummaries,
  ]);

  if (
    basis
      .surfaceSummaries
      .length
  ) {
    ensureSectionSpace(
      flow,
      70,
    );

    flow.drawSectionTitle(
      "Surface measurements",
    );

    flow.drawBulletList(
      basis
        .surfaceSummaries,
    );
  }
}

function ensurePricingSpace(
  flow:
    CommercialQuotePdfFlow,

  requiredHeight:
    number,

  tableTitle:
    string,
) {
  if (
    flow.getY() -
      requiredHeight >=
    flow.contentBottom
  ) {
    return;
  }

  flow.addContinuationPage();

  drawContinuationLabel(
    flow,
    tableTitle,
  );

  drawPricingColumnHeader(
    flow,
  );
}

function ensureSectionSpace(
  flow:
    CommercialQuotePdfFlow,

  requiredHeight:
    number,

  continuedTitle?:
    string,
) {
  if (
    flow.getY() -
      requiredHeight >=
    flow.contentBottom
  ) {
    return;
  }

  flow.addContinuationPage();

  if (continuedTitle) {
    drawContinuationLabel(
      flow,
      continuedTitle,
    );
  }
}

function drawContinuationLabel(
  flow:
    CommercialQuotePdfFlow,

  title:
    string,
) {
  const page =
    flow.getPage();

  const y =
    flow.getY();

  page.drawText(
    sanitizePdfText(
      `${title.toUpperCase()} - CONTINUED`,
    ),
    {
      x:
        flow.pageMargin,

      y,

      size:
        7.5,

      font:
        flow.fonts.bold,

      color:
        flow.colors.gold,
    },
  );

  page.drawLine({
    start: {
      x:
        flow.pageMargin,

      y:
        y - 7,
    },

    end: {
      x:
        flow.pageWidth -
        flow.pageMargin,

      y:
        y - 7,
    },

    thickness:
      0.8,

    color:
      flow.colors.black,
  });

  flow.setY(
    y - 22,
  );
}

function toPdfCustomerPricingLine(
  item:
    CommercialQuoteLineItemRow,
): PdfCustomerPricingLine {
  return {
    itemType:
      item.item_type,

    name:
      item.name,

    description:
      item.description,

    quantity:
      item.quantity,

    unitLabel:
      item.unit_label,

    amountCents:
      item.amount_cents,
  };
}

function createFallbackPricingLines(
  name:
    string,

  amountCents:
    number,
): PdfCustomerPricingLine[] {
  return [
    {
      itemType:
        "service",

      name,

      description:
        "Service under the customer-approved written scope.",

      quantity:
        1,

      unitLabel:
        "service",

      amountCents,
    },
  ];
}

function formatPricingDetail(
  line:
    PdfCustomerPricingLine,
) {
  const quantity =
    line.quantity > 0
      ? [
          formatQuantity(
            line.quantity,
          ),

          line.unitLabel,
        ]
          .filter(Boolean)
          .join(" ")
      : "";

  return [
    quantity,
    line.description,
  ]
    .filter(Boolean)
    .join(" - ");
}

function getProjectBasisKey(
  basis:
    CommercialCustomerProjectBasis,
) {
  return JSON.stringify({
    operating:
      basis.operatingSummaries,

    work:
      basis.workSummaries,

    surfaces:
      basis.surfaceSummaries,
  });
}

function formatQuantity(
  value:
    number,
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      maximumFractionDigits:
        2,
    },
  ).format(value);
}

function formatCurrencyCents(
  cents:
    number,
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      style:
        "currency",

      currency:
        "USD",
    },
  ).format(
    Math.max(
      0,
      cents,
    ) / 100,
  );
}

function humanizeFrequency(
  value:
    string | null,
) {
  if (!value) {
    return "Recurring";
  }

  return value
    .replace(
      /_/g,
      " ",
    )
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    );
}

function drawRightText(
  page:
    PDFPage,

  value:
    string,

  rightX:
    number,

  y:
    number,

  font:
    PDFFont,

  size:
    number,

  color:
    PdfColor,
) {
  const safeValue =
    sanitizePdfText(
      value,
    );

  page.drawText(
    safeValue,
    {
      x:
        rightX -
        font.widthOfTextAtSize(
          safeValue,
          size,
        ),

      y,
      size,
      font,
      color,
    },
  );
}

function wrapPdfText(
  value:
    string,

  font:
    PDFFont,

  size:
    number,

  maximumWidth:
    number,
) {
  const paragraphs =
    value
      .replace(
        /\r/g,
        "",
      )
      .split(
        "\n",
      );

  const lines:
    string[] = [];

  paragraphs.forEach(
    (
      paragraph,
      paragraphIndex,
    ) => {
      const words =
        paragraph
          .trim()
          .split(
            /\s+/,
          )
          .filter(Boolean);

      if (
        words.length ===
        0
      ) {
        lines.push("");
        return;
      }

      let currentLine =
        "";

      for (
        const word of words
      ) {
        const candidate =
          currentLine
            ? `${currentLine} ${word}`
            : word;

        if (
          font.widthOfTextAtSize(
            candidate,
            size,
          ) <=
          maximumWidth
        ) {
          currentLine =
            candidate;

          continue;
        }

        if (currentLine) {
          lines.push(
            currentLine,
          );
        }

        if (
          font.widthOfTextAtSize(
            word,
            size,
          ) <=
          maximumWidth
        ) {
          currentLine =
            word;

          continue;
        }

        const wordParts =
          splitLongWord(
            word,
            font,
            size,
            maximumWidth,
          );

        lines.push(
          ...wordParts.slice(
            0,
            -1,
          ),
        );

        currentLine =
          wordParts.at(-1) ??
          "";
      }

      if (currentLine) {
        lines.push(
          currentLine,
        );
      }

      if (
        paragraphIndex <
        paragraphs.length -
          1
      ) {
        lines.push("");
      }
    },
  );

  return lines;
}

function splitLongWord(
  word:
    string,

  font:
    PDFFont,

  size:
    number,

  maximumWidth:
    number,
) {
  const parts:
    string[] = [];

  let currentPart =
    "";

  for (
    const character of word
  ) {
    const candidate =
      `${currentPart}${character}`;

    if (
      currentPart &&
      font.widthOfTextAtSize(
        candidate,
        size,
      ) >
      maximumWidth
    ) {
      parts.push(
        currentPart,
      );

      currentPart =
        character;

      continue;
    }

    currentPart =
      candidate;
  }

  if (currentPart) {
    parts.push(
      currentPart,
    );
  }

  return parts;
}

function sanitizePdfText(
  value:
    string,
) {
  return value
    .replace(
      /[\u2018\u2019]/g,
      "'",
    )
    .replace(
      /[\u201c\u201d]/g,
      '"',
    )
    .replace(
      /[\u2013\u2014]/g,
      "-",
    )
    .replace(
      /\u2026/g,
      "...",
    )
    .replace(
      /\u00a0/g,
      " ",
    )
    .normalize(
      "NFKD",
    )
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .replace(
      /[^\x20-\x7E\n]/g,
      "?",
    );
}
