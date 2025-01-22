import { connection } from "websocket";
import { SiegTask } from "../classes/sieg-task";

const task = new SiegTask();

export function startSieg(
  connection: connection,
  dateInitial: Date,
  dateEnd: Date
) {
  task.run(connection, dateInitial, dateEnd);
}
export function pauseSieg() {
  task.pause();
}
export function resumeSieg() {
  task.resume();
}
export function stopSieg() {
  task.cancel();
}
