import { powerSaveBlocker } from 'electron';

let powerSaveBlockerId: number | null = null;

export function startPowerSaveBlocker() {
  if (powerSaveBlockerId === null) {
    powerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension');
  }
}

export function stopPowerSaveBlocker() {
  if (powerSaveBlockerId !== null) {
    powerSaveBlocker.stop(powerSaveBlockerId);
    powerSaveBlockerId = null;
  }
}
