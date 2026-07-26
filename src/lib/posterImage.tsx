import fs from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { prisma } from "./prisma";
import { blendOnBg, readableOnDark, tintOnDark } from "./colors";
import { posterName } from "./displayName";
import {
  addDaysISO,
  DAY_NAMES,
  formatDayDate,
  formatWeekRange,
  isoWeekNumber,
  SHIFT_INFO,
  SHIFT_ORDER,
  type ShiftKey,
} from "./time";

/**
 * Renders a model's weekly schedule as a PNG in the site's visual design
 * (Barlow Condensed / Hanken Grotesk / Fragment Mono on near-black with the
 * periwinkle accent), for the per-model Discord channel posts.
 *
 * Variants:
 *  - "timeline": one row per chatter per shift block, day beads across the
 *    week — answers "when is each person on" without repeating names.
 *  - "rails": three shift columns, consecutive days with the same crew merged
 *    into one block — the compressed agenda.
 *  - "grid": the original 7×3 day grid.
 *
 * Satori only does flexbox, so everything is flex rows.
 */

export type PosterVariant = "grid" | "timeline" | "rails";

const C = {
  bg: "#08060b",
  raised: "#131019",
  border: "#ffffff17",
  overlay: "#ffffff0d",
  text: "#f0eee9",
  dim: "#a9a5ad",
  faint: "#726e78",
  accent: "#7d9bff",
  accentBright: "#a9bdff",
  danger: "#ff8a95",
  dangerBorder: "#e5484d66",
  dangerBg: "#e5484d14",
};

const W = 1440;
const PAD = 56;
const DAY_SHORT = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

interface SlotChatter {
  name: string;
  color: string;
}

async function font(file: string): Promise<ArrayBuffer> {
  const buf = await fs.readFile(path.join(process.cwd(), "src/assets/fonts", file));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

function mono(text: string, size: number, color: string, spacing = 4): React.ReactElement {
  return (
    <span style={{ fontFamily: "Fragment Mono", fontSize: size, color, letterSpacing: spacing }}>
      {text.toUpperCase()}
    </span>
  );
}

function dayLabel(weekStart: string, d: number): string {
  return `${DAY_SHORT[d]} ${formatDayDate(weekStart, d).slice(0, 2)}`;
}

function runLabel(weekStart: string, start: number, end: number): string {
  if (start === end) return dayLabel(weekStart, start);
  return `${dayLabel(weekStart, start)} — ${dayLabel(weekStart, end)}`;
}

function header(creatorName: string, weekStart: string): React.ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{ width: 12, height: 12, borderRadius: 999, backgroundColor: C.accent, display: "flex" }}
          />
          {mono("AURA", 20, C.text, 7)}
        </div>
        {mono(`INTERNAL · WEEK ${isoWeekNumber(weekStart)} / ${weekStart.slice(0, 4)}`, 15, C.faint)}
      </div>
      <div style={{ display: "flex", marginTop: 40 }}>
        {mono("WEEKLY CHATTER SCHEDULE FOR", 15, C.dim, 9)}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginTop: 2,
          marginBottom: 34,
        }}
      >
        <span
          style={{
            fontFamily: "Barlow Condensed",
            fontWeight: 700,
            fontSize: 108,
            lineHeight: 1,
            letterSpacing: 2,
          }}
        >
          {creatorName.toUpperCase()}
        </span>
        <div
          style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", paddingBottom: 12 }}
        >
          {mono("IN EFFECT", 13, C.faint, 5)}
          <span
            style={{
              fontFamily: "Barlow Condensed",
              fontWeight: 600,
              fontSize: 32,
              color: C.accentBright,
              letterSpacing: 1.5,
              marginTop: 6,
            }}
          >
            {formatWeekRange(weekStart).toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  );
}

interface PosterData {
  creatorName: string;
  slots: Map<string, SlotChatter[]>;
  roster: { name: string; color: string; count: number }[];
}

