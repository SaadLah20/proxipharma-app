import { ImageResponse } from "next/og";
import { PHARMETO_BRAND } from "@/lib/brand-theme";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Pharmeto — Votre pharmacie de quartier, en ligne";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 72,
          background: `linear-gradient(135deg, ${PHARMETO_BRAND.colors.background} 0%, #e6f7f5 55%, #d1fae5 100%)`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 28,
          }}
        >
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 24,
              background: PHARMETO_BRAND.colors.primary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 44,
                height: 58,
                background: "white",
                borderRadius: 10,
              }}
            />
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: PHARMETO_BRAND.colors.foreground,
              letterSpacing: "-0.03em",
            }}
          >
            Pharmeto
          </div>
        </div>
        <div
          style={{
            marginTop: 36,
            fontSize: 40,
            color: PHARMETO_BRAND.colors.secondary,
            maxWidth: 900,
            lineHeight: 1.25,
          }}
        >
          {PHARMETO_BRAND.taglineFr}
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 28,
            color: PHARMETO_BRAND.colors.primaryDark,
          }}
        >
          pharmeto.ma
        </div>
      </div>
    ),
    { ...size }
  );
}
