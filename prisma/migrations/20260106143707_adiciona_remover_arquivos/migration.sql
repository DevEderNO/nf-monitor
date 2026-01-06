-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Configuration" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "timeForProcessing" TEXT NOT NULL DEFAULT '00:00',
    "viewUploadedFiles" BOOLEAN NOT NULL DEFAULT false,
    "removeUploadedFiles" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Configuration" ("createdAt", "id", "timeForProcessing", "updatedAt", "viewUploadedFiles") SELECT "createdAt", "id", "timeForProcessing", "updatedAt", "viewUploadedFiles" FROM "Configuration";
DROP TABLE "Configuration";
ALTER TABLE "new_Configuration" RENAME TO "Configuration";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
