import { connection } from "websocket";
import { DiscoveryTask } from "../classes/discovery-task";

const task = new DiscoveryTask();

export function startDiscovery(connection: connection) {
  task.run(connection);
}
export function pauseDiscovery() {
  task.pause();
}
export function resumeDiscovery() {
  task.resume();
}
export function stopDiscovery() {
  task.cancel();
}
