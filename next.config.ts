import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  webpack: (config, { dev }) => {
    if (dev) {
      const ignored = [
        "**/node_modules/**",
        "**/.git/**",
        "**/.next/**",
        "**/.cursor/**",
        "**/scripts/__pycache__/**",
      ];
      config.watchOptions = {
        ...config.watchOptions,
        ignored: Array.isArray(config.watchOptions?.ignored)
          ? [...config.watchOptions.ignored, ...ignored]
          : ignored,
      };
    }
    return config;
  },
};

export default withNextIntl(nextConfig);
