import fs from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

/**
 * Favicon, generated with the same next/og machinery as the Discord posters:
 * a rounded square in the site's periwinkle→violet accent with a Barlow
 * Condensed "H". Served at /icon and linked automatically by Next.
 */

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default async function Icon() {
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
          borderRadius: 14,
          background: "linear-gradient(135deg, #a9bdff 0%, #7d9bff 55%, #6f5bff 100%)",
          color: "#08060b",
          fontFamily: "Barlow Condensed",
          fontSize: 46,
          fontWeight: 700,
          lineHeight: 1,
          paddingBottom: 3,
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
