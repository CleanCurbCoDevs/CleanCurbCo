import { NextResponse } from "next/server";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(
    {
      id: "/field/",
      name: "Clean Curb Co. Field",
      short_name: "CCC Field",
      description:
        "Clean Curb Co. employee field service and route operations.",

      start_url: "/field/login",
      scope: "/field/",

      display: "standalone",
      orientation: "portrait",

      background_color: "#050505",
      theme_color: "#00ff38",

      categories: ["business", "productivity", "utilities"],

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
        "Cache-Control": "public, max-age=0, must-revalidate",
      },
    },
  );
}
