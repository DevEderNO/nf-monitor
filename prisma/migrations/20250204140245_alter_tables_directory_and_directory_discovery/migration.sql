-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE IF NOT EXISTS "new_Directory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "path" TEXT NOT NULL,
    "modifiedtime" DATETIME NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "directories" INTEGER NOT NULL DEFAULT 0,
    "xmls" INTEGER NOT NULL DEFAULT 0,
    "pdfs" INTEGER NOT NULL DEFAULT 0,
    "zips" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Directory" ("createdAt", "id", "modifiedtime", "path", "size", "updatedAt") SELECT "createdAt", "id", "modifiedtime", "path", "size", "updatedAt" FROM "Directory";
DROP TABLE "Directory";
ALTER TABLE "new_Directory" RENAME TO "Directory";
CREATE TABLE IF NOT EXISTS "new_DirectoryDiscovery" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "path" TEXT NOT NULL,
    "modifiedtime" DATETIME NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "directories" INTEGER NOT NULL DEFAULT 0,
    "xmls" INTEGER NOT NULL DEFAULT 0,
    "pdfs" INTEGER NOT NULL DEFAULT 0,
    "zips" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_DirectoryDiscovery" ("createdAt", "id", "modifiedtime", "path", "size", "updatedAt") SELECT "createdAt", "id", "modifiedtime", "path", "size", "updatedAt" FROM "DirectoryDiscovery";
DROP TABLE "DirectoryDiscovery";
ALTER TABLE "new_DirectoryDiscovery" RENAME TO "DirectoryDiscovery";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
