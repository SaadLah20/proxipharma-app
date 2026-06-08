import { ImageResponse } from "next/og";
import { PHARMETO_BRAND } from "@/lib/brand-theme";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: PHARMETO_BRAND.colors.primary,
          borderRadius: 40,
        }}
      >
        <div
          style={{
            width: 78,
            height: 78,
            background: "white",
            borderRadius: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <div
            style={{
              width: 42,
              height: 56,
              background: PHARMETO_BRAND.colors.primary,
              borderRadius: 8,
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 12,
              bottom: 12,
              width: 16,
              height: 16,
              borderRadius: 8,
              background: "white",
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
