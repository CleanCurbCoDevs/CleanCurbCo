import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
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
    sitemap: "https://cleancurbco.com/sitemap.xml",
  };
}
