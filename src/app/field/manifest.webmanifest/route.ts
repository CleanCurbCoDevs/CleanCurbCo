import { NextResponse } from "next/server";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(
    {
      name: "CCC Field | Clean Curb Co.",
      short_name: "CCC Field",
      description: "Clean Curb Co. field route and service workflow app.",
      start_url: "/field/today",
      scope: "/field/",
      display: "standalone",
      background_color: "#050505",
      theme_color: "#00ff38",
      icons: [
        {
          src: "/ccc-field-icon-192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "maskable",
        },
        {
          src: "/ccc-field-icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/ccc-field-apple-touch-icon.png",
          sizes: "180x180",
          type: "image/png",
        },
      ],
    },
    {
      headers: {
        "Content-Type": "application/manifest+json",
      },
    },
  );
}
