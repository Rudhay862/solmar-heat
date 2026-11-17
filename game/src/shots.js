// The screenshot scenes behind ?shot=start|play|mission|chase. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot, so the frame is what a short game really looks like and the
// same seed always gives the same frame. The caller renders the returned screen
// twice and then sets window.__shotReady. Police spawns use the seeded RNG (see
// police.js), so the chase scenes are deterministic for a fixed seed.

import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { startTutorialMission } from './missions.js';
import { createCar } from './vehicles.js';
import { nearestRoadPoint } from './world.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 14;
const MISSION_SECONDS = 9;
const CHASE_SECONDS = 6;

/** A fake input the autopilot drives: vector() answers from its current steering. */
function autopilotInput() {
  const fake = {
    steerX: 0,
    steerY: -1,
    brake: false,
    vector() { return { x: fake.steerX, y: fake.steerY }; },
    running() { return false; },
    braking() { return fake.brake; },
    takeActions() { return 0; },
  };
  return fake;
}

/**
 * A driver that steers the car toward a target each step, brakes into tight turns,
 * and reverses out when the car makes no progress (wedged on a corner) for 1.5 s.
 */
function createDriver(step, input, car) {
  let reverseFrames = 0;
  let windowFrames = 0;
  let windowX = car.x;
  let windowY = car.y;
  return function drive(state, tx, ty) {
    if (reverseFrames > 0) {
      input.steerY = 1; // reverse
      input.steerX = -1;
      input.brake = false;
      reverseFrames -= 1;
      step(STEP, input);
      windowFrames = 0;
      windowX = car.x;
      windowY = car.y;
      return;
    }
    roadDriveToward(input, state, car, tx, ty);
    // Brake hard into a turn sharper than ~50 degrees.
    const want = Math.atan2(ty - car.y, tx - car.x);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    input.brake = Math.abs(diff) > 0.9;
    step(STEP, input);
    windowFrames += 1;
    if (windowFrames >= 90) {
      const moved = Math.hypot(car.x - windowX, car.y - windowY);
      if (moved < 60) reverseFrames = 50;
      windowFrames = 0;
      windowX = car.x;
      windowY = car.y;
    }
  };
}

/** Steer the car toward a point: throttle forward, steer left/right by the angle gap. */
function driveToward(input, car, tx, ty) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  input.steerX = diff > 0.15 ? 1 : diff < -0.15 ? -1 : 0;
  input.steerY = -1; // forward — keep rolling through turns so the car never stalls mid-turn
}

/**
 * Drive toward a target the way a driver would: stay on the road grid, turn onto
 * the cross street that leads to the target, then run straight at it.
 */
function roadDriveToward(input, state, car, tx, ty) {
  const snap = nearestRoadPoint(state.city, car.x, car.y);
  // Off the road (shoved into a block by a ram): get back to the nearest road first.
  const offRoad = snap.axis === 'v' ? Math.abs(snap.x - car.x) : Math.abs(snap.y - car.y);
  if (offRoad > 70) {
    driveToward(input, car, snap.x, snap.y);
    return;
  }
  let wx = tx;
  let wy = ty;
  if (snap.axis === 'h') {
    // On a horizontal road: run along it to the vertical road nearest the target.
    const lines = state.city.lines.vertical;
    let best = lines[0];
    for (const line of lines) if (Math.abs(line - tx) < Math.abs(best - tx)) best = line;
    if (Math.abs(car.x - best) > 40) {
      wx = best;
      wy = snap.line;
    }
  } else {
    const lines = state.city.lines.horizontal;
    let best = lines[0];
    for (const line of lines) if (Math.abs(line - ty) < Math.abs(best - ty)) best = line;
    if (Math.abs(car.y - best) > 40) {
      wx = snap.line;
      wy = best;
    }
  }
  driveToward(input, car, wx, wy);
}

function putPlayerInCar(state, x, y, angle) {
  const car = createCar(x, y, angle, '#d94f3d', { owned: true });
  state.cars.push(car);
  state.player.x = x;
  state.player.y = y;
  state.player.inCar = car;
  car.driven = true;
  return car;
}

/**
 * Set `state` to the named scene (start, play, mission or chase; any other name
 * is start) and return the screen to draw over it. `step` advances the game one
 * fixed step with the given fake input.
 */
export function stageShot(name, state, step) {
  const input = autopilotInput();
  if (name === 'chase') {
    // On foot on Sunset Beach with the police closing in — wanted stars up, the
    // pistol out, patrol cars driving the beach road after Rook.
    state.player.x = 900;
    state.player.y = 2330;
    state.player.angle = 0;
    state.hasPistol = true;
    state.combat.ammo = 12;
    state.wanted = 3;
    state.wantedTimer = 25;
    for (let i = 0; i < CHASE_SECONDS / STEP; i += 1) {
      // Walk east along the sand while the patrol cars close in.
      input.steerX = 1;
      input.steerY = 0;
      step(STEP, input);
    }
    return { screen: SCREEN_PLAY };
  }

  if (name !== 'play' && name !== 'mission') {
    // Title backdrop: the city alive behind the menu, player on foot in the plaza.
    state.player.x = 1820;
    state.player.y = 1000;
    for (let i = 0; i < START_SECONDS / STEP; i += 1) step(STEP, input);
    return { screen: SCREEN_TITLE };
  }

  if (name === 'mission') {
    startTutorialMission(state);
    const car = putPlayerInCar(state, 1420, 1020, 0);
    const drive = createDriver(step, input, car);
    for (let i = 0; i < MISSION_SECONDS / STEP; i += 1) {
      const stage = state.mission.stages[state.mission.stageIndex];
      if (stage) drive(state, stage.x, stage.y);
      else {
        // Job done: brake to a stop at the drop-off instead of driving on.
        input.steerY = 0;
        input.steerX = 0;
        input.brake = true;
        step(STEP, input);
      }
    }
    return { screen: SCREEN_PLAY };
  }

  // Play: the player mid-city in a stolen car, traffic flowing around them.
  // Waypoints sit on the road lines (vertical 3000/600, horizontal 600/1400),
  // so the cruise never cuts across a block.
  const car = putPlayerInCar(state, 620, 620, 0);
  state.wanted = 1;
  state.wantedTimer = 25;
  const cruise = [
    { x: 3000, y: 600 },
    { x: 3000, y: 1400 },
    { x: 600, y: 1400 },
    { x: 600, y: 600 },
  ];
  let waypoint = 0;
  const drive = createDriver(step, input, car);
  for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
    const target = cruise[waypoint];
    if (Math.hypot(target.x - car.x, target.y - car.y) < 90) waypoint = (waypoint + 1) % cruise.length;
    drive(state, cruise[waypoint].x, cruise[waypoint].y);
  }
  return { screen: SCREEN_PLAY };
}
