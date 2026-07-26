-- Explicit poster name per chatter. Pre-filled with what the posters already
-- show (LX people → chatting alias, everyone else → real first name, falling
-- back to the chatting name when no real name is on file).
ALTER TABLE "Chatter" ADD COLUMN "posterName" TEXT NOT NULL DEFAULT '';

UPDATE "Chatter" SET "posterName" = CASE
  WHEN "isLX" THEN "name"
  WHEN btrim("fullName") <> '' THEN split_part(btrim("fullName"), ' ', 1)
  ELSE "name"
END;
