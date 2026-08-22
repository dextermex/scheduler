# Deploying to Railway

The app is a single Next.js service plus a PostgreSQL database. `railway.json` already
configures the build and start commands (`prisma migrate deploy` runs on every deploy, and the
app seeds itself on first boot against an empty database).

## 1. Create the project

1. In [Railway](https://railway.app), **New Project → Deploy from GitHub repo** and pick this
   repository (`main` branch). Railway auto-deploys on every push.
2. In the same project, **Create → Database → Add PostgreSQL**.

## 2. Configure the app service variables

On the app service → **Variables**:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference the Postgres service) |
| `APP_PASSWORD` | the shared team password for the site |
| `DISCORD_WEBHOOK_URL` | the Discord webhook URL (or set it later on **/settings**) |
| `CRON_SECRET` | optional — only if you plan to use an external cron |

## 3. Generate a domain

App service → **Settings → Networking → Generate Domain**. Open the URL, sign in with the
password, and you're on the schedule.

## 4. Wire up Discord

Either set `DISCORD_WEBHOOK_URL` above, or open **/settings**, paste the webhook URL, save, and
hit **Send test message**. Automatic pings then go out at 00:00, 08:00 and 16:00 Europe/Berlin —
no extra cron needed, the scheduler runs inside the app. Every ping (or failure) shows up in the
log on the same page.

### Optional: external cron backup

If you ever run the app somewhere that sleeps idle processes, point any cron service at:

```
GET https://<your-domain>/api/cron/shift-ping?secret=<CRON_SECRET>
```

every 5–10 minutes. The (date, shift) claim in the database means the built-in worker and the
external cron never double-post.

## Notes

- **Serverless hosts (Vercel etc.) are not a target** — the built-in scheduler needs a
  long-running process, which Railway provides.
- Migrations run automatically on deploy (`npx prisma migrate deploy` in the start command).
- The seed is idempotent; re-running `npm run db:seed` never duplicates data.
