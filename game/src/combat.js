// Combat on foot: F punches, and after the first Marisol job the player owns a
// pistol — click or J fires at the mouse aim, with a muzzle flash, a tracer and
// limited ammo. Ammo crates around the city restock it. Shooting a pedestrian or
// a police car raises the heat, and at wanted 3 and above the police shoot back
// (slowly, and badly). Canvas-drawn effects only, no new assets.

import { ACTION_FIRE, ACTION_PUNCH } from './input.js';
import { raiseWanted } from './police.js';
import { slideOutOfSolid } from './world.js';

export const PISTOL_MAX_AMMO = 24;
export const PISTOL_RANGE = 520;
export const PUNCH_RANGE = 70;
export const PUNCH_COOLDOWN = 0.45;
export const SHOT_COOLDOWN = 0.22;

const CRATE_SPOTS = [
  { x: 1900, y: 1100 }, // Central Plaza
  { x: 3500, y: 500 }, // Harbor Docks
  { x: 1000, y: 2350 }, // Sunset Beach
];
const CRATE_RESPAWN = 30;
const POLICE_SHOT_INTERVAL = 1.2;

export function createCombatState() {
  return {
    ammo: 0,
    punchCooldown: 0,
    shootCooldown: 0,
    aimAngle: -Math.PI / 2,
    muzzle: 0,
    tracers: [],
    crates: [],
    policeShotTimer: POLICE_SHOT_INTERVAL,
  };
}

/** Place the ammo crates for a fresh game. */
export function spawnAmmoCrates(state) {
  state.combat.crates = CRATE_SPOTS.map((spot) => ({ x: spot.x, y: spot.y, respawn: 0 }));
}

function addTracer(state, x1, y1, x2, y2, color) {
  state.combat.tracers.push({ x1, y1, x2, y2, life: 0.12, maxLife: 0.12, color });
  if (state.combat.tracers.length > 24) state.combat.tracers.shift();
}

/** Every police car currently on the road: the patrol cars and the roadblock. */
function policeCars(state) {
  const cars = [];
  if (state.police.car && state.police.car.active) cars.push(state.police.car);
  if (state.police.extra && state.police.extra.active) cars.push(state.police.extra);
  if (state.police.roadblock) {
    for (const car of state.police.roadblock) if (car.active) cars.push(car);
  }
  return cars;
}

/**
 * Where a point sits relative to a ray: how far along it and how far across.
 * Returns null when the point is behind the ray's origin.
 */
function rayDistance(ox, oy, angle, px, py) {
  const dx = px - ox;
  const dy = py - oy;
  const along = dx * Math.cos(angle) + dy * Math.sin(angle);
  if (along < 0) return null;
  const across = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle));
  return { along, across };
}

/**
 * A punch on foot: shove a nearby pedestrian away (they stumble off, target and
 * all) or slow a police car that drove too close. Returns an event or null.
 */
function punch(state) {
  const combat = state.combat;
  if (combat.punchCooldown > 0 || state.player.inCar) return null;
  combat.punchCooldown = PUNCH_COOLDOWN;
  const p = state.player;
  let hit = false;
  for (const ped of state.peds) {
    if (ped.down) continue;
    if (Math.hypot(ped.x - p.x, ped.y - p.y) > PUNCH_RANGE) continue;
    const ang = Math.atan2(ped.y - p.y, ped.x - p.x);
    const moved = slideOutOfSolid(
      state.city,
      ped.x + Math.cos(ang) * 110, ped.y + Math.sin(ang) * 110,
      12, ped.x, ped.y,
    );
    ped.x = moved.x;
    ped.y = moved.y;
    ped.tx = ped.x;
    ped.ty = ped.y;
    hit = true;
  }
  for (const car of policeCars(state)) {
    if (Math.hypot(car.x - p.x, car.y - p.y) > PUNCH_RANGE + 20) continue;
    car.speed *= 0.5;
    hit = true;
  }
  if (!hit) return null;
  for (let i = 0; i < 5; i += 1) {
    state.particles.push({
      x: p.x + Math.cos(p.angle) * 24, y: p.y + Math.sin(p.angle) * 24,
      vx: state.random.range(-1, 1) * 120, vy: state.random.range(-1, 1) * 120,
      life: 0.3, maxLife: 0.3, color: '#ffd23f', size: 3,
    });
  }
  return 'punched';
}

/**
 * One pistol shot along the aim: the nearest pedestrian or police car the ray
 * crosses takes the hit. Shooting a person or a patrol car raises the heat.
 * Returns an event string or null.
 */
function shoot(state) {
  const combat = state.combat;
  if (combat.shootCooldown > 0 || state.player.inCar || !state.hasPistol) return null;
  if (combat.ammo <= 0) return 'no-ammo';
  combat.shootCooldown = SHOT_COOLDOWN;
  combat.ammo -= 1;
  combat.muzzle = 0.07;
  const p = state.player;
  const ang = combat.aimAngle;
  const ox = p.x + Math.cos(ang) * 18;
  const oy = p.y + Math.sin(ang) * 18;
  let bestAlong = PISTOL_RANGE;
  let hitPed = null;
  let hitCar = null;
  for (const ped of state.peds) {
    if (ped.down) continue;
    const r = rayDistance(ox, oy, ang, ped.x, ped.y);
    if (r && r.across < 16 && r.along < bestAlong) {
      bestAlong = r.along;
      hitPed = ped;
      hitCar = null;
    }
  }
  for (const car of policeCars(state)) {
    const r = rayDistance(ox, oy, ang, car.x, car.y);
    if (r && r.across < 34 && r.along < bestAlong) {
      bestAlong = r.along;
      hitPed = null;
      hitCar = car;
    }
  }
  const ex = ox + Math.cos(ang) * bestAlong;
  const ey = oy + Math.sin(ang) * bestAlong;
  addTracer(state, ox, oy, ex, ey, '#ffe08a');
  if (hitPed) {
    hitPed.down = true;
    raiseWanted(state, 1);
    return 'shot-ped';
  }
  if (hitCar) {
    hitCar.speed *= 0.5;
    raiseWanted(state, 1);
    for (let i = 0; i < 6; i += 1) {
      state.particles.push({
        x: ex, y: ey,
        vx: state.random.range(-1, 1) * 180, vy: state.random.range(-1, 1) * 180,
        life: 0.35, maxLife: 0.35, color: '#ffd23f', size: 3,
      });
    }
    return 'shot-cop';
  }
  return 'shot';
}

