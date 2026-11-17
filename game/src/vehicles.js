// Cars: the player's drivable car, parked cars waiting to be stolen, and traffic
// that drives the road grid. Driving is arcade physics — accelerate, steer, drift
// with the handbrake — and every car leaves skid marks when it slides.

import { CAR, PARKED_COUNT, TRAFFIC_COUNT, WORLD } from './config.js';
import { circleHitsSolid, isWater, nearestRoadPoint, randomRoadPoint, slideOutOfSolid } from './world.js';

export const CAR_COLORS = ['#d94f3d', '#3d7ad9', '#e8c33a', '#7a4fd9', '#3fae6a', '#e8e8e8', '#2b2b2b', '#d97ab0', '#3fb8ae'];

export function createCar(x, y, angle, color, opts = {}) {
  return {
    x, y, angle,
    speed: 0,
    color,
    active: true,
    driven: false,
    owned: opts.owned ?? false,
    parked: opts.parked ?? false,
    traffic: opts.traffic ?? false,
    // Traffic AI state: which road axis it follows and where it is heading.
    axis: opts.axis ?? 'v',
    targetX: x,
    targetY: y,
    turnCooldown: 0,
    honked: false,
  };
}

export function spawnTraffic(city, random, count = TRAFFIC_COUNT) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const p = randomRoadPoint(city, random);
    const angle = p.axis === 'v' ? (random.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (random.chance(0.5) ? 0 : Math.PI);
    const car = createCar(p.x, p.y, angle, random.pick(CAR_COLORS), { traffic: true, axis: p.axis });
    pickTrafficTarget(city, random, car);
    cars.push(car);
  }
  return cars;
}

export function spawnParkedCars(city, random, count = PARKED_COUNT) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const p = randomRoadPoint(city, random);
    const off = WORLD.roadWidth / 2 + 16;
    const x = p.axis === 'v' ? p.x + (random.chance(0.5) ? off : -off) : p.x;
    const y = p.axis === 'h' ? p.y + (random.chance(0.5) ? off : -off) : p.y;
    const angle = p.axis === 'v' ? (random.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (random.chance(0.5) ? 0 : Math.PI);
    if (circleHitsSolid(city, x, y, 30)) continue;
    cars.push(createCar(x, y, angle, random.pick(CAR_COLORS), { parked: true }));
  }
  return cars;
}

function pickTrafficTarget(city, random, car) {
  // Drive to the far end of the current road, then turn onto a cross street.
  if (car.axis === 'v') {
    const dir = Math.sin(car.angle) > 0 ? 1 : -1;
    const endY = dir > 0 ? WORLD.beachY - 120 : 120;
    const crossY = random.pick(city.lines.horizontal);
    car.targetX = car.x;
    car.targetY = random.chance(0.6) ? crossY : endY;
    car.nextAxis = 'h';
  } else {
    const dir = Math.cos(car.angle) > 0 ? 1 : -1;
    const endX = dir > 0 ? WORLD.width - 120 : 120;
    const crossX = random.pick(city.lines.vertical);
    car.targetX = random.chance(0.6) ? crossX : endX;
    car.targetY = car.y;
    car.nextAxis = 'v';
  }
}

function steerToward(car, tx, ty, dt, maxTurn) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const turn = Math.max(-maxTurn * dt, Math.min(maxTurn * dt, diff));
  car.angle += turn;
}

