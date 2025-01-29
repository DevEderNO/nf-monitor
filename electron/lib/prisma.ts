import { PrismaClient } from "@prisma/client/index";
import path from "path";
import { app } from "electron";

export function getDatabaseUrl(): string {
  const dbPath = app.isPackaged
    ? path.join(app.getPath("userData"), "nfmonitor.db")
    : path.join(__dirname, "..", "prisma", "dev.db");

  return `file:${dbPath}`;
}

process.env.DATABASE_URL = getDatabaseUrl();

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: getDatabaseUrl(),
    },
  },
});

export default prisma;
