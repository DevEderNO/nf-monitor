/*
  Warnings:

  - You are about to drop the `CountedNotes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `apiKeySieg` on the `Configuration` table. All the data in the column will be lost.
  - You are about to drop the column `directoryDownloadSieg` on the `Configuration` table. All the data in the column will be lost.
  - You are about to drop the column `emailSieg` on the `Configuration` table. All the data in the column will be lost.
  - You are about to drop the column `senhaSieg` on the `Configuration` table. All the data in the column will be lost.
  - You are about to drop the column `timeForConsultingSieg` on the `Configuration` table. All the data in the column will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CountedNotes";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Configuration" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "timeForProcessing" TEXT NOT NULL DEFAULT '00:00',
    "viewUploadedFiles" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Configuration" ("createdAt", "id", "timeForProcessing", "updatedAt", "viewUploadedFiles") SELECT "createdAt", "id", "timeForProcessing", "updatedAt", "viewUploadedFiles" FROM "Configuration";
DROP TABLE "Configuration";
ALTER TABLE "new_Configuration" RENAME TO "Configuration";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
