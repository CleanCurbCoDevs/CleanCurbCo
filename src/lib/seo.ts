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
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Clean Curb Co.",
    legalName: "Stonebranch Capital LLC",
    url: siteUrl,
    email: brand.email,
    image: `${siteUrl}/opengraph-image.png`,
    description:
      "Residential garbage bin cleaning, sanitizing, and deodorizing for Cane Bay and nearby Summerville, South Carolina communities.",
    areaServed: [
      {
        "@type": "Place",
        name: "Cane Bay, South Carolina",
      },
      {
        "@type": "Place",
        name: "Summerville, South Carolina",
      },
    ],
    makesOffer: [
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Residential trash bin cleaning",
          serviceType: "Garbage bin cleaning and sanitizing",
          areaServed: "Cane Bay and Summerville, SC",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Curbside bin deodorizing",
          serviceType: "Trash can deodorizing",
          areaServed: "Cane Bay and Summerville, SC",
        },
      },
    ],
  };
}