async function loadData(creatorId: string, weekStart: string): Promise<PosterData | null> {
  const creator = await prisma.creator.findUnique({ where: { id: creatorId } });
  if (!creator) return null;
  const assignments = await prisma.assignment.findMany({
    where: { weekStart, creatorId },
    include: { chatter: true },
    orderBy: { id: "asc" },
  });
  const slots = new Map<string, SlotChatter[]>();
  const totals = new Map<string, { name: string; color: string; count: number }>();
  for (const a of assignments) {
    // Posters show real first names — or the chatting alias for LX people.
    const display = posterName(a.chatter);
    const key = `${a.day}|${a.shift}`;
    const list = slots.get(key) ?? [];
    list.push({ name: display, color: a.chatter.color });
    slots.set(key, list);
    const t = totals.get(a.chatterId) ?? { name: display, color: a.chatter.color, count: 0 };
    t.count += 1;
    totals.set(a.chatterId, t);
  }
  const roster = [...totals.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );
  return { creatorName: creator.name, slots, roster };
}

/* ── Variant: timeline ───────────────────────────────────────────────────── */

interface TimelineRow {
  name: string;
  color: string;
  days: boolean[];
  count: number;
}

function timelineRows(data: PosterData, shift: ShiftKey): TimelineRow[] {
  const byName = new Map<string, TimelineRow>();
  for (let d = 0; d < 7; d++) {
    for (const c of data.slots.get(`${d}|${shift}`) ?? []) {
      let row = byName.get(c.name);
      if (!row) {
        row = { name: c.name, color: c.color, days: Array(7).fill(false), count: 0 };
        byName.set(c.name, row);
      }
      row.days[d] = true;
      row.count += 1;
    }
  }
  return [...byName.values()].sort(
    (a, b) =>
      a.days.findIndex(Boolean) - b.days.findIndex(Boolean) ||
      b.count - a.count ||
      a.name.localeCompare(b.name),
  );
}

function shiftGapDays(data: PosterData, shift: ShiftKey): number[] {
  const gaps: number[] = [];
  for (let d = 0; d < 7; d++) {
    if ((data.slots.get(`${d}|${shift}`) ?? []).length === 0) gaps.push(d);
  }
  return gaps;
}

