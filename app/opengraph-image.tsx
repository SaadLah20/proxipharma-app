import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { PHARMETO_BRAND } from "@/lib/brand-theme";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Pharmeto — Votre pharmacie de quartier, en ligne";

export default async function OpenGraphImage() {
  const logoBuffer = await readFile(
    join(process.cwd(), "public/brand/pharmeto-icon.png"),
  );
  const logoSrc = `data:image/png;base64,${logoBuffer.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "64px 80px",
          background: `linear-gradient(135deg, ${PHARMETO_BRAND.colors.background} 0%, #e6f7f5 50%, #ccfbf1 100%)`,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -80,
            right: -40,
            width: 420,
            height: 420,
            borderRadius: "50%",
            background: "rgba(13, 148, 136, 0.12)",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 32,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            width={112}
            height={112}
            alt=""
            style={{
              objectFit: "contain",
            }}
          />
          <div
            style={{
              fontSize: 80,
              fontWeight: 700,
              color: PHARMETO_BRAND.colors.foreground,
              letterSpacing: "-0.03em",
              lineHeight: 1,
            }}
          >
            {PHARMETO_BRAND.name}
          </div>
        </div>
        <div
          style={{
            marginTop: 40,
            fontSize: 38,
            color: PHARMETO_BRAND.colors.secondary,
            maxWidth: 920,
            lineHeight: 1.3,
          }}
        >
          {PHARMETO_BRAND.taglineFr}
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 30,
            fontWeight: 600,
            color: PHARMETO_BRAND.colors.primaryDark,
          }}
        >
          {PHARMETO_BRAND.domain}
        </div>
      </div>
    ),
    { ...size },
  );
}
