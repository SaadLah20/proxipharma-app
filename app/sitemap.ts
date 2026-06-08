import type { MetadataRoute } from "next";
import { PHARMETO_BRAND } from "@/lib/brand-theme";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = PHARMETO_BRAND.productionUrl;
  const now = new Date();
  return [
    { url: base, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/auth`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];
}
