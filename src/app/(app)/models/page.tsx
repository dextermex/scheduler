import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { maskWebhook } from "@/lib/discord";
import { berlinNow, weekStartOf } from "@/lib/time";
import { ConfirmButton } from "@/components/client";
import { CreatorAvatar } from "@/components/CreatorAvatar";
import { avatarSources, creatorAccountsMap, linkedLabel } from "@/lib/opstrack";
import { addModel, deleteModel, sendModelPoster, toggleModelActive, updateModel } from "./actions";

export const dynamic = "force-dynamic";

export default async function ModelsPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const { msg, err } = await searchParams;
  const thisWeek = weekStartOf(berlinNow().date);
  // Profile pictures + linked pages come from OpsTrack: whichever OnlyFansAPI
  // accounts were assigned to each creator there (Tasks → Live status).
  const [creators, opstrack] = await Promise.all([
    prisma.creator.findMany({
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { assignments: true } } },
    }),
    creatorAccountsMap(),
  ]);
  const avatarMap = opstrack.map;
  const linkedCount = Object.keys(avatarMap).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Creators</h1>
          <p className="page-sub">
            Each creator gets her own schedule block, her own poster, and her own Discord channel:
            paste the channel&apos;s webhook here and &quot;Send schedule&quot; posts this
            week&apos;s poster image straight into it.
          </p>
          {/* OpsTrack link status — say WHY pictures/pages are (not) showing. */}
          {opstrack.error ? (
            <p className="page-sub" style={{ color: "#f0a35e" }}>
              OpsTrack link unavailable ({opstrack.error}) — profile pictures and linked pages
              can&apos;t load right now.
            </p>
          ) : linkedCount === 0 ? (
            <p className="page-sub">
              No pages linked yet — assign OnlyFansAPI accounts to creators in OpsTrack
              (Tasks → Live status → &quot;Scheduler creator&quot;) and their profile pictures
              appear here within a minute.
            </p>
          ) : null}
        </div>
      </div>

      {msg ? <div className="notice">{msg}</div> : null}
      {err ? <div className="notice err">{err}</div> : null}

      <div className="card">
        {/* Collapsed until clicked — the roster is the main content here. */}
        <details className="add-collapse">
          <summary>＋ Add creator</summary>
          <form action={addModel} className="inline-form">
            <input className="input" name="name" placeholder="Creator name (e.g. Lillie)" required />
            <button className="btn btn-primary" type="submit">
              Add creator
            </button>
          </form>
        </details>
      </div>

      <div className="card">
        <div className="card-title">All creators · {creators.length}</div>
        <div className="table-wrap">
          <table className="table table-fields">
            <colgroup>
              <col style={{ width: 44 }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: 80 }} />
              <col style={{ width: "26%" }} />
              <col style={{ width: 70 }} />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th />
                <th>Name</th>
                <th title="OnlyFansAPI accounts assigned to this creator in OpsTrack">Linked pages</th>
                <th>Order</th>
                <th>Discord webhook</th>
                <th>Slots</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {creators.map((c) => {
                const fid = `model-${c.id}`;
                return (
                  <tr key={c.id} style={c.active ? undefined : { opacity: 0.45 }}>
                    <td>
                      <CreatorAvatar sources={avatarSources(avatarMap, c.id)} name={c.name} size={30} />
                    </td>
                    <td>
                      <input className="input" form={fid} name="name" defaultValue={c.name} required />
                    </td>
                    <td className="muted" title="Assigned in OpsTrack → Tasks → Live status">
                      {linkedLabel(avatarMap, c.id) || "—"}
                    </td>
                    <td>
                      <input
                        className="input"
                        form={fid}
                        type="number"
                        name="sortOrder"
                        defaultValue={c.sortOrder}
                        title="Order on the schedule"
                      />
                    </td>
                    <td>
                      <input
                        className="input"
                        form={fid}
                        name="webhookUrl"
                        defaultValue={maskWebhook(c.webhookUrl)}
                        placeholder="Discord webhook for this creator's channel"
                      />
                    </td>
                    <td className="muted">{c._count.assignments}</td>
                    <td>
                      <div className="row-actions">
                        <form id={fid} action={updateModel}>
                          <input type="hidden" name="id" value={c.id} />
                          <button className="btn btn-sm" type="submit">
                            Save
                          </button>
                        </form>
                        {c.webhookUrl ? (
                          <form action={sendModelPoster}>
                            <input type="hidden" name="id" value={c.id} />
                            <input type="hidden" name="week" value={thisWeek} />
                            <button className="btn btn-sm btn-primary" type="submit">
                              Send schedule
                            </button>
                          </form>
                        ) : (
                          <span className="badge-off" title="Paste the webhook and save first">
                            NO WEBHOOK
                          </span>
                        )}
                        <Link className="btn btn-sm" href={`/poster/${c.id}?week=${thisWeek}`}>
                          Poster
                        </Link>
                        <form action={toggleModelActive}>
                          <input type="hidden" name="id" value={c.id} />
                          <button className="btn btn-sm btn-ghost" type="submit">
                            {c.active ? "Deactivate" : "Reactivate"}
                          </button>
                        </form>
                        <form action={deleteModel}>
                          <input type="hidden" name="id" value={c.id} />
                          <ConfirmButton
                            className="btn btn-sm btn-ghost btn-danger"
                            message={`Delete ${c.name} permanently? This also removes ALL her scheduled shifts, this week and past ones. This cannot be undone.`}
                          >
                            Delete
                          </ConfirmButton>
                        </form>
                        {!c.active ? <span className="badge-off">INACTIVE</span> : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
