-- LX flag: posters show the chatting alias for LX people, real first name otherwise
ALTER TABLE "Chatter" ADD COLUMN "isLX" BOOLEAN NOT NULL DEFAULT false;
