import { connection } from "websocket";
import { ProcessTask } from "../classes/process-task";

const task = new ProcessTask();

export function startProcess(connection: connection, id: string) {
  task.run(connection, id);
}
export function pauseProcess() {
  task.pause();
}
export function resumeProcess() {
  task.resume();
}
export function stopProcess() {
  task.cancel();
}
