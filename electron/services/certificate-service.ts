import { connection } from 'websocket';
import { CertificateTask } from '../classes/certificate-task.ts';

const task = new CertificateTask();

export function startCertificateProcess(connection: connection) {
  task.run(connection);
}
export function pauseCertificateProcess() {
  task.pause();
}
export function resumeCertificateProcess() {
  task.resume();
}
export function stopCertificateProcess() {
  task.cancel();
}
