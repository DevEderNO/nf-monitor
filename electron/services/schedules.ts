import { Job, scheduleJob } from "node-schedule";
import { startDiscovery } from "./discovery-service";
import { wsConnection } from "../websocket";
import { getDb } from "./file-operation-service";

let interval: Job | null = null;

export function updateJob(timeForProcessing: string) {
  if (interval) {
    interval.cancel();
  }
  const hour = timeForProcessing.slice(0, 2);
  const minute = timeForProcessing.slice(3, 5);
  interval = scheduleJob(`${minute} ${hour} * * *`, () => {
    startDiscovery(wsConnection);
  });
}

export function initializeJob() {
  const db = getDb();
  if (db.timeForProcessing?.length === 5) {
    const hour = db.timeForProcessing.slice(0, 2);
    const minute = db.timeForProcessing.slice(3, 5);
    interval = scheduleJob(`${minute} ${hour} * * *`, () => {
      startDiscovery(wsConnection);
    });
  }
}
