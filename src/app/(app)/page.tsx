import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  addDaysISO,
  berlinNow,
  dayIndexOf,
  DAY_NAMES,
  formatWeekRange,
  formatDayShort,
  isValidISODate,
  SHIFT_EMOJI,
  SHIFT_INFO,
  SHIFT_ORDER,
  weekStartOf,
} from "@/lib/time";
import { readableOnDark, tintOnDark } from "@/lib/colors";
import { AutoSubmitSelect, ConfirmButton } from "@/components/client";
import { CreatorAvatar } from "@/components/CreatorAvatar";
import { avatarSources, creatorAccountsMap } from "@/lib/opstrack";
import { parseWeekClipboard, WEEK_CLIPBOARD_COOKIE } from "@/lib/weekClipboard";
import {
  addAssignment,
  clearWeekForCreator,
  copyWeek,
  copyWeekForCreator,
  pasteWeekForCreator,
  removeAssignment,
} from "./actions";
import { sendAllPosters, sendModelPoster } from "./models/actions";

export const dynamic = "force-dynamic";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; msg?: string; err?: string }>;
}) {
  const params = await searchParams;
  const today = berlinNow();
  const thisWeek = weekStartOf(today.date);
  const weekStart =
    params.week && isValidISODate(params.week) ? weekStartOf(params.week) : thisWeek;
  const todayIdx = weekStart === thisWeek ? dayIndexOf(today.date) : -1;

  const [creators, chatters, assignments, opstrack] = await Promise.all([
    prisma.creator.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.chatter.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.assignment.findMany({
      where: { weekStart },
      include: { chatter: true },
      orderBy: { id: "asc" },
    }),
    // Avatars ride in from OpsTrack (mapped OnlyFansAPI accounts); {} when unmapped/offline.
    creatorAccountsMap(),
  ]);
  const avatarMap = opstrack.map;

  const clipboard = parseWeekClipboard((await cookies()).get(WEEK_CLIPBOARD_COOKIE)?.value);
  const clipboardCreator = clipboard
    ? (creators.find((c) => c.id === clipboard.creatorId) ??
      (await prisma.creator.findUnique({ where: { id: clipboard.creatorId } })))
    : null;

  const cellMap = new Map<string, { id: string; chatterId: string; name: string; color: string }[]>();
  for (const a of assignments) {
    const key = `${a.creatorId}|${a.day}|${a.shift}`;
    const list = cellMap.get(key) ?? [];
    list.push({ id: a.id, chatterId: a.chatterId, name: a.chatter.name, color: a.chatter.color });
    cellMap.set(key, list);
  }

  const chatterOptions = chatters.map((c) => ({ value: c.id, label: c.name }));
  const prevWeek = addDaysISO(weekStart, -7);
  const nextWeek = addDaysISO(weekStart, 7);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Weekly Schedule</h1>
          <p className="page-sub">
            One slot = one 8h block. Add several chatters to a slot for shared coverage. Discord is
            pinged automatically at 04:00, 12:00 and 20:00 (Europe/Berlin).
          </p>
        </div>
        <div className="week-nav">
          <Link className="btn btn-sm" href={`/?week=${prevWeek}`}>
            ← Prev
          </Link>
          <span className="week-label">{formatWeekRange(weekStart)}</span>
          <Link className="btn btn-sm" href={`/?week=${nextWeek}`}>
            Next →
          </Link>
          {weekStart !== thisWeek ? (
            <Link className="btn btn-sm" href="/">
              This week
            </Link>
          ) : null}
        </div>
      </div>

      {params.msg ? <div className="notice">{params.msg}</div> : null}
      {params.err ? <div className="notice err">{params.err}</div> : null}

      <div className="toolbar">
        <form action={sendAllPosters} className="inline-form">
          <input type="hidden" name="week" value={weekStart} />
          <button className="btn btn-sm btn-primary" type="submit">
            Send posters to Discord
          </button>
        </form>
        <form action={copyWeek} className="inline-form">
          <input type="hidden" name="fromWeek" value={prevWeek} />
          <input type="hidden" name="toWeek" value={weekStart} />
          <button className="btn btn-sm" type="submit">
            Copy previous week into this one
          </button>
        </form>
      </div>

      {creators.length === 0 ? (
        <div className="card">
          <p className="muted">No creators yet — add them on the Creators page.</p>
        </div>
      ) : null}

      {creators.map((creator) => {
        const hasAny = SHIFT_ORDER.some((s) =>
          Array.from({ length: 7 }).some((_, d) => cellMap.has(`${creator.id}|${d}|${s}`)),
        );
        return (
          <section className="model-card" key={creator.id}>
            <div className="model-card-head">
              <h2 className="model-name" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <CreatorAvatar sources={avatarSources(avatarMap, creator.id)} name={creator.name} size={32} />
                {creator.name}
              </h2>
              <div className="inline-form">
                <Link className="btn btn-sm" href={`/poster/${creator.id}?week=${weekStart}`}>
                  Poster view
                </Link>
                {creator.webhookUrl ? (
                  <form action={sendModelPoster}>
                    <input type="hidden" name="id" value={creator.id} />
                    <input type="hidden" name="week" value={weekStart} />
                    <input type="hidden" name="back" value="schedule" />
                    <button className="btn btn-sm" type="submit">
                      Send to Discord
                    </button>
                  </form>
                ) : null}
                {hasAny ? (
                  <form action={copyWeekForCreator}>
                    <input type="hidden" name="weekStart" value={weekStart} />
                    <input type="hidden" name="creatorId" value={creator.id} />
                    <button
                      className="btn btn-sm"
                      type="submit"
                      title={`Copy ${creator.name}'s week to paste onto another creator`}
                    >
                      Copy week
                    </button>
                  </form>
                ) : null}
                {clipboard &&
                clipboardCreator &&
                !(clipboard.creatorId === creator.id && clipboard.weekStart === weekStart) ? (
                  <form action={pasteWeekForCreator}>
                    <input type="hidden" name="weekStart" value={weekStart} />
                    <input type="hidden" name="creatorId" value={creator.id} />
                    <button
                      className="btn btn-sm"
                      type="submit"
                      title={`Paste ${clipboardCreator.name}'s week (${formatWeekRange(clipboard.weekStart)}) onto ${creator.name}`}
                    >
                      Paste {clipboardCreator.name}&rsquo;s week
                    </button>
                  </form>
                ) : null}
                {hasAny ? (
                  <form action={clearWeekForCreator}>
                    <input type="hidden" name="weekStart" value={weekStart} />
                    <input type="hidden" name="creatorId" value={creator.id} />
                    <ConfirmButton
                      className="btn btn-sm btn-ghost"
                      message={`Clear ${creator.name}'s entire week?`}
                    >
                      Clear week
                    </ConfirmButton>
                  </form>
                ) : null}
              </div>
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
                        const list = cellMap.get(`${creator.id}|${day}|${shift}`) ?? [];
                        const available = chatterOptions.filter(
                          (o) => !list.some((x) => x.chatterId === o.value),
                        );
                        return (
                          <td key={day} className={day === todayIdx ? "today" : ""}>
                            {/* Chips and the add control share ONE wrapping row —
                                several chatters sit next to each other, and the
                                add pill stays small at the end. */}
                            <div className="cell-row">
                              {list.map((x) => (
                                <form action={removeAssignment} key={x.id}>
                                  <input type="hidden" name="id" value={x.id} />
                                  <button
                                    className="chip"
                                    type="submit"
                                    title={`Remove ${x.name}`}
                                    style={{
                                      background: tintOnDark(x.color, 0.22),
                                      color: readableOnDark(x.color, 0.72),
                                    }}
                                  >
                                    {x.name}
                                    <span className="chip-x">×</span>
                                  </button>
                                </form>
                              ))}
                              {available.length > 0 ? (
                                <form action={addAssignment} className="cell-add">
                                  <input type="hidden" name="weekStart" value={weekStart} />
                                  <input type="hidden" name="day" value={day} />
                                  <input type="hidden" name="shift" value={shift} />
                                  <input type="hidden" name="creatorId" value={creator.id} />
                                  <AutoSubmitSelect name="chatterId" placeholder="＋" options={available} />
                                </form>
                              ) : null}
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
    </>
  );
}
