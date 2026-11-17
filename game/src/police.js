// The wanted level and the police who answer it. Stealing a car or running over a
// pedestrian raises the heat; at wanted 1 and above a patrol car spawns and chases
// the player along the road grid — never across blocks — ramming them when it
// catches up. Wanted 3 brings a second patrol car; wanted 4 parks a roadblock
// across the road ahead. Lay low and the heat slowly cools off.

import { WANTED_MAX, WORLD } from './config.js';
import { createCar, moveCarBody } from './vehicles.js';
import { nearestRoadPoint, slideOutOfSolid } from './world.js';

export const COOLOFF_SECONDS = 25;

export function createPoliceState() {
  return {
    car: null,
    extra: null,
    roadblock: null,
    sirenPhase: 0,
    chaseTime: 0,
    ramCooldown: 0,
  };
}

/** Park every police car and forget it (heat gone, or the chase is over). */
function clearPoliceCars(state) {
  const police = state.police;
  if (police.car) { police.car.active = false; police.car = null; }
  if (police.extra) { police.extra.active = false; police.extra = null; }
  if (police.roadblock) {
    for (const car of police.roadblock) car.active = false;
    police.roadblock = null;
  }
}

/** Raise the wanted level by `amount` (capped) and reset the cool-off timer. */
export function raiseWanted(state, amount) {
  state.wanted = Math.min(WANTED_MAX, state.wanted + amount);
  state.wantedTimer = COOLOFF_SECONDS;
  return state.wanted;
}

/** Cool the wanted level down after a quiet stretch with no new crimes. */
export function stepWanted(state, dt) {
  if (state.wanted <= 0) return;
  state.wantedTimer -= dt;
  if (state.wantedTimer <= 0) {
    state.wanted -= 1;
    state.wantedTimer = COOLOFF_SECONDS;
    if (state.wanted === 0) clearPoliceCars(state);
  }
}

function playerPosition(state) {
  if (state.player.inCar) return { x: state.player.inCar.x, y: state.player.inCar.y };
  return { x: state.player.x, y: state.player.y };
}

/**
 * Pick the patrol car's next waypoint the way traffic does: run along the current
 * road to the cross street nearest the player, then turn onto it. The car never
 * cuts across a block — it always travels on the road grid.
 */
function pickPoliceTarget(city, car, playerPos) {
  if (car.axis === 'v') {
    let best = city.lines.horizontal[0];
    for (const line of city.lines.horizontal) {
      if (Math.abs(line - playerPos.y) < Math.abs(best - playerPos.y)) best = line;
    }
    car.targetX = car.x;
    car.targetY = best;
    car.nextAxis = 'h';
  } else {
    let best = city.lines.vertical[0];
    for (const line of city.lines.vertical) {
      if (Math.abs(line - playerPos.x) < Math.abs(best - playerPos.x)) best = line;
    }
    car.targetX = best;
    car.targetY = car.y;
    car.nextAxis = 'v';
  }
}

function steerPoliceCar(car, dt, maxTurn = 2.6) {
  const want = Math.atan2(car.targetY - car.y, car.targetX - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-maxTurn * dt, Math.min(maxTurn * dt, diff));
}

/**
 * One fixed step of a road-following patrol car: steer toward its waypoint, turn
 * onto the cross street when it arrives, and run along the new road toward the
 * player. Movement goes through moveCarBody, so buildings and water still stop it.
 */
function stepPoliceCar(car, state, dt, playerPos) {
  const dx = car.targetX - car.x;
  const dy = car.targetY - car.y;
  if (Math.hypot(dx, dy) < 30) {
    // Reached the cross street: turn onto it and run along it toward the player.
    car.axis = car.nextAxis ?? (car.axis === 'v' ? 'h' : 'v');
    if (car.axis === 'h') {
      car.targetX = Math.max(120, Math.min(WORLD.width - 120, playerPos.x));
      car.targetY = car.y;
    } else {
      car.targetX = car.x;
      car.targetY = Math.max(120, Math.min(WORLD.beachY - 120, playerPos.y));
    }
    car.nextAxis = car.axis === 'v' ? 'h' : 'v';
  }
  steerPoliceCar(car, dt);
  const cruise = state.police.ramCooldown > 0 ? 160 : 300 + state.wanted * 45;
  car.speed += (cruise - car.speed) * Math.min(1, dt * 1.2);
  moveCarBody(car, state.city, dt);
}

/**
 * Ram the player's car when a patrol car catches up: shove it (sliding out of
 * walls, never into one) and hurt the player a little. Returns 'rammed' on a hit.
 */
