import { connection } from "websocket";
import { DiscoveryTask } from "../classes/discovery-task";
import { IDirectory } from "@interfaces/directory";

const task = new DiscoveryTask();

export function startDiscovery(
  connection: connection,
  directories: IDirectory[]
) {
  task.run(connection, directories);
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
