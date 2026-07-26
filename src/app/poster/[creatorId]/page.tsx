import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  berlinNow,
  DAY_NAMES,
  formatDayDate,
  formatWeekRange,
  isoWeekNumber,
  isValidISODate,
  SHIFT_INFO,
  SHIFT_ORDER,
  weekStartOf,
  type ShiftKey,
} from "@/lib/time";
import { readableOnDark, tintOnDark } from "@/lib/colors";
import { posterName } from "@/lib/displayName";
import { PrintButton } from "@/components/client";
import { sendModelPoster } from "@/app/(app)/models/actions";

export const dynamic = "force-dynamic";

interface SlotChatter {
  name: string;
  color: string;
}

export default async function PosterPage({
  params,
  searchParams,
}: {
  params: Promise<{ creatorId: string }>;
  searchParams: Promise<{ week?: string; msg?: string; err?: string }>;
}) {
  const { creatorId } = await params;
  const { week, msg, err } = await searchParams;

  const creator = await prisma.creator.findUnique({ where: { id: creatorId } });
  if (!creator) notFound();

  const weekStart =
    week && isValidISODate(week) ? weekStartOf(week) : weekStartOf(berlinNow().date);

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
  const roster = [...totals.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const slotStyle = (list: SlotChatter[]): React.CSSProperties => {
    if (list.length === 0) return { background: "#110e17" };
    const c1 = tintOnDark(list[0].color, 0.18);
    const c2 = tintOnDark(list[list.length - 1].color, 0.1);
    return { background: `linear-gradient(120deg, ${c1} 0%, rgba(17,14,23,0.9) 55%, ${c2} 100%)` };
  };

  return (
    <div className="poster-page">
      <div className="poster-actions">
        <Link className="btn btn-sm" href={`/?week=${weekStart}`}>
          ← Back to schedule
        </Link>
        <div className="inline-form">
          {creator.webhookUrl ? (
            <form action={sendModelPoster}>
              <input type="hidden" name="id" value={creator.id} />
              <input type="hidden" name="week" value={weekStart} />
              <input type="hidden" name="back" value="poster" />
              <button className="btn btn-sm btn-primary" type="submit">
                Send to Discord
              </button>
            </form>
          ) : null}
          <PrintButton />
        </div>
      </div>
      {msg ? <div className="notice" style={{ width: "100%", maxWidth: 900 }}>{msg}</div> : null}
      {err ? <div className="notice err" style={{ width: "100%", maxWidth: 900 }}>{err}</div> : null}

      <div className="poster">
        <div className="poster-top">
          <span className="wordmark">
            <span className="wordmark-dot" /> AURA
          </span>
          <span className="poster-meta">
            Internal · Week {isoWeekNumber(weekStart)} / {weekStart.slice(0, 4)}
          </span>
        </div>

        <div className="poster-kicker">Weekly chatter schedule for</div>
        <div className="poster-title-row">
          <h1 className="poster-name">{creator.name}</h1>
          <div className="poster-effect">
            <div className="poster-effect-label">In effect</div>
            <div className="poster-effect-dates">{formatWeekRange(weekStart)}</div>
          </div>
        </div>

        <div className="poster-grid">
          <div />
          {SHIFT_ORDER.map((s) => (
            <div className="poster-colhead" key={s}>
              <span className="shift-name">{SHIFT_INFO[s].label}</span>
              <span className="shift-hours">
                {SHIFT_INFO[s].start} — {SHIFT_INFO[s].end}
              </span>
            </div>
          ))}

          {DAY_NAMES.map((dayName, day) => (
            <DayRow
              key={day}
              dayName={dayName}
              date={formatDayDate(weekStart, day)}
              slots={SHIFT_ORDER.map((s) => ({
                shift: s,
                chatters: slots.get(`${day}|${s}`) ?? [],
              }))}
              slotStyle={slotStyle}
            />
          ))}
        </div>

        <div className="poster-roster">
          <div className="poster-roster-label">Roster · Total shifts</div>
          <div className="poster-roster-chips">
            {roster.length === 0 ? (
              <span className="poster-slot-empty">Nothing scheduled this week yet.</span>
            ) : (
              roster.map((r) => (
                <span className="poster-chip" key={r.name}>
                  <span className="dot" style={{ background: readableOnDark(r.color), marginRight: 0 }} />
                  {r.name} <span className="count">×{r.count}</span>
                </span>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DayRow({
  dayName,
  date,
  slots,
  slotStyle,
}: {
  dayName: string;
  date: string;
  slots: { shift: ShiftKey; chatters: SlotChatter[] }[];
  slotStyle: (list: SlotChatter[]) => React.CSSProperties;
}) {
  return (
    <>
      <div className="poster-daycell">
        <div className="poster-dayname">{dayName}</div>
        <div className="poster-daydate">{date}</div>
      </div>
      {slots.map(({ shift, chatters }) => (
        <div className="poster-slot" key={shift} style={slotStyle(chatters)}>
          {chatters.length === 0 ? (
            <span className="poster-slot-empty">—</span>
          ) : (
            <>
              {chatters.map((c, i) => (
                <div
                  className="poster-slot-name"
                  key={`${c.name}-${i}`}
                  style={{ color: readableOnDark(c.color) }}
                >
                  {c.name}
                </div>
              ))}
              <div className="poster-slot-time">{SHIFT_INFO[shift].short}</div>
            </>
          )}
        </div>
      ))}
    </>
  );
}
