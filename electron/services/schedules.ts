import { Job, scheduleJob } from 'node-schedule';
import { wsConnection } from '../websocket';
import { getConfiguration } from './database';
import { startInvoiceProcess } from './invoice-service';
let jobDiscovery: Job | null = null;

export async function initializeJob() {
  const timeForProcessing = (await getConfiguration())?.timeForProcessing;
  if (timeForProcessing && timeForProcessing !== '00:00') {
    const hour = timeForProcessing.slice(0, 2);
    const minute = timeForProcessing.slice(3, 5);
    jobDiscovery = scheduleJob(`${minute} ${hour} * * *`, () => {
      if (wsConnection) {
        startInvoiceProcess(wsConnection);
      }
    });
  } else {
    jobDiscovery?.cancel();
  }
}
