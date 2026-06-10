import type { MetadataRoute } from "next";
import { PHARMETO_BRAND, PHARMETO_ICON_SRC } from "@/lib/brand-theme";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: `/pharmeto-pwa-v${PHARMETO_BRAND.iconAssetVersion}`,
    name: PHARMETO_BRAND.name,
    short_name: PHARMETO_BRAND.name,
    description: "Annuaire et services pharmacies au Maroc",
    start_url: "/",
    display: "standalone",
    background_color: PHARMETO_BRAND.colors.background,
    theme_color: PHARMETO_BRAND.colors.primary,
    icons: [
      {
        src: PHARMETO_ICON_SRC,
        sizes: "500x500",
        type: "image/png",
        purpose: "any",
      },
      {
        src: PHARMETO_ICON_SRC,
        sizes: "500x500",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
