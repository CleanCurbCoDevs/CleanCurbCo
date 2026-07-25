import "server-only";

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

import {
  COMMERCIAL_FULL_TERMS_NOTICE,
  COMMERCIAL_PAYMENT_AND_REFUND_SUMMARY,
  COMMERCIAL_SERVICE_CONCERN_SUMMARY,
  resolveCommercialPaymentTerms,
} from "@/lib/commercial-quote-policy";

import {
  drawCommercialQuotePricingSections,
} from "@/lib/commercial-quote-pdf-sections";

import type {
  CommercialQuoteLineItemRow,
  CommercialQuoteRequestRow,
  CommercialQuoteRow,
} from "@/types/database";

type CommercialQuotePdfInput = {
  request: CommercialQuoteRequestRow;
  quote: CommercialQuoteRow;
  lineItems?: CommercialQuoteLineItemRow[];
};

type PdfFonts = {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;

const PAGE_MARGIN = 42;
const CONTENT_WIDTH =
  PAGE_WIDTH - PAGE_MARGIN * 2;

const CONTENT_BOTTOM = 55;

const colors = {
  cream: rgb(
    245 / 255,
    244 / 255,
    239 / 255,
  ),

  black: rgb(
    5 / 255,
    5 / 255,
    5 / 255,
  ),

  gold: rgb(
    215 / 255,
    169 / 255,
    40 / 255,
  ),

  goldSoft: rgb(
    255 / 255,
    227 / 255,
    138 / 255,
  ),

  purple: rgb(
    138 / 255,
    0,
    196 / 255,
  ),

  muted: rgb(
    102 / 255,
    102 / 255,
    102 / 255,
  ),

  line: rgb(
    216 / 255,
    211 / 255,
    197 / 255,
  ),

  white: rgb(1, 1, 1),
};

export async function createCommercialQuotePdf({
  request,
  quote,
  lineItems = [],
}: CommercialQuotePdfInput) {
  const pdfDocument =
    await PDFDocument.create();

  const fonts: PdfFonts = {
    regular:
      await pdfDocument.embedFont(
        StandardFonts.Helvetica,
      ),

    bold:
      await pdfDocument.embedFont(
        StandardFonts.HelveticaBold,
      ),

    italic:
      await pdfDocument.embedFont(
        StandardFonts.HelveticaOblique,
      ),
  };

  const quoteReference =
    quote.quote_number?.trim() ||
    `DRAFT V${quote.version_number}`;

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

  const paymentTerms =
    resolveCommercialPaymentTerms(
      quote.payment_terms,
    );

  pdfDocument.setTitle(
    sanitizePdfText(
      `Commercial Quote - ${request.business_name}`,
    ),
  );

  pdfDocument.setAuthor(
    "Stonebranch Capital LLC d/b/a Clean Curb Co.",
  );

  pdfDocument.setSubject(
    "Commercial service quote",
  );

  pdfDocument.setCreator(
    "Clean Curb Co. Commercial Quote Builder",
  );

  let page =
    pdfDocument.addPage([
      PAGE_WIDTH,
      PAGE_HEIGHT,
    ]);

  drawFirstPageHeader(
    page,
    fonts,
    quoteReference,
  );

  let y = 636;

  function addContinuationPage() {
    page =
      pdfDocument.addPage([
        PAGE_WIDTH,
        PAGE_HEIGHT,
      ]);

    drawContinuationHeader(
      page,
      fonts,
      quoteReference,
    );

    y = 711;
  }

  function ensureSpace(
    requiredHeight: number,
  ) {
    if (
      y - requiredHeight <
      CONTENT_BOTTOM
    ) {
      addContinuationPage();
    }
  }

  function drawParagraph(
    value: string,
    options?: {
      size?: number;
      leading?: number;
      color?: ReturnType<typeof rgb>;
      font?: PDFFont;
      width?: number;
      indent?: number;
      gapAfter?: number;
    },
  ) {
    const size =
      options?.size ?? 9;

    const leading =
      options?.leading ?? 12;

    const color =
      options?.color ?? colors.black;

    const font =
      options?.font ?? fonts.regular;

    const indent =
      options?.indent ?? 0;

    const width =
      options?.width ??
      CONTENT_WIDTH - indent;

    const lines =
      wrapPdfText(
        sanitizePdfText(value),
        font,
        size,
        width,
      );

    for (
      const line of lines
    ) {
      ensureSpace(leading + 2);

      if (line) {
        page.drawText(
          line,
          {
            x:
              PAGE_MARGIN +
              indent,

            y,

            size,
            font,
            color,
          },
        );
      }

      y -= leading;
    }

    y -=
      options?.gapAfter ?? 8;
  }

  function drawSectionTitle(
    title: string,
  ) {
    ensureSpace(30);

    page.drawText(
      sanitizePdfText(
        title.toUpperCase(),
      ),
      {
        x: PAGE_MARGIN,
        y,
        size: 8,
        font: fonts.bold,
        color: colors.gold,
      },
    );

    y -= 7;

    page.drawLine({
      start: {
        x: PAGE_MARGIN,
        y,
      },

      end: {
        x:
          PAGE_WIDTH -
          PAGE_MARGIN,
        y,
      },

      thickness: 0.8,
      color: colors.black,
    });

    y -= 17;
  }

  function drawBulletList(
    items: string[],
  ) {
    const visibleItems =
      items
        .map((item) =>
          item.trim(),
        )
        .filter(Boolean);

    if (
      visibleItems.length === 0
    ) {
      drawParagraph(
        "No additional items were listed.",
        {
          color: colors.muted,
          font: fonts.italic,
        },
      );

      return;
    }

    for (
      const item of visibleItems
    ) {
      const lines =
        wrapPdfText(
          sanitizePdfText(item),
          fonts.regular,
          8.6,
          CONTENT_WIDTH - 18,
        );

      const itemHeight =
        Math.max(
          1,
          lines.length,
        ) *
          10.5 +
        4;

      ensureSpace(itemHeight);

      page.drawCircle({
        x: PAGE_MARGIN + 3,
        y: y + 3,
        size: 1.7,
        color: colors.purple,
      });

      for (
        const line of lines
      ) {
        page.drawText(
          line,
          {
            x:
              PAGE_MARGIN +
              14,

            y,

            size: 8.6,
            font: fonts.regular,
            color: colors.black,
          },
        );

        y -= 10.5;
      }

      y -= 4;
    }

    y -= 5;
  }

  function drawCallout(
    title: string,
    body: string,
    options?: {
      fillColor?:
        ReturnType<typeof rgb>;

      borderColor?:
        ReturnType<typeof rgb>;
    },
  ) {
    const bodyLines =
      wrapPdfText(
        sanitizePdfText(body),
        fonts.regular,
        8.2,
        CONTENT_WIDTH - 28,
      );

    const height =
      31 +
      bodyLines.length * 10 +
      13;

    ensureSpace(height + 10);

    const bottom =
      y - height + 8;

    page.drawRectangle({
      x: PAGE_MARGIN,
      y: bottom,
      width: CONTENT_WIDTH,
      height,
      color:
        options?.fillColor ??
        colors.goldSoft,
      borderColor:
        options?.borderColor ??
        colors.gold,
      borderWidth: 1,
    });

    page.drawText(
      sanitizePdfText(
        title.toUpperCase(),
      ),
      {
        x: PAGE_MARGIN + 14,
        y: y - 9,
        size: 7.7,
        font: fonts.bold,
        color: colors.black,
      },
    );

    let textY = y - 27;

    for (
      const line of bodyLines
    ) {
      page.drawText(
        line,
        {
          x:
            PAGE_MARGIN +
            14,

          y: textY,

          size: 8.2,
          font: fonts.regular,
          color: colors.black,
        },
      );

      textY -= 10;
    }

    y =
      bottom - 14;
  }

  drawCustomerInformationCards(
    page,
    fonts,
    request,
    quote,
    y,
  );

  y -= 109;

  drawCallout(
    "Free quote policy",
    "Quote fee: $0.00 - always. Online, onsite, or somewhere between 'looks fine' and 'what happened back here?'",
  );

  drawParagraph(
    "You run the property. We handle the part nobody wants to stand near.",
    {
      size: 12,
      leading: 15,
      font: fonts.bold,
      gapAfter: 13,
    },
  );

  drawCommercialQuotePricingSections({
    quote,
    lineItems,

    flow: {
      pageWidth:
        PAGE_WIDTH,

      pageMargin:
        PAGE_MARGIN,

      contentWidth:
        CONTENT_WIDTH,

      contentBottom:
        CONTENT_BOTTOM,

      fonts,
      colors,

      getPage:
        () => page,

      getY:
        () => y,

      setY:
        (nextY) => {
          y = nextY;
        },

      addContinuationPage,

      drawSectionTitle,
      drawParagraph,
      drawBulletList,
    },
  });

  drawSectionTitle(
    "Scope of work",
  );

  drawParagraph(
    quote.scope_summary,
    {
      size: 8.8,
      leading: 11.5,
    },
  );

  drawSectionTitle(
    "Included services",
  );

  drawBulletList(
    quote.included_services,
  );

  drawSectionTitle(
    "Exclusions",
  );

  drawBulletList(
    quote.exclusions,
  );

  drawSectionTitle(
    "Assumptions",
  );

  drawBulletList(
    quote.assumptions,
  );

  if (
    quote.customer_notes?.trim()
  ) {
    drawSectionTitle(
      "Customer notes",
    );

    drawParagraph(
      quote.customer_notes,
    );
  }

  drawSectionTitle(
    "Payment terms",
  );

  drawParagraph(
    paymentTerms,
    {
      size: 8.4,
      leading: 11,
    },
  );

  drawCallout(
    "Payment and refund summary",
    COMMERCIAL_PAYMENT_AND_REFUND_SUMMARY,
    {
      fillColor:
        colors.cream,

      borderColor:
        colors.purple,
    },
  );

  drawCallout(
    "Service concerns and corrections",
    COMMERCIAL_SERVICE_CONCERN_SUMMARY,
    {
      fillColor:
        colors.cream,

      borderColor:
        colors.gold,
    },
  );

  drawSectionTitle(
    "Complete terms",
  );

  drawParagraph(
    COMMERCIAL_FULL_TERMS_NOTICE,
    {
      size:
        8.2,

      leading:
        10.8,

      color:
        colors.muted,
    },
  );
  
  drawSectionTitle(
    "What happens next",
  );

  drawParagraph(
    "This quote is a proposal and does not authorize or schedule work. If the customer chooses to proceed, Clean Curb Co. will provide the Commercial Work Agreement, this accepted quote, the applicable Commercial Service Policies, and any required addenda through DocuSign. Service capacity is reserved after both parties sign and the 10% scheduling deposit is received.",
    {
      size:
        8.5,

      leading:
        11,
    },
  );

  drawParagraph(
    "Professional enough for procurement. Still willing to clean the dumpster pad.",
    {
      size: 8.2,
      leading: 11,
      font: fonts.bold,
      color: colors.purple,
      gapAfter: 0,
    },
  );

  const pages =
    pdfDocument.getPages();

  pages.forEach(
    (
      currentPage,
      index,
    ) => {
      drawFooter(
        currentPage,
        fonts,
        index + 1,
        pages.length,
      );
    },
  );

  return pdfDocument.save();
}

function drawFirstPageHeader(
  page: PDFPage,
  fonts: PdfFonts,
  quoteReference: string,
) {
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 122,
    width: PAGE_WIDTH,
    height: 122,
    color: colors.black,
  });

  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 128,
    width: PAGE_WIDTH,
    height: 6,
    color: colors.gold,
  });

  page.drawText(
    "Clean Curb Co.",
    {
      x: PAGE_MARGIN,
      y: PAGE_HEIGHT - 58,
      size: 24,
      font: fonts.bold,
      color: colors.white,
    },
  );

  page.drawText(
    "Fresh Starts at the Curb.",
    {
      x: PAGE_MARGIN,
      y: PAGE_HEIGHT - 78,
      size: 9.5,
      font: fonts.italic,
      color: colors.goldSoft,
    },
  );

  page.drawText(
    "(843) 888-4124  |  contact@cleancurbco.com",
    {
      x: PAGE_MARGIN,
      y: PAGE_HEIGHT - 97,
      size: 8,
      font: fonts.regular,
      color: rgb(
        216 / 255,
        216 / 255,
        216 / 255,
      ),
    },
  );

  drawRightText(
    page,
    "COMMERCIAL SERVICE PROPOSAL",
    PAGE_WIDTH - PAGE_MARGIN,
    PAGE_HEIGHT - 48,
    fonts.bold,
    7.5,
    colors.goldSoft,
  );

  drawRightText(
    page,
    "QUOTE",
    PAGE_WIDTH - PAGE_MARGIN,
    PAGE_HEIGHT - 76,
    fonts.bold,
    22,
    colors.white,
  );

  drawRightText(
    page,
    sanitizePdfText(
      quoteReference,
    ),
    PAGE_WIDTH - PAGE_MARGIN,
    PAGE_HEIGHT - 96,
    fonts.bold,
    10.5,
    colors.goldSoft,
  );
}

