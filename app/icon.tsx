import { ImageResponse } from "next/og";
import { PHARMETO_BRAND } from "@/lib/brand-theme";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 112,
        }}
      >
        <div
          style={{
            width: 220,
            height: 220,
            background: "white",
            borderRadius: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <div
            style={{
              width: 120,
              height: 160,
              background: PHARMETO_BRAND.colors.primary,
              borderRadius: 16,
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 36,
              bottom: 36,
              width: 44,
              height: 44,
              borderRadius: 22,
              background: "white",
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