function buildTimeline(
  data: PosterData,
  weekStart: string,
): { element: React.ReactElement; height: number } {
  const NAME_W = 270;
  const sections = SHIFT_ORDER.map((shift) => ({
    shift,
    rows: timelineRows(data, shift),
    gaps: shiftGapDays(data, shift),
  }));

  let height = PAD * 2 + 262;
  for (const s of sections) {
    height += 64 + 34 + Math.max(s.rows.length, 1) * 62 + (s.gaps.length > 0 && s.gaps.length < 7 ? 44 : 0) + 30;
  }

  const element = (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: C.bg,
        backgroundImage: "radial-gradient(circle at 50% -10%, #6082ff30 0%, #08060b00 55%)",
        color: C.text,
        padding: `${PAD}px 60px`,
        fontFamily: "Hanken Grotesk",
      }}
    >
      {header(data.creatorName, weekStart)}
      {sections.map(({ shift, rows, gaps }) => (
        <div key={shift} style={{ display: "flex", flexDirection: "column", marginBottom: 30 }}>
          {/* section header */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 16,
              borderBottom: `1px solid ${C.border}`,
              paddingBottom: 8,
              marginBottom: 12,
            }}
          >
            <span
              style={{
                fontFamily: "Barlow Condensed",
                fontWeight: 600,
                fontSize: 38,
                letterSpacing: 2,
              }}
            >
              {SHIFT_INFO[shift].label.toUpperCase()}
            </span>
            {mono(`${SHIFT_INFO[shift].start} — ${SHIFT_INFO[shift].end}`, 16, C.accentBright, 2)}
          </div>
          {/* day header */}
          <div style={{ display: "flex", marginBottom: 8 }}>
            <div style={{ width: NAME_W, display: "flex" }} />
            {Array.from({ length: 7 }, (_, d) => (
              <div key={d} style={{ flex: 1, display: "flex", justifyContent: "center" }}>
                {mono(dayLabel(weekStart, d), 11, C.faint, 2)}
              </div>
            ))}
          </div>
          {/* rows */}
          {rows.length === 0 ? (
            <div style={{ display: "flex", height: 62, alignItems: "center" }}>
              <span style={{ color: C.faint, fontSize: 15 }}>Nothing scheduled.</span>
            </div>
          ) : (
            rows.map((r) => (
              <div key={r.name} style={{ display: "flex", alignItems: "center", height: 62 }}>
                <div style={{ width: NAME_W, display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span
                    style={{
                      fontFamily: "Barlow Condensed",
                      fontWeight: 600,
                      fontSize: 30,
                      letterSpacing: 1.5,
                      color: readableOnDark(r.color),
                    }}
                  >
                    {r.name.toUpperCase()}
                  </span>
                  {mono(`x${r.count}`, 13, C.faint, 1)}
                </div>
                {r.days.map((on, d) => (
                  <div key={d} style={{ flex: 1, display: "flex", padding: "0 3px" }}>
                    <div
                      style={{
                        flex: 1,
                        height: 42,
                        borderRadius: 9,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: on ? tintOnDark(r.color, 0.3) : "transparent",
                        border: on
                          ? `1px solid ${tintOnDark(r.color, 0.55)}`
                          : `1px solid #ffffff0a`,
                      }}
                    >
                      {on ? (
                        <span
                          style={{
                            fontFamily: "Fragment Mono",
                            fontSize: 12,
                            color: readableOnDark(r.color),
                            letterSpacing: 1,
                          }}
                        >
                          {formatDayDate(weekStart, d).slice(0, 2)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
          {/* uncovered days */}
          {gaps.length > 0 && gaps.length < 7 ? (
            <div style={{ display: "flex", alignItems: "center", height: 44 }}>
              <div style={{ width: NAME_W, display: "flex" }}>
                {mono("NO COVER", 13, C.danger, 3)}
              </div>
              {Array.from({ length: 7 }, (_, d) => (
                <div key={d} style={{ flex: 1, display: "flex", padding: "0 3px" }}>
                  {gaps.includes(d) ? (
                    <div
                      style={{
                        flex: 1,
                        height: 30,
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: `1px solid ${C.dangerBorder}`,
                        backgroundColor: C.dangerBg,
                      }}
                    >
                      <span style={{ fontFamily: "Fragment Mono", fontSize: 12, color: C.danger }}>
                        !
                      </span>
                    </div>
                  ) : (
                    <div style={{ flex: 1, display: "flex" }} />
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
  return { element, height };
}

/* ── Variant: rails ──────────────────────────────────────────────────────── */

interface RailBlock {
  start: number;
  end: number;
  crew: SlotChatter[]; // empty = no cover
}

function railBlocks(data: PosterData, shift: ShiftKey): RailBlock[] {
  const sig = (d: number) =>
    (data.slots.get(`${d}|${shift}`) ?? []).map((c) => c.name).join("+");
  const blocks: RailBlock[] = [];
  for (let d = 0; d < 7; d++) {
    const prev = blocks[blocks.length - 1];
    if (prev && sig(d) === sig(prev.start)) {
      prev.end = d;
    } else {
      blocks.push({ start: d, end: d, crew: data.slots.get(`${d}|${shift}`) ?? [] });
    }
  }
  return blocks;
}

function buildRails(
  data: PosterData,
  weekStart: string,
): { element: React.ReactElement; height: number } {
  const columns = SHIFT_ORDER.map((shift) => ({ shift, blocks: railBlocks(data, shift) }));

  const blockH = (b: RailBlock) => 74 + Math.max(b.crew.length, 1) * 42;
  const colH = (blocks: RailBlock[]) =>
    blocks.reduce((sum, b) => sum + blockH(b) + 12, 0);
  const height =
    PAD * 2 + 262 + 84 + Math.max(...columns.map((c) => colH(c.blocks))) + 150;

  const element = (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: C.bg,
        backgroundImage: "radial-gradient(circle at 50% -10%, #6082ff30 0%, #08060b00 55%)",
        color: C.text,
        padding: `${PAD}px 60px`,
        fontFamily: "Hanken Grotesk",
      }}
    >
      {header(data.creatorName, weekStart)}
      <div style={{ display: "flex", gap: 16, flex: 1 }}>
        {columns.map(({ shift, blocks }) => (
          <div key={shift} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            {/* column head */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                borderBottom: `1px solid ${C.border}`,
                paddingBottom: 12,
                marginBottom: 14,
              }}
            >
              <span
                style={{
                  fontFamily: "Barlow Condensed",
                  fontWeight: 600,
                  fontSize: 40,
                  letterSpacing: 2.5,
                }}
              >
                {SHIFT_INFO[shift].label.toUpperCase()}
              </span>
              {mono(`${SHIFT_INFO[shift].start} — ${SHIFT_INFO[shift].end}`, 15, C.accentBright, 2)}
            </div>
            {/* run blocks */}
            {blocks.map((b, i) =>
              b.crew.length === 0 ? (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    border: `1px dashed ${C.dangerBorder}`,
                    backgroundColor: C.dangerBg,
                    borderRadius: 14,
                    padding: "14px 18px",
                    marginBottom: 12,
                    height: blockH(b),
                  }}
                >
                  {mono(runLabel(weekStart, b.start, b.end), 12, C.danger, 2)}
                  <span
                    style={{
                      fontFamily: "Barlow Condensed",
                      fontWeight: 600,
                      fontSize: 26,
                      letterSpacing: 2,
                      color: C.danger,
                      marginTop: 4,
                    }}
                  >
                    NO COVER
                  </span>
                </div>
              ) : (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    border: `1px solid ${C.border}`,
                    backgroundColor: tintOnDark(b.crew[0].color, 0.13),
                    borderRadius: 14,
                    padding: "14px 18px",
                    marginBottom: 12,
                    height: blockH(b),
                  }}
                >
                  {mono(runLabel(weekStart, b.start, b.end), 12, "#f0eee999", 2)}
                  <div style={{ display: "flex", flexDirection: "column", marginTop: 4 }}>
                    {b.crew.map((c, j) => (
                      <span
                        key={`${c.name}-${j}`}
                        style={{
                          fontFamily: "Barlow Condensed",
                          fontWeight: 600,
                          fontSize: 34,
                          lineHeight: 1.2,
                          letterSpacing: 1.5,
                          color: readableOnDark(c.color),
                        }}
                      >
                        {c.name.toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>
              ),
            )}
          </div>
        ))}
      </div>
      {/* roster */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          borderTop: `1px solid ${C.border}`,
          marginTop: 14,
          paddingTop: 22,
        }}
      >
        {mono("ROSTER · TOTAL SHIFTS", 13, C.faint, 6)}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
          {data.roster.map((r) => (
            <div
              key={r.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                backgroundColor: C.raised,
                border: `1px solid ${C.border}`,
                borderRadius: 999,
                padding: "9px 18px",
              }}
            >
              <div
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: 999,
                  backgroundColor: readableOnDark(r.color),
                  display: "flex",
                }}
              />
              <span style={{ fontFamily: "Hanken Grotesk", fontWeight: 700, fontSize: 16 }}>
                {r.name}
              </span>
              <span style={{ fontFamily: "Fragment Mono", fontSize: 12, color: C.faint }}>
                ×{r.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
  return { element, height };
}

/* ── Variant: grid — the original serif poster design ────────────────────── */

// Palette of the reference poster: near-black violet, cream/gold serif accents.
const S = {
  bg: "#0d0a12",
  panel: "#14111c",
  panelBorder: "#262033",
  cardBorder: "#221b30",
  text: "#ece7f4",
  dim: "#8d86a0",
  faint: "#5f5872",
  cream: "#e9d8a6",
};

function label(text: string, size: number, color: string, spacing: number): React.ReactElement {
  return (
    <span
      style={{
        fontFamily: "Hanken Grotesk",
        fontWeight: 400,
        fontSize: size,
        color,
        letterSpacing: spacing,
      }}
    >
      {text.toUpperCase()}
    </span>
  );
}

function buildGrid(
  data: PosterData,
  weekStart: string,
): { element: React.ReactElement; height: number } {
  // The PNG mirrors the site's poster page 1:1 — same relative metrics as the
  // .poster CSS (max-width 900), scaled ×1.6 to render at 1440 wide.
  const CARD = "#110e17";
  const slotBg = (list: SlotChatter[]): React.CSSProperties => {
    if (list.length === 0) return { backgroundColor: CARD };
    const c1 = blendOnBg(list[0].color, 0.18, CARD);
    const c2 = blendOnBg(list[list.length - 1].color, 0.1, CARD);
    return { backgroundImage: `linear-gradient(120deg, ${c1} 0%, ${CARD} 55%, ${c2} 100%)` };
  };

  // Row height driven by the fullest slot in the row (site: min-height + grow).
  const rowH = (day: number): number => {
    const maxNames = Math.max(
      1,
      ...SHIFT_ORDER.map((s) => (data.slots.get(`${day}|${s}`) ?? []).length),
    );
    return Math.max(134, 44 + maxNames * 46 + (maxNames - 1) * 10 + 39);
  };

  const rowHeights = Array.from({ length: 7 }, (_, d) => rowH(d));
  const rosterRows = Math.ceil(data.roster.length / 6);
  const height =
    148 + // vertical padding (74 × 2)
    30 + // top row
    86 + // gap under top row
    28 + // kicker
    170 + // title row
    70 + // gap under title
    66 + // column headers
    rowHeights.reduce((a, b) => a + b + 18, 0) +
    61 + 40 + 26 + 20 + rosterRows * 74; // roster block

  const element = (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: S.bg,
        color: S.text,
        padding: "74px 80px",
        fontFamily: "Hanken Grotesk",
      }}
    >
      {/* top row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 86,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{ width: 13, height: 13, borderRadius: 999, backgroundColor: S.cream, display: "flex" }}
          />
          <span
            style={{
              fontFamily: "Hanken Grotesk",
              fontWeight: 700,
              fontSize: 19,
              color: S.cream,
              letterSpacing: 7,
            }}
          >
            AURA
          </span>
        </div>
        {label(`INTERNAL · WEEK ${isoWeekNumber(weekStart)} / ${weekStart.slice(0, 4)}`, 16, S.faint, 4.5)}
      </div>

      {/* kicker + title */}
      <div style={{ display: "flex" }}>
        {label("WEEKLY CHATTER SCHEDULE FOR", 17.5, S.dim, 7.7)}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 70,
        }}
      >
        <span
          style={{
            fontFamily: "Playfair Display",
            fontStyle: "italic",
            fontWeight: 500,
            fontSize: 154,
            lineHeight: 1.05,
            color: S.cream,
          }}
        >
          {data.creatorName}
        </span>
        <div
          style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", paddingBottom: 26 }}
        >
          {label("IN EFFECT", 15, S.faint, 4.8)}
          <span
            style={{
              fontFamily: "Playfair Display",
              fontStyle: "italic",
              fontWeight: 500,
              fontSize: 38,
              color: S.text,
              marginTop: 8,
            }}
          >
            {formatWeekRange(weekStart)}
          </span>
        </div>
      </div>

      {/* column headers */}
      <div style={{ display: "flex", gap: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", width: 240 }} />
        {SHIFT_ORDER.map((s) => (
          <div
            key={s}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
          >
            {label(SHIFT_INFO[s].label, 16, S.dim, 4.8)}
            <span
              style={{
                fontFamily: "Fragment Mono",
                fontSize: 21,
                color: S.cream,
                letterSpacing: 2,
              }}
            >
              {SHIFT_INFO[s].start} — {SHIFT_INFO[s].end}
            </span>
          </div>
        ))}
      </div>

      {/* day rows */}
      {DAY_NAMES.map((dayName, day) => (
        <div
          key={dayName}
          style={{ display: "flex", gap: 18, marginBottom: 18, height: rowHeights[day] }}
        >
          <div
            style={{
              width: 240,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              backgroundColor: S.panel,
              border: `1px solid ${S.panelBorder}`,
              borderLeft: `5px solid ${S.cream}`,
              borderRadius: 21,
              padding: "24px 27px",
            }}
          >
            <span
              style={{
                fontFamily: "Playfair Display",
                fontWeight: 500,
                fontSize: 38,
                color: S.text,
              }}
            >
              {dayName}
            </span>
            <span style={{ fontFamily: "Fragment Mono", fontSize: 17, color: S.faint, marginTop: 6 }}>
              {formatDayDate(weekStart, day)}
            </span>
          </div>
          {SHIFT_ORDER.map((shift) => {
            const list = data.slots.get(`${day}|${shift}`) ?? [];
            return (
              <div
                key={shift}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  border: `1px solid ${S.cardBorder}`,
                  borderRadius: 21,
                  padding: "22px 27px",
                  ...slotBg(list),
                }}
              >
                {list.length === 0 ? (
                  <span style={{ color: S.faint, fontSize: 21 }}>—</span>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {list.map((c, i) => (
                      <span
                        key={`${c.name}-${i}`}
                        style={{
                          fontFamily: "Playfair Display",
                          fontWeight: 600,
                          fontSize: 37,
                          lineHeight: 1.25,
                          color: readableOnDark(c.color),
                          borderTop: i > 0 ? "1px solid #ffffff17" : "none",
                          paddingTop: i > 0 ? 5 : 0,
                          marginTop: i > 0 ? 5 : 0,
                        }}
                      >
                        {c.name}
                      </span>
                    ))}
                    <span
                      style={{
                        fontFamily: "Fragment Mono",
                        fontSize: 16,
                        letterSpacing: 2.5,
                        color: "#ece7f473",
                        marginTop: 11,
                      }}
                    >
                      {SHIFT_INFO[shift].short}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* roster */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          borderTop: `1px solid ${S.cardBorder}`,
          marginTop: 43,
          paddingTop: 40,
        }}
      >
        {label("ROSTER · TOTAL SHIFTS", 16, S.faint, 4.8)}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 24 }}>
          {data.roster.map((r) => (
            <div
              key={r.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                backgroundColor: S.panel,
                border: `1px solid ${S.panelBorder}`,
                borderRadius: 999,
                padding: "14px 26px",
              }}
            >
              <div
                style={{
                  width: 17,
                  height: 17,
                  borderRadius: 999,
                  backgroundColor: readableOnDark(r.color),
                  display: "flex",
                }}
              />
              <span style={{ fontFamily: "Hanken Grotesk", fontWeight: 700, fontSize: 22 }}>
                {r.name}
              </span>
              <span style={{ fontFamily: "Fragment Mono", fontSize: 18, color: S.faint }}>
                ×{r.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
  return { element, height: Math.round(height) };
}

/* ── Entry point ─────────────────────────────────────────────────────────── */

export async function renderPosterPng(
  creatorId: string,
  weekStart: string,
  variant: PosterVariant = "grid",
): Promise<{ png: Uint8Array; creatorName: string } | null> {
  const data = await loadData(creatorId, weekStart);
  if (!data) return null;

  const [barlow600, barlow700, hanken400, hanken700, fragment400, pf500, pf600, pf500i] =
    await Promise.all([
      font("BarlowCondensed-SemiBold.ttf"),
      font("BarlowCondensed-Bold.ttf"),
      font("HankenGrotesk-Regular.ttf"),
      font("HankenGrotesk-Bold.ttf"),
      font("FragmentMono-Regular.ttf"),
      font("PlayfairDisplay-Medium.ttf"),
      font("PlayfairDisplay-SemiBold.ttf"),
      font("PlayfairDisplay-MediumItalic.ttf"),
    ]);

  const { element, height } =
    variant === "timeline"
      ? buildTimeline(data, weekStart)
      : variant === "rails"
        ? buildRails(data, weekStart)
        : buildGrid(data, weekStart);

  const res = new ImageResponse(element, {
    width: W,
    height: Math.round(height),
    fonts: [
      { name: "Barlow Condensed", data: barlow600, weight: 600, style: "normal" },
      { name: "Barlow Condensed", data: barlow700, weight: 700, style: "normal" },
      { name: "Hanken Grotesk", data: hanken400, weight: 400, style: "normal" },
      { name: "Hanken Grotesk", data: hanken700, weight: 700, style: "normal" },
      { name: "Fragment Mono", data: fragment400, weight: 400, style: "normal" },
      { name: "Playfair Display", data: pf500, weight: 500, style: "normal" },
      { name: "Playfair Display", data: pf600, weight: 600, style: "normal" },
      { name: "Playfair Display", data: pf500i, weight: 500, style: "italic" },
    ],
  });

  const png = new Uint8Array(await res.arrayBuffer());
  return { png, creatorName: data.creatorName };
}
