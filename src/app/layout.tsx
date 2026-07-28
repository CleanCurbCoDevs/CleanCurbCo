import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ActionFeedbackProvider } from "@/components/action-feedback";
import { ChromeFrame } from "@/components/chrome-frame";
import { CookieConsentProvider } from "@/components/cookie-consent-provider";
import { PublicPageEffects } from "@/components/public-page-effects";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CommercialFooter } from "@/components/commercial/commercial-footer";
import { CommercialHeader } from "@/components/commercial/commercial-header";
import { getSiteUrl } from "@/lib/env";
import { localBusinessStructuredData } from "@/lib/seo";
import { brand } from "@/lib/site";
import "./globals.css";
import "./tablet.css";
import "./commercial/commercial-chrome.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  applicationName: "Clean Curb Co.",
  manifest: "/manifest.webmanifest",
  title: {
    default:
      "Clean Curb Co. | Garbage Bin Cleaning in Goose Creek, SC",
    template: "%s | Clean Curb Co.",
  },
  description:
    "Local garbage bin cleaning, sanitizing, and deodorizing serving Goose Creek, Summerville, Moncks Corner, Cane Bay, and nearby Lowcountry communities.",
  keywords: [
    "Garbage bin cleaning Goose Creek SC",
    "Trash can cleaning Goose Creek",
    "Bin cleaning Summerville SC",
    "Garbage bin cleaning Moncks Corner SC",
    "Bin cleaning Cane Bay SC",
    "Garbage bin sanitizing",
    "Recycling bin cleaning",
    "Trash can deodorizing",
    "Curbside bin cleaning",
    "Residential garbage bin cleaning",
  ],
  openGraph: {
    title:
      "Clean Curb Co. | Garbage Bin Cleaning in Goose Creek, SC",
    description:
      "Garbage bin cleaning, sanitizing, and deodorizing throughout Goose Creek and nearby Lowcountry communities.",
    url: "/",
    siteName: "Clean Curb Co.",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1024,
        height: 1024,
        alt: brand.logoAlt,
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title:
      "Clean Curb Co. | Garbage Bin Cleaning in Goose Creek, SC",
    description:
      "Local garbage bin cleaning serving Goose Creek, Summerville, Moncks Corner, Cane Bay, and nearby communities.",
    images: ["/twitter-image.png"],
  },
  appleWebApp: {
    capable: true,
    title: "Clean Curb Co.",
    statusBarStyle: "black-translucent",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [
      {
        url: "/ccc-field-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/ccc-field-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/ccc-field-apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  colorScheme: "dark light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const siteUrl = getSiteUrl();

  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        <ActionFeedbackProvider>
          <CookieConsentProvider>
            <ChromeFrame
              header={<SiteHeader />}
              footer={<SiteFooter />}
              commercialHeader={<CommercialHeader />}
              commercialFooter={<CommercialFooter />}
            >
              <PublicPageEffects />
              {children}
            </ChromeFrame>
          </CookieConsentProvider>
        </ActionFeedbackProvider>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              localBusinessStructuredData(siteUrl),
            ),
          }}
        />
      </body>
    </html>
  );
}
