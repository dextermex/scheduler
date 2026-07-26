/**
 * Chatter colors come from the old sheet's roster and are used as TEXT colors
 * on a near-black poster, so very dark hexes (e.g. a very dark #333333) get lightened
 * until they clear a minimum lightness. The stored color is never mutated —
 * only the rendered one.
 */

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const hue = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue(p, q, h + 1 / 3);
    g = hue(p, q, h);
    b = hue(p, q, h - 1 / 3);
  }
  const to = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Lighten a hex color until it reads clearly on a dark background. */
export function readableOnDark(hex: string, minLightness = 0.6): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#c9c2d8";
  const [h, s, l] = rgbToHsl(...rgb);
  if (l >= minLightness) return hex.startsWith("#") ? hex : `#${hex}`;
  return hslToHex(h, s, minLightness);
}

/** Low-alpha rgba() of the color, for tinted card backgrounds. */
export function tintOnDark(hex: string, alpha = 0.16): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(139, 124, 255, ${alpha})`;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

/**
 * Alpha-composite `hex` at `alpha` over an opaque background and return the
 * resulting OPAQUE hex. Satori/resvg dithers low-alpha gradient stops into
 * visible banding — pre-blended opaque stops render clean.
 */
export function blendOnBg(hex: string, alpha: number, bg = "#14111c"): string {
  const fg = hexToRgb(hex) ?? [139, 124, 255];
  const base = hexToRgb(bg) ?? [20, 17, 28];
  const to = (i: number) =>
    Math.round(fg[i] * alpha + base[i] * (1 - alpha))
      .toString(16)
      .padStart(2, "0");
  return `#${to(0)}${to(1)}${to(2)}`;
}
