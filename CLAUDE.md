# AURA Scheduler — project instructions

The weekly chatter schedule for AURA: plan who covers which creator on which shift,
with automatic Discord "ON SHIFT" pings and a stylized weekly poster per creator.
Ported (with permission) from the `halevora-scheduler` codebase and rebranded for AURA.

Stack: Next.js (App Router) + TypeScript, Prisma over PostgreSQL. Built-in scheduler
(no external cron needed). All times Europe/Berlin.

## OpsTrack (AURA monitoring) integration — load-bearing
- `SCHEDULER_SYNC_TOKEN` must be the **same value** on this app and on the AURA
  monitoring service (`maurits`). It gates `GET /api/models`, `GET /api/sso`, and the
  roster push. Unset = the link is disabled and the Scheduler tab in AURA stays empty.
- `OPSTRACK_URL` points at the monitoring app (default `https://opstrack.auramngt.com`).
- `src/lib/rosterPush.ts` pushes the on-shift roster to `POST /api/reminders/scheduler-roster`
  on the monitoring app every minute; that is what makes the Scheduler tab + shift-based
  reminders work over there.

## Notes
- The seed roster is placeholder only — real staff/creator data is entered in the app.
- Keep `prisma/schema.prisma` and migrations in sync (`npm run db:migrate`).
