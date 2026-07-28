import type { Metadata } from "next";
import { brand } from "@/lib/site";

type PublicMetadataInput = {
  title: string;
  description: string;
  path: string;
};

export function publicPageMetadata({
  title,
  description,
  path,
}: PublicMetadataInput): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: `${title} | Clean Curb Co.`,
      description,
      url: path,
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
      title: `${title} | Clean Curb Co.`,
      description,
      images: ["/twitter-image.png"],
    },
  };
}

export function localBusinessStructuredData(siteUrl: string) {
  const businessId = `${siteUrl}/#business`;
  const websiteId = `${siteUrl}/#website`;

  const serviceAreas = [
    "Goose Creek, South Carolina",
    "Summerville, South Carolina",
    "Moncks Corner, South Carolina",
    "Cane Bay, South Carolina",
    "Nexton, South Carolina",
    "Carnes Crossroads, South Carolina",
    "Berkeley County, South Carolina",
    "Charleston County, South Carolina",
  ];

  const services = [
    "Garbage bin cleaning",
    "Trash can cleaning",
    "Recycling bin cleaning",
    "Bin sanitizing",
    "Bin deodorizing",
    "Trash pad cleaning",
    "One-time bin cleaning",
    "Recurring bin cleaning",
  ];

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": websiteId,
        url: siteUrl,
        name: "Clean Curb Co.",
        alternateName: "Clean Curb Co",
        publisher: {
          "@id": businessId,
        },
      },
      {
        "@type": "LocalBusiness",
        "@id": businessId,
        name: "Clean Curb Co.",
        legalName: "Stonebranch Capital LLC",
        url: siteUrl,
        telephone: brand.phone,
        email: brand.email,
        logo: `${siteUrl}/clean-curb-logo.png`,
        image: [
          `${siteUrl}/opengraph-image.png`,
          `${siteUrl}/images/proof/bin-cleaning-action-driveway.jpeg`,
          `${siteUrl}/images/proof/bin-inside-after-detail.jpeg`,
        ],
        description:
          "Clean Curb Co. provides curbside garbage, trash, and recycling bin cleaning, sanitizing, and deodorizing throughout Goose Creek, Summerville, Moncks Corner, Cane Bay, and nearby Lowcountry communities. Local, veteran-owned service with one-time and recurring cleaning options.",
        priceRange: "$",
        slogan: "Fresh Starts at the Curb.",
        areaServed: serviceAreas.map((name) => ({
          "@type": "Place",
          name,
        })),
        sameAs: [
          "https://www.facebook.com/profile.php?id=61591401340864",
        ],
        potentialAction: {
          "@type": "ReserveAction",
          name: "Book garbage bin cleaning",
          target: `${siteUrl}/book`,
        },
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: "Garbage bin cleaning services",
          itemListElement: services.map((name) => ({
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name,
              provider: {
                "@id": businessId,
              },
              areaServed: serviceAreas.map((area) => ({
                "@type": "Place",
                name: area,
              })),
            },
          })),
        },
      },
    ],
  };
}
