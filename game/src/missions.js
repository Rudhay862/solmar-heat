// Missions: Marisol Vega's story arc for the player ("Rook"), plus repeatable
// street jobs once the arc is done. A mission is a list of stages with a target
// point, a radius and a reward; the framework advances a stage when the player
// (on foot or in a car) reaches its marker. Timed jobs count down from the moment
// Marisol calls; the getaway job ends when the wanted level clears.

import { MISSION_REWARD } from './config.js';
import { COOLOFF_SECONDS } from './police.js';

export const MISSION_NONE = 'none';
export const MISSION_ACTIVE = 'active';
export const MISSION_DONE = 'done';
export const MISSION_FAILED = 'failed';

/** The story arc, in order. After the last one, M hands out street jobs. */
export const ARC_MISSIONS = ['first-delivery', 'hot-delivery', 'lose-the-heat', 'three-drops'];

export function createMissionState() {
  return {
    status: MISSION_NONE,
    id: null,
    title: '',
    stageIndex: 0,
    stages: [],
    reward: 0,
    flash: 0,
    timer: 0,
    timeLimit: 0,
    completedIds: [],
  };
}

function tutorialMission(city) {
  // Pickup at the plaza, drop-off back at the docks office: both on the road grid.
  const pickup = { x: 1820, y: 1020, label: 'Pick up the package at Central Plaza' };
  const dropoff = { x: 3020, y: 620, label: 'Deliver it to the docks office' };
  return {
    id: 'first-delivery',
    title: 'First Delivery — Marisol needs a package moved, no questions asked',
    reward: MISSION_REWARD,
    stages: [
      { kind: 'goto', x: pickup.x, y: pickup.y, radius: 70, label: pickup.label },
      { kind: 'collect', x: pickup.x, y: pickup.y, radius: 70, label: 'Grab the package (drive or walk into the marker)' },
      { kind: 'goto', x: dropoff.x, y: dropoff.y, radius: 80, label: dropoff.label },
      { kind: 'deliver', x: dropoff.x, y: dropoff.y, radius: 80, label: 'Drop the package at the docks office' },
    ],
  };
}

function hotDeliveryMission() {
  // Pickup downtown, drop at the Marina — 75 seconds from the moment Marisol calls.
  // Both points sit on road intersections, so a car gets there in well under a minute.
  return {
    id: 'hot-delivery',
    title: 'Hot Delivery — Marisol needs this at the Marina in 75 seconds',
    reward: 300,
    timeLimit: 75,
    stages: [
      { kind: 'collect', x: 3020, y: 1800, radius: 70, label: 'Grab the hot package downtown' },
      { kind: 'goto', x: 1400, y: 200, radius: 80, label: 'Deliver to the Marina — beat the clock' },
      { kind: 'deliver', x: 1400, y: 200, radius: 80, label: 'Drop the package at the Marina' },
    ],
  };
}

function getawayMission() {
  // Marisol's crew burned Rook: 2 stars on the spot. Lay low until the heat clears,
  // then reach the safehouse in Palm Heights.
  return {
    id: 'lose-the-heat',
    title: 'Lose the Heat — shake 2 stars, then reach the Palm Heights safehouse',
    reward: 350,
    stages: [
      { kind: 'evade', x: 0, y: 0, radius: 0, label: 'Lose the police — lay low until the stars clear' },
      { kind: 'goto', x: 600, y: 1000, radius: 80, label: 'Reach the safehouse in Palm Heights' },
      { kind: 'deliver', x: 600, y: 1000, radius: 80, label: 'Lay low at the safehouse' },
    ],
  };
}

function pickupChainMission() {
  // Three packages scattered across the city, then one drop at the Marina.
  return {
    id: 'three-drops',
    title: 'Three Drops — collect three packages, then deliver to the Marina',
    reward: 400,
    stages: [
      { kind: 'collect', x: 600, y: 200, radius: 70, label: 'Package 1 of 3 — Old Town' },
      { kind: 'collect', x: 2600, y: 1400, radius: 70, label: 'Package 2 of 3 — Downtown' },
      { kind: 'collect', x: 1000, y: 1800, radius: 70, label: 'Package 3 of 3 — Sunset Beach road' },
      { kind: 'goto', x: 1800, y: 200, radius: 80, label: 'Deliver all three to the Marina' },
      { kind: 'deliver', x: 1800, y: 200, radius: 80, label: 'Hand the packages to Marisol’s man' },
    ],
  };
}

// Repeatable street work once Marisol's arc is done: a random pickup and drop-off
// from the city's corners, paying $150–$300.
const STREET_JOBS = [
  { pickup: { x: 600, y: 600, label: 'Old Town' }, dropoff: { x: 2600, y: 600, label: 'Downtown' } },
  { pickup: { x: 2200, y: 1400, label: 'Central Plaza' }, dropoff: { x: 1000, y: 2200, label: 'Sunset Beach' } },
  { pickup: { x: 1400, y: 1400, label: 'Central Plaza' }, dropoff: { x: 3020, y: 1000, label: 'Harbor Docks' } },
  { pickup: { x: 2600, y: 200, label: 'Downtown' }, dropoff: { x: 600, y: 1800, label: 'Palm Heights' } },
  { pickup: { x: 1800, y: 2200, label: 'Sunset Beach' }, dropoff: { x: 2200, y: 200, label: 'Marina District' } },
];

