import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  addDaysISO,
  berlinNow,
  DAY_NAMES,
  formatWeekRange,
  isValidISODate,
  SHIFT_EMOJI,
  SHIFT_INFO,
  weekStartOf,
  type ShiftKey,
} from "@/lib/time";
import { readableOnDark, tintOnDark } from "@/lib/colors";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const params = await searchParams;
  const thisWeek = weekStartOf(berlinNow().date);
  const weekStart =
    params.week && isValidISODate(params.week) ? weekStartOf(params.week) : thisWeek;

  const assignments = await prisma.assignment.findMany({
    where: { weekStart },
    include: { chatter: true },
  });

  // A "shift" = one distinct (day, time-block) per chatter; covering several
  // creators in the same block counts once — same rule as the old sheet.
  interface Row {
    name: string;
    color: string;
    blocks: Map<string, ShiftKey>; // "day|shift" → shift
    creators: Set<string>;
  }
  const byChatter = new Map<string, Row>();
  for (const a of assignments) {
    let row = byChatter.get(a.chatterId);
    if (!row) {
      row = { name: a.chatter.name, color: a.chatter.color, blocks: new Map(), creators: new Set() };
      byChatter.set(a.chatterId, row);
    }
    row.blocks.set(`${a.day}|${a.shift}`, a.shift);
    row.creators.add(a.creatorId);
  }

  const rows = [...byChatter.values()]
    .map((r) => {
      const counts = { MORNING: 0, AFTERNOON: 0, NIGHT: 0 } as Record<ShiftKey, number>;
      const perDay = Array.from({ length: 7 }, () => new Set<ShiftKey>());
      for (const [key, shift] of r.blocks) {
        counts[shift] += 1;
        perDay[Number(key.split("|")[0])].add(shift);
      }
      const shifts = r.blocks.size;
      return { ...r, counts, perDay, shifts, hours: shifts * 8, creatorCount: r.creators.size };
    })
    .sort((a, b) => b.shifts - a.shifts || a.name.localeCompare(b.name));

  const conflicts = rows.flatMap((r) =>
    r.perDay
      .map((set, day) => ({ day, set }))
      .filter(({ set }) => set.size >= 2)
      .map(({ day, set }) => ({
        name: r.name,
        color: r.color,
        day,
        blocks: [...set].map((s) => `${SHIFT_EMOJI[s]} ${SHIFT_INFO[s].label}`).join(" + "),
      })),
  );

  const totalSlots = assignments.length;
  const totalShifts = rows.reduce((n, r) => n + r.shifts, 0);
  const creatorsCovered = new Set(assignments.map((a) => a.creatorId)).size;
  const maxShifts = Math.max(1, ...rows.map((r) => r.shifts));
  const prevWeek = addDaysISO(weekStart, -7);
  const nextWeek = addDaysISO(weekStart, 7);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">
            Workload at a glance. A shift is one 8h block — several creators in the same block
            count once. Hours = shifts × 8. Day columns show which block someone covers
            (⛅ / ☀️ / 🌙); two emojis in red = booked twice that day.
          </p>
        </div>
        <div className="week-nav">
          <Link className="btn btn-sm" href={`/dashboard?week=${prevWeek}`}>
            ← Prev
          </Link>
          <span className="week-label">{formatWeekRange(weekStart)}</span>
          <Link className="btn btn-sm" href={`/dashboard?week=${nextWeek}`}>
            Next →
          </Link>
          {weekStart !== thisWeek ? (
            <Link className="btn btn-sm" href="/dashboard">
              This week
            </Link>
          ) : null}
        </div>
      </div>

      {/* The week in four numbers. */}
      <div className="stat-tiles">
        <div className="stat-tile">
          <div className="stat-value">{rows.length}</div>
          <div className="stat-label">chatters scheduled</div>
        </div>
        <div className="stat-tile">
          <div className="stat-value">{creatorsCovered}</div>
          <div className="stat-label">creators covered</div>
        </div>
        <div className="stat-tile">
          <div className="stat-value">{totalShifts}</div>
          <div className="stat-label">shifts · {totalSlots} filled slots</div>
        </div>
        <div className={`stat-tile ${conflicts.length ? "warn" : "ok"}`}>
          <div className="stat-value">{conflicts.length ? conflicts.length : "✓"}</div>
          <div className="stat-label">
            {conflicts.length
              ? `same-day double booking${conflicts.length === 1 ? "" : "s"}`
              : "no same-day double bookings"}
          </div>
        </div>
      </div>

      {/* Conflicts only earn a card when they exist. */}
      {conflicts.length > 0 ? (
        <div className="card">
          <div className="card-title" style={{ color: "var(--danger)" }}>
            Conflicts · {conflicts.length} same-day double booking{conflicts.length === 1 ? "" : "s"}
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Chatter</th>
                  <th>Day</th>
                  <th>Blocks</th>
                </tr>
              </thead>
              <tbody>
                {conflicts.map((c, i) => (
                  <tr key={i}>
                    <td>
                      <span className="dot" style={{ background: readableOnDark(c.color) }} />
                      {c.name}
                    </td>
                    <td>{DAY_NAMES[c.day]}</td>
                    <td style={{ color: "var(--danger)" }}>{c.blocks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="card">
        <div className="card-title">Workload by chatter</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Chatter</th>
                <th style={{ minWidth: 110 }}>Load</th>
                <th>Shifts</th>
                <th>Hours</th>
                <th>Creators</th>
                <th title={`${SHIFT_INFO.MORNING.start}–${SHIFT_INFO.MORNING.end}`}>{SHIFT_EMOJI.MORNING}</th>
                <th title={`${SHIFT_INFO.AFTERNOON.start}–${SHIFT_INFO.AFTERNOON.end}`}>{SHIFT_EMOJI.AFTERNOON}</th>
                <th title={`${SHIFT_INFO.NIGHT.start}–${SHIFT_INFO.NIGHT.end}`}>{SHIFT_EMOJI.NIGHT}</th>
                {DAY_NAMES.map((d) => (
                  <th key={d}>{d.slice(0, 3)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <span className="dot" style={{ background: readableOnDark(r.color) }} />
                    {r.name}
                  </td>
                  <td>
                    <div className="load-bar" title={`${r.shifts} of ${maxShifts} (busiest)`}>
                      <span
                        style={{
                          width: `${Math.round((r.shifts / maxShifts) * 100)}%`,
                          background: tintOnDark(r.color, 0.85),
                        }}
                      />
                    </div>
                  </td>
                  <td>
                    <strong>{r.shifts}</strong>
                  </td>
                  <td className="muted">{r.hours}</td>
                  <td className="muted">{r.creatorCount}</td>
                  <td>{r.counts.MORNING || <span className="faint">·</span>}</td>
                  <td>{r.counts.AFTERNOON || <span className="faint">·</span>}</td>
                  <td>{r.counts.NIGHT || <span className="faint">·</span>}</td>
                  {r.perDay.map((set, d) => (
                    <td
                      key={d}
                      style={set.size >= 2 ? { color: "var(--danger)" } : undefined}
                      title={
                        set.size
                          ? [...set].map((sh) => SHIFT_INFO[sh].label).join(" + ") +
                            (set.size >= 2 ? " — double-booked" : "")
                          : "off"
                      }
                    >
                      {set.size ? (
                        ["MORNING", "AFTERNOON", "NIGHT"]
                          .filter((sh) => set.has(sh as ShiftKey))
                          .map((sh) => SHIFT_EMOJI[sh as ShiftKey])
                          .join("")
                      ) : (
                        <span className="faint">·</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={15} className="muted">
                    Nothing scheduled this week.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
