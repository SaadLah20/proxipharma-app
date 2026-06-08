import type { MetadataRoute } from "next";
import { PHARMETO_BRAND } from "@/lib/brand-theme";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: PHARMETO_BRAND.name,
    short_name: PHARMETO_BRAND.name,
    description: "Annuaire et services pharmacies au Maroc",
    start_url: "/",
    display: "standalone",
    background_color: PHARMETO_BRAND.colors.background,
    theme_color: PHARMETO_BRAND.colors.primary,
    icons: [
      {
        src: "/brand/pharmeto-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