/**
 * At wanted 3 and above, a patrol car within range fires back at the player on
 * foot — slowly, and with a wide miss most of the time. Returns an event or null.
 */
function policeReturnFire(state, dt) {
  const combat = state.combat;
  if (state.wanted < 3 || state.player.inCar) return null;
  const cars = policeCars(state).filter(
    (c) => Math.hypot(c.x - state.player.x, c.y - state.player.y) < 650,
  );
  if (cars.length === 0) return null;
  combat.policeShotTimer -= dt;
  if (combat.policeShotTimer > 0) return null;
  combat.policeShotTimer = POLICE_SHOT_INTERVAL + state.random.range(0, 0.6);
  const car = cars[0];
  const p = state.player;
  const aim = Math.atan2(p.y - car.y, p.x - car.x);
  const error = state.random.range(-0.28, 0.28);
  const shotAngle = aim + error;
  const dist = Math.hypot(p.x - car.x, p.y - car.y);
  addTracer(
    state, car.x, car.y,
    car.x + Math.cos(shotAngle) * dist, car.y + Math.sin(shotAngle) * dist,
    '#ff8a7a',
  );
  if (Math.abs(error) < 0.09) {
    state.player.health = Math.max(0, state.player.health - 6);
    return 'police-shot-hit';
  }
  return 'police-shot-miss';
}

/**
 * One fixed step of combat: cooldowns, tracers, ammo crates, the punch, the
 * pistol and the police shooting back. `mouse` is the frame's takeMouse() result.
 * Returns the most important event this step, or null.
 */
export function stepCombat(state, dt, input, actions, mouse) {
  const combat = state.combat;
  if (combat.punchCooldown > 0) combat.punchCooldown -= dt;
  if (combat.shootCooldown > 0) combat.shootCooldown -= dt;
  if (combat.muzzle > 0) combat.muzzle -= dt;
  for (let i = combat.tracers.length - 1; i >= 0; i -= 1) {
    combat.tracers[i].life -= dt;
    if (combat.tracers[i].life <= 0) combat.tracers.splice(i, 1);
  }
  // Ammo crates: walk over one to restock; it comes back after 30 seconds.
  if (!state.player.inCar && state.hasPistol) {
    for (const crate of combat.crates) {
      if (crate.respawn > 0) {
        crate.respawn -= dt;
        continue;
      }
      if (Math.hypot(crate.x - state.player.x, crate.y - state.player.y) < 44) {
        combat.ammo = PISTOL_MAX_AMMO;
        crate.respawn = CRATE_RESPAWN;
        return 'ammo';
      }
    }
  }
  let event = null;
  if (actions & ACTION_PUNCH) event = punch(state) ?? event;
  if ((mouse && mouse.clicked) || (actions & ACTION_FIRE)) {
    const shot = shoot(state);
    if (shot) event = shot;
  }
  const incoming = policeReturnFire(state, dt);
  if (incoming === 'police-shot-hit') event = incoming;
  return event;
}

/** Draw the combat layer in world space: ammo crates, tracers, muzzle flash, gun. */
export function drawCombat(context, state) {
  const combat = state.combat;
  for (const crate of combat.crates) {
    if (crate.respawn > 0) continue;
    context.save();
    context.translate(crate.x, crate.y);
    context.fillStyle = 'rgba(0,0,0,0.35)';
    context.fillRect(-14, -10, 32, 28);
    context.fillStyle = '#3f7a3a';
    context.fillRect(-16, -12, 32, 24);
    context.strokeStyle = '#ffd23f';
    context.lineWidth = 2;
    context.strokeRect(-16, -12, 32, 24);
    context.fillStyle = '#ffd23f';
    context.font = 'bold 9px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('AMMO', 0, 0);
    context.restore();
  }
  for (const t of combat.tracers) {
    context.save();
    context.globalAlpha = Math.max(0, t.life / t.maxLife);
    context.strokeStyle = t.color;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(t.x1, t.y1);
    context.lineTo(t.x2, t.y2);
    context.stroke();
    context.restore();
  }
  if (combat.muzzle > 0 && !state.player.inCar && state.hasPistol) {
    const p = state.player;
    const gx = p.x + Math.cos(combat.aimAngle) * 22;
    const gy = p.y + Math.sin(combat.aimAngle) * 22;
    context.save();
    context.globalAlpha = Math.min(1, combat.muzzle / 0.07);
    context.fillStyle = '#ffe08a';
    context.beginPath();
    context.arc(gx, gy, 9, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(gx, gy, 4, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
  if (!state.player.inCar && state.hasPistol) {
    const p = state.player;
    context.save();
    context.translate(p.x, p.y);
    context.rotate(combat.aimAngle);
    context.fillStyle = '#222222';
    context.fillRect(10, -3, 16, 6);
    context.restore();
  }
}