/** Traffic cars cruise their road, slow for the car ahead, and turn at cross streets. */
export function stepTrafficCar(car, city, random, cars, dt) {
  if (!car.traffic || car.driven) return;
  car.turnCooldown -= dt;
  const dx = car.targetX - car.x;
  const dy = car.targetY - car.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 24 && car.turnCooldown <= 0) {
    car.axis = car.nextAxis ?? (car.axis === 'v' ? 'h' : 'v');
    car.turnCooldown = 1.5;
    pickTrafficTarget(city, random, car);
    return;
  }
  // Slow down when another car is close ahead.
  let aheadClear = true;
  for (const other of cars) {
    if (other === car || !other.active) continue;
    const ox = other.x - car.x;
    const oy = other.y - car.y;
    const forward = ox * Math.cos(car.angle) + oy * Math.sin(car.angle);
    const side = Math.abs(-ox * Math.sin(car.angle) + oy * Math.cos(car.angle));
    if (forward > 0 && forward < 70 && side < 30) { aheadClear = false; break; }
  }
  const cruise = aheadClear ? 170 : 0;
  steerToward(car, car.targetX, car.targetY, dt, 2.2);
  car.speed += (cruise - car.speed) * Math.min(1, dt * 1.5);
  moveCarBody(car, city, dt);
}

/** Move a car body forward by its speed, sliding along buildings and staying on land. */
export function moveCarBody(car, city, dt) {
  const prevX = car.x;
  const prevY = car.y;
  let nx = car.x + Math.cos(car.angle) * car.speed * dt;
  let ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (isWater(city, nx, ny)) {
    nx = prevX;
    ny = prevY;
    car.speed *= 0.4;
  }
  const slid = slideOutOfSolid(city, nx, ny, 26, prevX, prevY);
  if (slid.x === prevX && slid.y === prevY && (nx !== prevX || ny !== prevY)) {
    car.speed *= 0.5; // bonked a wall
  }
  car.x = slid.x;
  car.y = slid.y;
}

/**
 * Drive the player's car for one fixed step. Returns true when the tyres are sliding
 * (so the caller can drop a skid mark), and writes the speed into car.speed.
 */
export function stepDrivenCar(car, input, city, dt, state) {
  const vec = input.vector();
  const throttle = -vec.y; // W / Up is forward
  const steering = vec.x;
  const handbrake = input.braking();

  if (throttle > 0) car.speed += CAR.accel * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 20) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.reverseAccel * dt;
  } else {
    car.speed -= Math.sign(car.speed) * 140 * dt;
    if (Math.abs(car.speed) < 8) car.speed = 0;
  }
  car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));

  const grip = handbrake ? CAR.handbrakeGrip : CAR.grip;
  // The handbrake scrubs speed off as well as loosening the rear end.
  if (handbrake && car.speed !== 0) car.speed -= Math.sign(car.speed) * 300 * dt;
  // Keep a little steering authority even at low speed, so a car never gets
  // stuck mid-turn with no way to swing around.
  const speedFactor = Math.max(0.3, Math.min(1, Math.abs(car.speed) / 220));
  car.angle += steering * CAR.steer * speedFactor * Math.sign(car.speed || 1) * dt * (handbrake ? 1.5 : 1);
  if (handbrake && Math.abs(car.speed) > 120) {
    state.skid.push({ x: car.x, y: car.y, angle: car.angle, life: 6 });
  }
  moveCarBody(car, city, dt);
  return handbrake && Math.abs(car.speed) > 120;
}

/** Push two overlapping cars apart and trade a little speed, so traffic bumps feel real. */
export function resolveCarCollisions(cars, state) {
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      if (!a.active || !b.active) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const min = 52;
      if (dist > 0 && dist < min) {
        const push = (min - dist) / 2;
        const nx = dx / dist;
        const ny = dy / dist;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        const impact = Math.abs(a.speed - b.speed);
        if (impact > 120) {
          a.speed *= 0.7;
          b.speed *= 0.7;
          if (state) {
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            for (let k = 0; k < 4; k += 1) {
              state.particles.push({
                x: mx, y: my,
                vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.5) * 160,
                life: 0.4, maxLife: 0.4, color: '#ffd23f', size: 3,
              });
            }
          }
        }
      }
    }
  }
}

/** The nearest road point to spawn the player car on at a new game. */
export function starterCarSpot(city) {
  const p = nearestRoadPoint(city, 620, 620);
  return { x: p.x, y: p.y, angle: 0 };
}
