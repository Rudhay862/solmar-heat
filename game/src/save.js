// Saving and loading: the player's cash, health, position, wanted level, mission
// progress and best haul live in localStorage, so a visit can continue where the
// last one stopped. Storage can be off (private windows) — then the save simply
// lasts this visit only and nothing breaks.

import { SAVE_KEY } from './config.js';

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    const data = {
      cash: state.cash,
      health: state.player.health,
      x: state.player.inCar ? state.player.inCar.x : state.player.x,
      y: state.player.inCar ? state.player.inCar.y : state.player.y,
      wanted: state.wanted,
      missionStatus: state.mission.status,
      missionStage: state.mission.stageIndex,
      missionId: state.mission.id,
      missionCompleted: state.mission.completedIds.length,
      clockMinutes: state.clockMinutes,
      bestCash: state.bestCash,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** The best haul the player has ever banked, for the title screen. */
export function readBestCash() {
  const save = readSave();
  return save && typeof save.bestCash === 'number' ? save.bestCash : 0;
}