function repeatableJob(state) {
  const job = state.random.pick(STREET_JOBS);
  const reward = 150 + state.random.int(0, 3) * 50;
  return {
    id: `street-job-${state.random.int(1000, 9999)}`,
    title: `Street Job — ${job.pickup.label} to ${job.dropoff.label} ($${reward})`,
    reward,
    stages: [
      { kind: 'collect', x: job.pickup.x, y: job.pickup.y, radius: 70, label: `Pick up in ${job.pickup.label}` },
      { kind: 'goto', x: job.dropoff.x, y: job.dropoff.y, radius: 80, label: `Deliver to ${job.dropoff.label}` },
      { kind: 'deliver', x: job.dropoff.x, y: job.dropoff.y, radius: 80, label: `Drop off in ${job.dropoff.label}` },
    ],
  };
}

/** The mission definition for an arc id, or null for street jobs and unknown ids. */
export function missionById(id) {
  if (id === 'first-delivery') return tutorialMission();
  if (id === 'hot-delivery') return hotDeliveryMission();
  if (id === 'lose-the-heat') return getawayMission();
  if (id === 'three-drops') return pickupChainMission();
  return null;
}

/** Activate a mission definition on the state. */
function startMission(state, def) {
  const m = state.mission;
  m.status = MISSION_ACTIVE;
  m.id = def.id;
  m.title = def.title;
  m.stages = def.stages;
  m.stageIndex = 0;
  m.reward = def.reward;
  m.flash = 3;
  m.timeLimit = def.timeLimit ?? 0;
  m.timer = def.timeLimit ?? 0;
  if (def.id === 'lose-the-heat') {
    // Marisol's crew burned Rook: the heat is on the moment the job starts.
    state.wanted = Math.max(state.wanted, 2);
    state.wantedTimer = COOLOFF_SECONDS;
  }
}

/** Start the tutorial mission. Returns the objective text for the HUD feed. */
export function startTutorialMission(state) {
  startMission(state, tutorialMission());
  return `New job: ${state.mission.title}`;
}

/**
 * Start the next job: retry a failed one, then the next uncompleted arc mission,
 * then a repeatable street job. Returns the feed line, or null if a job is running.
 */
export function startNextMission(state) {
  const m = state.mission;
  if (m.status === MISSION_ACTIVE) return null;
  if (m.status === MISSION_FAILED && m.id) {
    const retry = missionById(m.id);
    if (retry) {
      startMission(state, retry);
      return `Retrying: ${retry.title}`;
    }
  }
  for (const id of ARC_MISSIONS) {
    if (!m.completedIds.includes(id)) {
      const def = missionById(id);
      startMission(state, def);
      return `New job: ${def.title}`;
    }
  }
  const job = repeatableJob(state);
  startMission(state, job);
  return `Street job: ${job.title}`;
}

/** Start an arc mission by id (used when restoring a save). Returns true if it ran. */
export function startMissionById(state, id) {
  const def = missionById(id);
  if (!def) return false;
  startMission(state, def);
  return true;
}

export function currentStage(state) {
  if (state.mission.status !== MISSION_ACTIVE) return null;
  return state.mission.stages[state.mission.stageIndex] ?? null;
}

export function missionMarker(state) {
  const stage = currentStage(state);
  if (!stage || stage.kind === 'evade') return null;
  return { x: stage.x, y: stage.y, label: stage.label };
}

/**
 * Advance the mission when the player (on foot or in a car) reaches the current
 * stage's marker. Returns an event string ('stage', 'complete', 'failed') or null.
 * Timed jobs fail when the clock runs out; evade stages end when the heat clears.
 */
export function stepMission(state, dt) {
  const m = state.mission;
  if (m.status !== MISSION_ACTIVE) return null;
  if (m.flash > 0) m.flash -= dt;
  const stage = m.stages[m.stageIndex];
  if (!stage) return null;
  // Timed job: the clock runs from the moment Marisol calls.
  if (m.timeLimit > 0) {
    m.timer -= dt;
    if (m.timer <= 0) {
      m.status = MISSION_FAILED;
      return 'failed';
    }
  }
  if (stage.kind === 'evade') {
    // Laying low cools the heat faster while this stage runs.
    if (state.wanted > 0) state.wantedTimer -= dt * 1.5;
    if (state.wanted <= 0) {
      m.stageIndex += 1;
      m.flash = 2;
      return 'stage';
    }
    return null;
  }
  const px = state.player.inCar ? state.player.inCar.x : state.player.x;
  const py = state.player.inCar ? state.player.inCar.y : state.player.y;
  const dist = Math.hypot(stage.x - px, stage.y - py);
  if (dist > stage.radius) return null;
  m.stageIndex += 1;
  m.flash = 2;
  if (m.stageIndex >= m.stages.length) {
    m.status = MISSION_DONE;
    if (!m.completedIds.includes(m.id)) m.completedIds.push(m.id);
    state.cash += m.reward;
    return 'complete';
  }
  return 'stage';
}

export function missionObjectiveText(state) {
  const m = state.mission;
  if (m.status === MISSION_FAILED) return 'Job failed — press M to retry.';
  const stage = currentStage(state);
  if (!stage) {
    if (m.status === MISSION_DONE) {
      if (m.completedIds.length >= ARC_MISSIONS.length) return 'Arc complete — press M for street jobs.';
      return `Job done — $${m.reward} earned. Press M for the next job.`;
    }
    return 'No active job — press M to work for Marisol.';
  }
  if (m.timeLimit > 0) return `⏱ ${Math.max(0, Math.ceil(m.timer))}s — ${stage.label}`;
  return stage.label;
}
