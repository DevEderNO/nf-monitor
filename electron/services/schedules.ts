import { Job, scheduleJob } from 'node-schedule';
import { wsConnection } from '../websocket';
import { countFilesSendedToDay, getConfiguration } from './database';
import { healthBrokerComunication } from './health-broker-service';
import { startInvoiceProcess } from './invoice-service';
import { XHealthType } from '../interfaces/health-message';
let jobDiscovery: Job | null = null;
let jobHealth: Job | null = null;

export async function initializeJob() {
  const timeForProcessing = (await getConfiguration())?.timeForProcessing;
  if (timeForProcessing && timeForProcessing !== '00:00') {
    const hour = timeForProcessing.slice(0, 2);
    const minute = timeForProcessing.slice(3, 5);
    jobDiscovery = scheduleJob(`${minute} ${hour} * * *`, () => {
      startInvoiceProcess(wsConnection);
    });
  } else {
    jobDiscovery?.cancel();
  }
}

export async function initializeJobHealth() {
  if (jobHealth !== null) return;
  jobHealth = scheduleJob(`*/1 * * * *`, async () => {
    const filesSendedToDay = await countFilesSendedToDay();
    healthBrokerComunication(XHealthType.Info, `Arquivos enviados hoje ${filesSendedToDay}`);
  });
}
