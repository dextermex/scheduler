-- Per-model Discord webhook for schedule poster delivery
ALTER TABLE "Creator" ADD COLUMN "webhookUrl" TEXT NOT NULL DEFAULT '';