function drawContinuationHeader(
  page: PDFPage,
  fonts: PdfFonts,
  quoteReference: string,
) {
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 60,
    width: PAGE_WIDTH,
    height: 60,
    color: colors.black,
  });

  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 64,
    width: PAGE_WIDTH,
    height: 4,
    color: colors.gold,
  });

  page.drawText(
    "Clean Curb Co.",
    {
      x: PAGE_MARGIN,
      y: PAGE_HEIGHT - 38,
      size: 16,
      font: fonts.bold,
      color: colors.white,
    },
  );

  drawRightText(
    page,
    sanitizePdfText(
      `${quoteReference} - CONTINUED`,
    ),
    PAGE_WIDTH - PAGE_MARGIN,
    PAGE_HEIGHT - 37,
    fonts.bold,
    8,
    colors.goldSoft,
  );
}

function drawCustomerInformationCards(
  page: PDFPage,
  fonts: PdfFonts,
  request: CommercialQuoteRequestRow,
  quote: CommercialQuoteRow,
  topY: number,
) {
  const leftX =
    PAGE_MARGIN;

  const leftWidth =
    322;

  const gap = 15;

  const rightX =
    leftX +
    leftWidth +
    gap;

  const rightWidth =
    CONTENT_WIDTH -
    leftWidth -
    gap;

  const cardHeight =
    92;

  const bottomY =
    topY -
    cardHeight;

  drawCard(
    page,
    leftX,
    bottomY,
    leftWidth,
    cardHeight,
  );

  drawCard(
    page,
    rightX,
    bottomY,
    rightWidth,
    cardHeight,
  );

  page.drawText(
    "PREPARED FOR",
    {
      x: leftX + 14,
      y: topY - 20,
      size: 7.5,
      font: fonts.bold,
      color: colors.gold,
    },
  );

  const businessName =
    sanitizePdfText(
      request.business_name,
    );

  const businessNameSize =
    fitTextSize(
      businessName,
      fonts.bold,
      17,
      12,
      leftWidth - 28,
    );

  page.drawText(
    businessName,
    {
      x: leftX + 14,
      y: topY - 43,
      size: businessNameSize,
      font: fonts.bold,
      color: colors.black,
    },
  );

  const contactLine = [
    request.contact_name,
    request.contact_role,
  ]
    .filter(Boolean)
    .join(", ");

  page.drawText(
    sanitizePdfText(
      contactLine,
    ),
    {
      x: leftX + 14,
      y: topY - 61,
      size: 8.7,
      font: fonts.bold,
      color: colors.black,
    },
  );

  const address =
    sanitizePdfText(
      [
        request.street_address,
        `${request.city}, ${request.state} ${request.zip_code}`,
      ].join(", "),
    );

  const addressLines =
    wrapPdfText(
      address,
      fonts.regular,
      8.2,
      leftWidth - 28,
    ).slice(0, 2);

  let addressY =
    topY - 77;

  for (
    const line of addressLines
  ) {
    page.drawText(
      line,
      {
        x: leftX + 14,
        y: addressY,
        size: 8.2,
        font: fonts.regular,
        color: colors.black,
      },
    );

    addressY -= 9.5;
  }

  page.drawText(
    "PROPOSAL DETAILS",
    {
      x: rightX + 14,
      y: topY - 20,
      size: 7.5,
      font: fonts.bold,
      color: colors.gold,
    },
  );

  const detailRows = [
    {
      label: "Prepared",
      value:
        formatPdfDate(
          quote.updated_at,
        ),
    },

    {
      label:
        "Valid through",

      value:
        formatPdfDate(
          quote.valid_until,
        ),
    },

    {
      label:
        "Quote fee",

      value:
        "$0.00 - always",
    },
  ];

  let rowY =
    topY - 42;

  for (
    const row of detailRows
  ) {
    page.drawText(
      row.label,
      {
        x: rightX + 14,
        y: rowY,
        size: 7.7,
        font: fonts.regular,
        color: colors.muted,
      },
    );

    drawRightText(
      page,
      sanitizePdfText(
        row.value,
      ),
      rightX +
        rightWidth -
        14,
      rowY,
      fonts.bold,
      7.7,
      colors.black,
    );

    rowY -= 19;
  }
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
    borderWidth: 1,
  });
}

