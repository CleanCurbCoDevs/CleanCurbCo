import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/admin/",
        "/portal",
        "/portal/",
        "/field",
        "/field/",
        "/api",
        "/api/",
        "/login",
        "/employee-login",
        "/reset-password",
        "/account-setup",
        "/signup",
        "/payment-setup",
        "/billing",
        "/billing/",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
