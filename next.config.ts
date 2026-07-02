import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    authInterrupts: true,
  },
  async headers() {
    const securityHeaders = [
      { key: "X-DNS-Prefetch-Control", value: "on" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value:
          "camera=(), microphone=(), geolocation=(), payment=(self), browsing-topics=()",
      },
    ];

    const noIndexHeaders = [
      { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
    ];

    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      ...[
        "/admin/:path*",
        "/portal/:path*",
        "/field/:path*",
        "/api/:path*",
        "/login",
        "/employee-login",
        "/reset-password",
        "/account-setup",
        "/signup",
        "/payment-setup",
        "/payment-setup/:path*",
        "/billing/:path*",
      ].map((source) => ({
        source,
        headers: noIndexHeaders,
      })),
    ];
  },
};

export default nextConfig;
