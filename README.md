# AURA Scheduler

The weekly chatter schedule for AURA, off the spreadsheet. One place to plan who covers
which creator on which shift, with automatic Discord pings at every shift start and a
stylized weekly poster per creator. Ported with permission from `halevora-scheduler` and
rebranded for AURA; the original agency's real roster was not carried over (placeholder
seed only).

## What it does
- **Weekly schedule** — a grid per creator: Morning (04:00–12:00), Afternoon (12:00–20:00),
  Night (20:00–04:00) × seven days. Multiple chatters per slot. "Copy previous week" in one click.
- **Discord shift pings** — at 04:00 / 12:00 / 20:00 Europe/Berlin it posts the on-shift list
  to the configured webhook. Built-in scheduler (no external cron); `/api/cron/shift-ping` is a fallback.
- **Poster view** — a dark, print-ready weekly schedule per creator.
- **Chatters & Models** — roster (real name → chatter name → Discord username → color) and creators.
- **Dashboard** — workload per chatter and double-booking conflicts per week.
- **One shared password** (`APP_PASSWORD`) gates the site.

## Stack
Next.js (App Router) + TypeScript, Prisma over PostgreSQL. No other services required.

## Run locally
```bash
npm install
cp .env.example .env   # fill in DATABASE_URL etc.
npx prisma migrate deploy
npm run db:seed
npm run dev
```

## Environment
| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `APP_PASSWORD` | recommended | Shared login password; unset = open |
| `DISCORD_WEBHOOK_URL` | optional | Shift-ping webhook fallback (Settings page value wins) |
| `CRON_SECRET` | optional | Protects `/api/cron/shift-ping` for external crons |
| `SCHEDULER_SYNC_TOKEN` | for AURA link | Same value on this app and the `maurits` service; enables the roster sync, SSO, and avatars |
| `OPSTRACK_URL` | optional | AURA monitoring base URL (default `https://opstrack.auramngt.com`) |
