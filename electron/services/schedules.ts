import { Job, scheduleJob } from "node-schedule";
import { wsConnection } from "../websocket";
import { autoConfigureSieg, getConfiguration } from "./database";
import { startSieg } from "./sieg-service";
import { addMonths } from "date-fns";
import { healthBrokerComunication } from "./health-broker-service";
import { startProcess } from "./process-service";
let jobDiscovery: Job | null = null;
let jobSieg: Job | null = null;
let jobHealth: Job | null = null;

export function updateJobs() {
  initializeJobAutoConfigureSieg();
  initializeJob();
  initializeJobSieg();
  initializeJobHealth();
}

export async function initializeJob() {
  const timeForProcessing = (await getConfiguration())?.timeForProcessing;
  if (timeForProcessing && timeForProcessing !== "00:00") {
    const hour = timeForProcessing.slice(0, 2);
    const minute = timeForProcessing.slice(3, 5);
    jobDiscovery = scheduleJob(`${minute} ${hour} * * *`, () => {
      startProcess(wsConnection);
    });
  } else {
    jobDiscovery?.cancel();
  }
}

export async function initializeJobSieg() {
  const timeForConsultingSieg = (await getConfiguration())
    ?.timeForConsultingSieg;
  if (timeForConsultingSieg && timeForConsultingSieg !== "00:00") {
    const newDate = new Date();
    const dateInitial = addMonths(
      new Date(newDate.getFullYear(), newDate.getMonth(), 1),
      -1
    );
    const dateEnd = newDate;
    const hour = timeForConsultingSieg.slice(0, 2);
    const minute = timeForConsultingSieg.slice(3, 5);
    jobSieg = scheduleJob(`${minute} ${hour} * * *`, () => {
      startSieg(wsConnection, dateInitial, dateEnd);
    });
  } else {
    jobSieg?.cancel();
  }
}

export async function initializeJobHealth() {
  if (jobHealth !== null) return;
  jobHealth = scheduleJob(`0 * * * *`, () => {
    healthBrokerComunication();
  });
}

export async function initializeJobAutoConfigureSieg() {
  autoConfigureSieg();
}
