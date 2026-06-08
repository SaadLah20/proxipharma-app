import type { MetadataRoute } from "next";
import { PHARMETO_BRAND } from "@/lib/brand-theme";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${PHARMETO_BRAND.productionUrl}/sitemap.xml`,
  };
}
