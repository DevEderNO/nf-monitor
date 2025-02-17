/*
  Warnings:

  - Added the required column `totalFiles` to the `Directory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalFiles` to the `DirectoryDiscovery` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE IF NOT EXISTS "new_Directory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "path" TEXT NOT NULL,
    "modifiedtime" DATETIME NOT NULL,
    "size" INTEGER NOT NULL,
    "directories" INTEGER NOT NULL,
    "xmls" INTEGER NOT NULL,
    "pdfs" INTEGER NOT NULL,
    "zips" INTEGER NOT NULL,
    "totalFiles" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Directory" ("createdAt", "directories", "id", "modifiedtime", "path", "pdfs", "size", "updatedAt", "xmls", "zips", "totalFiles") 
SELECT "createdAt", "directories", "id", "modifiedtime", "path", "pdfs", "size", "updatedAt", "xmls", "zips", 0 as "totalFiles" FROM "Directory";
DROP TABLE "Directory";
ALTER TABLE "new_Directory" RENAME TO "Directory";
CREATE TABLE IF NOT EXISTS "new_DirectoryDiscovery" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "path" TEXT NOT NULL,
    "modifiedtime" DATETIME NOT NULL,
    "size" INTEGER NOT NULL,
    "directories" INTEGER NOT NULL,
    "xmls" INTEGER NOT NULL,
    "pdfs" INTEGER NOT NULL,
    "zips" INTEGER NOT NULL,
    "totalFiles" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_DirectoryDiscovery" ("createdAt", "directories", "id", "modifiedtime", "path", "pdfs", "size", "updatedAt", "xmls", "zips", "totalFiles") 
SELECT "createdAt", "directories", "id", "modifiedtime", "path", "pdfs", "size", "updatedAt", "xmls", "zips", 0 as "totalFiles" FROM "DirectoryDiscovery";
DROP TABLE "DirectoryDiscovery";
ALTER TABLE "new_DirectoryDiscovery" RENAME TO "DirectoryDiscovery";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
