import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { readableOnDark, tintOnDark } from "@/lib/colors";
import { ConfirmButton } from "@/components/client";
import {
  addDaysISO,
  berlinNow,
  dayIndexOf,
  DAY_NAMES,
  formatDayShort,
  formatWeekRange,
  isValidISODate,
  SHIFT_EMOJI,
  SHIFT_INFO,
  SHIFT_ORDER,
  weekStartOf,
} from "@/lib/time";
import { addChatter, deleteChatter, saveChatters, toggleChatterActive } from "./actions";

export const dynamic = "force-dynamic";

const ROSTER_FORM = "roster-form";

export default async function ChattersPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string; week?: string }>;
}) {
  const { msg, err, ...params } = await searchParams;
  const today = berlinNow();
  const thisWeek = weekStartOf(today.date);
  const weekStart =
    params.week && isValidISODate(params.week) ? weekStartOf(params.week) : thisWeek;
  const todayIdx = weekStart === thisWeek ? dayIndexOf(today.date) : -1;

  const [chatters, weekAssignments] = await Promise.all([
    prisma.chatter.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    prisma.assignment.findMany({
      where: { weekStart },
      include: { creator: true },
      orderBy: { id: "asc" },
    }),
  ]);

  // Shifts = distinct 8h blocks (week + day + shift). Covering several models
  // in the same block counts once — same rule as the Dashboard.
  const shiftCounts = await prisma.$queryRaw<{ chatterId: string; shifts: bigint }[]>`
    SELECT "chatterId", COUNT(DISTINCT ("weekStart", "day", "shift")) AS shifts
    FROM "Assignment"
    GROUP BY "chatterId"
  `;
  const shiftsByChatter = new Map(shiftCounts.map((r) => [r.chatterId, Number(r.shifts)]));

  // The Schedule page flipped: same weekly grid, but one block PER CHATTER with
  // the creators they cover in each slot — "how many creators are stacked on
  // each person". Read-only; planning stays on the Schedule page.
  const cellsByChatter = new Map<string, Map<string, { id: string; name: string }[]>>();
  const weekCreatorsByChatter = new Map<string, Set<string>>();
  const weekShiftsByChatter = new Map<string, Set<string>>();
  for (const a of weekAssignments) {
    const cells = cellsByChatter.get(a.chatterId) ?? new Map();
    const key = `${a.day}|${a.shift}`;
    const list = cells.get(key) ?? [];
    list.push({ id: a.id, name: a.creator.name });
    cells.set(key, list);
    cellsByChatter.set(a.chatterId, cells);
    (weekCreatorsByChatter.get(a.chatterId) ?? weekCreatorsByChatter.set(a.chatterId, new Set()).get(a.chatterId))!.add(
      a.creatorId,
    );
    (weekShiftsByChatter.get(a.chatterId) ?? weekShiftsByChatter.set(a.chatterId, new Set()).get(a.chatterId))!.add(key);
  }
  const scheduledChatters = chatters.filter((c) => cellsByChatter.has(c.id));
  const idleChatters = chatters.filter((c) => c.active && !cellsByChatter.has(c.id));
  const prevWeek = addDaysISO(weekStart, -7);
  const nextWeek = addDaysISO(weekStart, 7);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Chatters</h1>
          <p className="page-sub">
            Three names per person: the real name, the POSTER name (always what the weekly posters
            print), and the Infloww name (used on the schedule grid and the Discord &quot;ON
            SHIFT&quot; pings). LX marks LX-agency people.
          </p>
        </div>
        <div className="week-nav">
          <Link className="btn btn-sm" href={`/chatters?week=${prevWeek}`}>
            ← Prev
          </Link>
          <span className="week-label">{formatWeekRange(weekStart)}</span>
          <Link className="btn btn-sm" href={`/chatters?week=${nextWeek}`}>
            Next →
          </Link>
          {weekStart !== thisWeek ? (
            <Link className="btn btn-sm" href="/chatters">
              This week
            </Link>
          ) : null}
        </div>
      </div>

      {msg ? <div className="notice">{msg}</div> : null}
      {err ? <div className="notice err">{err}</div> : null}

      {/* Per-chatter weekly view — the creator grid flipped around. */}
      {scheduledChatters.map((chatter) => {
        const cells = cellsByChatter.get(chatter.id)!;
        const creatorCount = weekCreatorsByChatter.get(chatter.id)?.size ?? 0;
        const shiftCount = weekShiftsByChatter.get(chatter.id)?.size ?? 0;
        return (
          <section className="model-card" key={chatter.id}>
            <div className="model-card-head">
              <h2 className="model-name" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  aria-hidden
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: chatter.color,
                    flexShrink: 0,
                  }}
                />
                {chatter.name}
              </h2>
              <span className="muted">
                {shiftCount} shift{shiftCount === 1 ? "" : "s"} · {creatorCount} creator
                {creatorCount === 1 ? "" : "s"} this week
              </span>
            </div>
            <div className="table-wrap">
              <table className="grid-table">
                <thead>
                  <tr>
                    <th />
                    {DAY_NAMES.map((_, d) => (
                      <th key={d} className={d === todayIdx ? "today" : ""}>
                        {formatDayShort(weekStart, d)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SHIFT_ORDER.map((shift) => (
                    <tr key={shift}>
                      <td className="shift-label">
                        {SHIFT_EMOJI[shift]} {SHIFT_INFO[shift].label}
                        <span className="shift-time">
                          {SHIFT_INFO[shift].start}–{SHIFT_INFO[shift].end}
                        </span>
                      </td>
                      {Array.from({ length: 7 }).map((_, day) => {
                        const list = cells.get(`${day}|${shift}`) ?? [];
                        return (
                          <td key={day} className={day === todayIdx ? "today" : ""}>
                            <div className="cell-chips">
                              {list.map((x) => (
                                <span
                                  className="chip"
                                  key={x.id}
                                  style={{
                                    background: tintOnDark(chatter.color, 0.22),
                                    color: readableOnDark(chatter.color, 0.72),
                                  }}
                                >
                                  {x.name}
                                </span>
                              ))}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
      {idleChatters.length > 0 ? (
        <p className="page-sub" style={{ marginBottom: 16 }}>
          No shifts this week: {idleChatters.map((c) => c.name).join(", ")}.
        </p>
      ) : null}

      <div className="card">
        <details className="add-collapse">
          <summary>＋ Add chatter</summary>
          <form action={addChatter} className="add-grid">
          <input className="input" name="fullName" placeholder="Real name (e.g. Alex Smith)" />
          <input className="input" name="posterName" placeholder="Poster name (e.g. Alex)" />
          <input className="input" name="name" placeholder="Infloww name (e.g. Alex)" required />
          <input className="input" name="discordUsername" placeholder="Discord username (readable)" />
          <input
            className="input"
            name="discordId"
            inputMode="numeric"
            placeholder="Discord numeric ID (this is what pings)"
            title="Right-click the user in Discord → Copy User ID"
          />
          <input className="input input-color" type="color" name="color" defaultValue="#8b7cff" />
          <label className="lx-check" title="LX-agency person">
            <input type="checkbox" name="isLX" /> LX
          </label>
          <button className="btn btn-primary" type="submit">
            Add chatter
          </button>
          </form>
          <p className="page-sub" style={{ marginTop: 10 }}>
            Leave the poster name empty to reuse the Infloww name.
          </p>
        </details>
      </div>

      <div className="card">
        {/* One form holds every row; row Save buttons submit just their row. */}
        <form id={ROSTER_FORM} action={saveChatters} />
        <div className="card-title-row">
          <div className="card-title" style={{ marginBottom: 0 }}>
            Roster · {chatters.length} people
          </div>
          <button className="btn btn-sm btn-primary" form={ROSTER_FORM} type="submit">
            Save all changes
          </button>
        </div>
        <div className="table-wrap">
          <table className="table table-fields">
            <colgroup>
              <col style={{ width: "16%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 70 }} />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th>Real name</th>
                <th>Poster name</th>
                <th>Infloww name</th>
                <th>Discord</th>
                <th title="Numeric user ID — this is what actually pings in alerts (right-click the user in Discord → Copy User ID)">
                  Discord ID
                </th>
                <th>Color · LX</th>
                <th>Shifts</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {chatters.map((c) => (
                <tr key={c.id} style={c.active ? undefined : { opacity: 0.45 }}>
                  <td>
                    <input type="hidden" form={ROSTER_FORM} name="rowId" value={c.id} />
                    <input
                      className="input"
                      form={ROSTER_FORM}
                      name={`fullName__${c.id}`}
                      defaultValue={c.fullName}
                      placeholder="Real name"
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      form={ROSTER_FORM}
                      name={`posterName__${c.id}`}
                      defaultValue={c.posterName}
                      placeholder="Poster name"
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      form={ROSTER_FORM}
                      name={`name__${c.id}`}
                      defaultValue={c.name}
                      required
                      title="Infloww name — used on the schedule and pings"
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      form={ROSTER_FORM}
                      name={`discordUsername__${c.id}`}
                      defaultValue={c.discordUsername}
                      placeholder="discord ID or username"
                      title="Paste the numeric Discord user ID for a clickable mention in pings; a plain username shows as text"
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      form={ROSTER_FORM}
                      name={`discordId__${c.id}`}
                      defaultValue={c.discordId}
                      inputMode="numeric"
                      placeholder="numeric ID"
                      title="This is what actually pings — right-click the user in Discord → Copy User ID"
                    />
                  </td>
                  <td>
                    <div className="inline-form" style={{ flexWrap: "nowrap" }}>
                      <input
                        className="input input-color"
                        form={ROSTER_FORM}
                        type="color"
                        name={`color__${c.id}`}
                        defaultValue={normalizeHex(c.color)}
                        title={c.color}
                      />
                      <label className="lx-check" title="LX-agency person">
                        <input
                          form={ROSTER_FORM}
                          type="checkbox"
                          name={`isLX__${c.id}`}
                          defaultChecked={c.isLX}
                        />{" "}
                        LX
                      </label>
                    </div>
                  </td>
                  <td className="muted">
                    <span className="dot" style={{ background: readableOnDark(c.color) }} />
                    {shiftsByChatter.get(c.id) ?? 0}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="btn btn-sm"
                        form={ROSTER_FORM}
                        type="submit"
                        name="only"
                        value={c.id}
                      >
                        Save
                      </button>
                      <form action={toggleChatterActive}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className="btn btn-sm btn-ghost" type="submit">
                          {c.active ? "Deactivate" : "Reactivate"}
                        </button>
                      </form>
                      <form action={deleteChatter}>
                        <input type="hidden" name="id" value={c.id} />
                        <ConfirmButton
                          className="btn btn-sm btn-ghost btn-danger"
                          message={`Delete ${c.name}? If they have scheduled shifts they will be deactivated instead.`}
                        >
                          Delete
                        </ConfirmButton>
                      </form>
                      {!c.active ? <span className="badge-off">INACTIVE</span> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <button className="btn btn-primary" form={ROSTER_FORM} type="submit">
            Save all changes
          </button>
        </div>
      </div>
    </>
  );
}

function normalizeHex(hex: string): string {
  return /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#8b7cff";
}