function drawFooter(
  page: PDFPage,
  fonts: PdfFonts,
  pageNumber: number,
  pageCount: number,
) {
  page.drawLine({
    start: {
      x: PAGE_MARGIN,
      y: 36,
    },

    end: {
      x:
        PAGE_WIDTH -
        PAGE_MARGIN,
      y: 36,
    },

    thickness: 0.6,
    color: colors.line,
  });

  page.drawText(
    "Clean Curb Co. - A trade name of Stonebranch Capital LLC - Local, veteran-owned small business",
    {
      x: PAGE_MARGIN,
      y: 22,
      size: 6.7,
      font: fonts.regular,
      color: colors.muted,
    },
  );

  drawRightText(
    page,
    `Page ${pageNumber} of ${pageCount}  |  Fresh Starts at the Curb.`,
    PAGE_WIDTH -
      PAGE_MARGIN,
    22,
    fonts.bold,
    6.7,
    colors.black,
  );
}

function drawRightText(
  page: PDFPage,
  value: string,
  rightX: number,
  y: number,
  font: PDFFont,
  size: number,
  color: ReturnType<typeof rgb>,
) {
  const safeValue =
    sanitizePdfText(value);

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

function fitTextSize(
  value: string,
  font: PDFFont,
  maximumSize: number,
  minimumSize: number,
  maximumWidth: number,
) {
  let size =
    maximumSize;

  while (
    size > minimumSize &&
    font.widthOfTextAtSize(
      value,
      size,
    ) >
      maximumWidth
  ) {
    size -= 0.5;
  }

  return size;
}

function wrapPdfText(
  value: string,
  font: PDFFont,
  size: number,
  maximumWidth: number,
) {
  const paragraphs =
    value
      .replace(/\r/g, "")
      .split("\n");

  const lines: string[] =
    [];

  paragraphs.forEach(
    (
      paragraph,
      paragraphIndex,
    ) => {
      const words =
        paragraph
          .trim()
          .split(/\s+/)
          .filter(Boolean);

      if (
        words.length === 0
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
        paragraphs.length - 1
      ) {
        lines.push("");
      }
    },
  );

  return lines;
}

function splitLongWord(
  word: string,
  font: PDFFont,
  size: number,
  maximumWidth: number,
) {
  const parts: string[] =
    [];

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

function formatCurrencyCents(
  cents: number,
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
    },
  ).format(
    Math.max(
      0,
      cents,
    ) / 100,
  );
}

function formatPdfDate(
  value: string | null,
) {
  if (!value) {
    return "Not set";
  }

  const date =
    /^\d{4}-\d{2}-\d{2}$/.test(
      value,
    )
      ? new Date(
          `${value}T12:00:00`,
        )
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "long",
      day: "numeric",
      year: "numeric",
    },
  ).format(date);
}

function humanizeFrequency(
  value: string | null,
) {
  if (!value) {
    return "Recurring";
  }

  return value
    .replace(/_/g, " ")
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    );
}

function sanitizePdfText(
  value: string,
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
    .normalize("NFKD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .replace(
      /[^\x20-\x7E\n]/g,
      "?",
    );
}
