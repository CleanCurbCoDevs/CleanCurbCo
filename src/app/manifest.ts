import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Clean Curb Co.",
    short_name: "Clean Curb",
    description:
      "Garbage bin cleaning, sanitizing, and deodorizing for Cane Bay and nearby Summerville communities.",
    start_url: "/",
    scope: "/",
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
  };
}
