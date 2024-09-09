-- CreateTable
CREATE TABLE "Panel" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "host" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "port" TEXT NOT NULL,
    "path" TEXT DEFAULT '/',
    "session" TEXT,
    "subPort" TEXT NOT NULL,
    "subPath" TEXT DEFAULT '/',
    "enable" BOOLEAN DEFAULT true
);

-- CreateTable
CREATE TABLE "Client" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "enable" TEXT NOT NULL,
    "limitIp" INTEGER NOT NULL,
    "ipsCount" INTEGER NOT NULL,
    "totalTraffic" TEXT NOT NULL,
    "download" TEXT NOT NULL,
    "upload" TEXT NOT NULL,
    "totalUsage" TEXT NOT NULL,
    "remainingTraffic" TEXT NOT NULL,
    "expirationDay" TEXT NOT NULL,
    "remainingTime" TEXT NOT NULL,
    "config" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Panel_host_key" ON "Panel"("host");

-- CreateIndex
CREATE UNIQUE INDEX "Client_uuid_key" ON "Client"("uuid");