function tryRam(state, car) {
  const pos = playerPosition(state);
  const dist = Math.hypot(pos.x - car.x, pos.y - car.y);
  if (dist >= 58) return null;
  const target = state.player.inCar;
  if (target) {
    const shoved = slideOutOfSolid(
      state.city,
      target.x + Math.cos(car.angle) * 16,
      target.y + Math.sin(car.angle) * 16,
      26, target.x, target.y,
    );
    target.x = shoved.x;
    target.y = shoved.y;
    target.speed *= 0.55;
  }
  state.player.health = Math.max(0, state.player.health - 4);
  car.speed *= -0.25;
  state.police.chaseTime = 0;
  state.police.ramCooldown = 1.5;
  return 'rammed';
}

/**
 * Spawn a patrol car a short way from the player, snapped onto the nearest road
 * and pointed along it toward the player. The spawn angle comes from the seeded
 * RNG, so the same seed always spawns the same chase.
 */
export function spawnPoliceCar(state, random) {
  const pos = playerPosition(state);
  const angle = random.range(0, Math.PI * 2);
  const rough = {
    x: pos.x + Math.cos(angle) * 520,
    y: pos.y + Math.sin(angle) * 520,
  };
  const snap = nearestRoadPoint(state.city, rough.x, rough.y);
  const car = createCar(snap.x, snap.y, 0, '#2f6fd0', { traffic: false, axis: snap.axis });
  car.angle = snap.axis === 'v'
    ? (pos.y > snap.y ? Math.PI / 2 : -Math.PI / 2)
    : (pos.x > snap.x ? 0 : Math.PI);
  car.isPolice = true;
  pickPoliceTarget(state.city, car, pos);
  state.police.car = car;
  state.cars.push(car);
  return car;
}

/** A second patrol car joins the chase at wanted 3 and above. */
function spawnExtraPoliceCar(state, random) {
  const pos = playerPosition(state);
  const angle = random.range(0, Math.PI * 2) + Math.PI;
  const rough = {
    x: pos.x + Math.cos(angle) * 560,
    y: pos.y + Math.sin(angle) * 560,
  };
  const snap = nearestRoadPoint(state.city, rough.x, rough.y);
  const car = createCar(snap.x, snap.y, 0, '#2f6fd0', { traffic: false, axis: snap.axis });
  car.angle = snap.axis === 'v'
    ? (pos.y > snap.y ? Math.PI / 2 : -Math.PI / 2)
    : (pos.x > snap.x ? 0 : Math.PI);
  car.isPolice = true;
  pickPoliceTarget(state.city, car, pos);
  state.police.extra = car;
  state.cars.push(car);
  return car;
}

/**
 * At wanted 4 and above, park two patrol cars across the road ahead of the player
 * — a simple roadblock. They sit still until the heat drops below 4.
 */
function spawnRoadblock(state) {
  const pos = playerPosition(state);
  const heading = state.player.inCar ? state.player.inCar.angle : state.player.angle;
  const ahead = {
    x: pos.x + Math.cos(heading) * 380,
    y: pos.y + Math.sin(heading) * 380,
  };
  const snap = nearestRoadPoint(state.city, ahead.x, ahead.y);
  const cars = [];
  for (const off of [-30, 30]) {
    const x = snap.axis === 'v' ? snap.x + off : snap.x;
    const y = snap.axis === 'v' ? snap.y : snap.y + off;
    const car = createCar(x, y, snap.axis === 'v' ? Math.PI / 2 : 0, '#2f6fd0', { parked: true });
    car.isPolice = true;
    cars.push(car);
    state.cars.push(car);
  }
  state.police.roadblock = cars;
  return cars;
}

/**
 * One fixed step of the chase: the patrol cars follow the road grid toward the
 * player and ram when they catch up; a second car joins at wanted 3, and a
 * roadblock parks across the road ahead at wanted 4. Returns 'rammed' on a hit.
 */
export function stepPolice(state, dt, random) {
  const police = state.police;
  police.sirenPhase += dt * 6;
  if (police.ramCooldown > 0) police.ramCooldown -= dt;
  if (state.wanted < 1) {
    clearPoliceCars(state);
    return null;
  }
  if (!police.car || !police.car.active) spawnPoliceCar(state, random);
  const pos = playerPosition(state);
  let result = null;
  if (police.car && police.car.active) {
    stepPoliceCar(police.car, state, dt, pos);
    if (police.ramCooldown <= 0) result = tryRam(state, police.car) ?? result;
  }
  if (state.wanted >= 3) {
    if (!police.extra || !police.extra.active) spawnExtraPoliceCar(state, random);
    if (police.extra && police.extra.active) {
      stepPoliceCar(police.extra, state, dt, pos);
      if (police.ramCooldown <= 0) result = tryRam(state, police.extra) ?? result;
    }
  } else if (police.extra) {
    police.extra.active = false;
    police.extra = null;
  }
  if (state.wanted >= 4) {
    if (!police.roadblock) spawnRoadblock(state);
  } else if (police.roadblock) {
    for (const car of police.roadblock) car.active = false;
    police.roadblock = null;
  }
  police.chaseTime += dt;
  return result;
}
