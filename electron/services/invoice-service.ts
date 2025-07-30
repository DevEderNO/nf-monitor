import { connection } from 'websocket';
import { InvoiceTask } from '../classes/invoice-task';

const task = new InvoiceTask();

export function startInvoiceProcess(connection: connection) {
  task.run(connection);
}
export function pauseInvoiceProcess() {
  task.pause();
}
export function resumeInvoiceProcess() {
  task.resume();
}
export function stopInvoiceProcess() {
  task.cancel();
}
