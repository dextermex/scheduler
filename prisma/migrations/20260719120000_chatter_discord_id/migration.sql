-- Dedicated numeric Discord user id per chatter (for real @pings); the
-- existing discordUsername stays the human-readable handle.
ALTER TABLE "Chatter" ADD COLUMN "discordId" TEXT NOT NULL DEFAULT '';
