import { Job, scheduleJob } from "node-schedule";
import { startDiscovery } from "./discovery-service";
import { wsConnection } from "../websocket";
import { getConfiguration } from "./database";

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

export async function initializeJob() {
  const timeForProcessing = (await getConfiguration())?.timeForProcessing;
  if (timeForProcessing?.length === 5) {
    const hour = timeForProcessing.slice(0, 2);
    const minute = timeForProcessing.slice(3, 5);
    interval = scheduleJob(`${minute} ${hour} * * *`, () => {
      startDiscovery(wsConnection);
    });
  }
}
