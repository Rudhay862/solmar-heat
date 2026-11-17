// The player on foot: walk/run movement with building collision, and getting in
// and out of cars with E. While driving, the player rides inside the car object
// and this module does nothing.

import { PLAYER } from './config.js';
import { circleHitsSolid, isWater, slideOutOfSolid } from './world.js';

export function createPlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    health: PLAYER.health,
    inCar: null,
    moving: false,
    walkPhase: 0,
  };
}

/** Find the nearest car the player could enter (driver's door range). */
export function nearestEnterableCar(player, cars, maxDist = 70) {
  let best = null;
  let bestDist = maxDist;
  for (const car of cars) {
    if (!car.active) continue;
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (d < bestDist) {
      bestDist = d;
      best = car;
    }
  }
  return best;
}

/**
 * Step the player for one fixed step. `actions` are the one-shot flags taken by the
 * loop this frame (ACTION_ENTER_EXIT is bit 4). `onSteal` raises the wanted level
 * when a car is stolen. Returns an event string or null.
 */
export function stepPlayer(player, input, cars, city, dt, onSteal, actions) {
  if (player.inCar) return null;
  const vec = input.vector();
  const speed = input.running() ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const moving = vec.x !== 0 || vec.y !== 0;
  player.moving = moving;
  if (moving) {
    const prevX = player.x;
    const prevY = player.y;
    let nx = player.x + vec.x * speed * dt;
    let ny = player.y + vec.y * speed * dt;
    player.angle = Math.atan2(vec.y, vec.x);
    player.walkPhase += dt * 10;
    if (isWater(city, nx, ny)) {
      nx = prevX;
      ny = prevY;
    }
    const slid = slideOutOfSolid(city, nx, ny, PLAYER.radius, prevX, prevY);
    player.x = slid.x;
    player.y = slid.y;
  }

  if (actions & 4) { // ACTION_ENTER_EXIT
    const car = nearestEnterableCar(player, cars);
    if (car) {
      player.inCar = car;
      car.driven = true;
      if (!car.owned) {
        car.owned = true;
        if (onSteal) onSteal();
        return 'stole-car';
      }
      return 'entered-car';
    }
  }
  return null;
}

/** Step the player out of the car they are driving, beside the driver's door. */
export function exitCar(player, city) {
  const car = player.inCar;
  if (!car) return 'no-car';
  const sideX = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  const sideY = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  let px = sideX;
  let py = sideY;
  if (circleHitsSolid(city, px, py, PLAYER.radius) || isWater(city, px, py)) {
    px = car.x - Math.cos(car.angle + Math.PI / 2) * 34;
    py = car.y - Math.sin(car.angle + Math.PI / 2) * 34;
  }
  if (circleHitsSolid(city, px, py, PLAYER.radius) || isWater(city, px, py)) {
    px = car.x;
    py = car.y - 44;
  }
  player.x = px;
  player.y = py;
  player.inCar = null;
  car.driven = false;
  return 'exited-car';
}
