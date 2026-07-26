-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Shift" AS ENUM ('MORNING', 'AFTERNOON', 'NIGHT');

-- CreateTable
CREATE TABLE "Chatter" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "discordUsername" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '#8b7cff',
    "aliases" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chatter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Creator" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Creator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "shift" "Shift" NOT NULL,
    "creatorId" TEXT NOT NULL,
    "chatterId" TEXT NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ShiftPingLog" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "shift" "Shift" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "ShiftPingLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Chatter_name_key" ON "Chatter"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Creator_name_key" ON "Creator"("name");

-- CreateIndex
CREATE INDEX "Assignment_weekStart_idx" ON "Assignment"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_weekStart_day_shift_creatorId_chatterId_key" ON "Assignment"("weekStart", "day", "shift", "creatorId", "chatterId");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftPingLog_date_shift_key" ON "ShiftPingLog"("date", "shift");

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_chatterId_fkey" FOREIGN KEY ("chatterId") REFERENCES "Chatter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

