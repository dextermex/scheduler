"use client";

import { useState } from "react";

/**
 * A creator's profile picture, pulled from OpsTrack's public avatar proxy.
 * `sources` lists one URL per mapped OnlyFansAPI account (page); if one 404s
 * (page without a picture) we rotate to the next, and with none left — or no
 * mapping at all — we fall back to an initial circle, so the page never shows
 * a broken image.
 */
export function CreatorAvatar({
  sources,
  name,
  size = 28,
}: {
  sources: string[];
  name: string;
  size?: number;
}) {
  const [idx, setIdx] = useState(0);
  const common: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
  };
  if (idx >= sources.length) {
    return (
      <span
        aria-hidden
        style={{
          ...common,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(139, 124, 255, 0.18)",
          color: "#b6aaff",
          fontSize: Math.max(11, Math.round(size * 0.42)),
          fontWeight: 700,
        }}
      >
        {(name.trim()[0] || "?").toUpperCase()}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- external proxy URL, next/image needs remote config for no gain here
    <img
      src={sources[idx]}
      alt=""
      title={name}
      style={{ ...common, objectFit: "cover" }}
      onError={() => setIdx((i) => i + 1)}
    />
  );
}
