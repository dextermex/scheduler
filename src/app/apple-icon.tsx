import fs from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

/**
 * iOS home-screen icon — same mark as icon.tsx but full-bleed at 180px,
 * since iOS applies its own corner mask.
 */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const buf = await fs.readFile(
    path.join(process.cwd(), "src/assets/fonts/BarlowCondensed-Bold.ttf"),
  );
  const barlow = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #a9bdff 0%, #7d9bff 55%, #6f5bff 100%)",
          color: "#08060b",
          fontFamily: "Barlow Condensed",
          fontSize: 128,
          fontWeight: 700,
          lineHeight: 1,
          paddingBottom: 8,
        }}
      >
        H
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Barlow Condensed", data: barlow, weight: 700, style: "normal" }],
    },
  );
}
