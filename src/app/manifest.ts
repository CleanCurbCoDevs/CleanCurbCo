import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Clean Curb Co. Field",
    short_name: "CCC Field",
    description:
      "Clean Curb Co. employee field service tools for routes, photos, checklists, and service operations.",

    start_url: "/employee-login",
    scope: "/",

    display: "standalone",
    orientation: "portrait",

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
  };
}
