// Puerto Solmar itself: a procedural coastal city on a road grid, plus the people
// who walk it. No drawing here — geometry, collision and the pedestrians' wandering.
// Roads run on a 400-unit grid; the blocks between them hold buildings, one park,
// one plaza and the harbour docks; the south edge is beach and open water.

import { PALETTE, PED_COUNT, WORLD } from './config.js';

export const EVENT_PED_HIT = 1;

/** Vertical and horizontal road centre lines, in world units. */
export function roadLines() {
  const vertical = [];
  const horizontal = [];
  for (let x = 200; x <= WORLD.width - 200; x += WORLD.roadSpacing) vertical.push(x);
  for (let y = 200; y <= WORLD.beachY - 80; y += WORLD.roadSpacing) horizontal.push(y);
  return { vertical, horizontal };
}

function blockRect(col, row) {
  const lines = roadLines();
  const x0 = lines.vertical[col] + WORLD.roadWidth / 2 + WORLD.blockMargin;
  const x1 = lines.vertical[col + 1] - WORLD.roadWidth / 2 - WORLD.blockMargin;
  const y0 = lines.horizontal[row] + WORLD.roadWidth / 2 + WORLD.blockMargin;
  const y1 = lines.horizontal[row + 1] - WORLD.roadWidth / 2 - WORLD.blockMargin;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Build the whole city from a seeded random: buildings, trees, park, plaza, docks. */
export function buildCity(random) {
  const lines = roadLines();
  const buildings = [];
  const trees = [];
  const crates = [];
  const cols = lines.vertical.length - 1;
  const rows = lines.horizontal.length - 1;
  const parkBlock = { col: 1, row: 2 };
  const plazaBlock = { col: 4, row: 2 };

  for (let col = 0; col < cols; col += 1) {
    for (let row = 0; row < rows; row += 1) {
      const block = blockRect(col, row);
      if (col === parkBlock.col && row === parkBlock.row) {
        for (let i = 0; i < 14; i += 1) {
          trees.push({
            x: block.x + random.range(20, block.w - 20),
            y: block.y + random.range(20, block.h - 20),
            r: random.range(10, 18),
          });
        }
        continue;
      }
      if (col === plazaBlock.col && row === plazaBlock.row) {
        for (let i = 0; i < 6; i += 1) {
          const a = (i / 6) * Math.PI * 2;
          trees.push({ x: block.x + block.w / 2 + Math.cos(a) * 90, y: block.y + block.h / 2 + Math.sin(a) * 70, r: 12 });
        }
        continue;
      }
      const count = random.int(2, 4);
      for (let i = 0; i < count; i += 1) {
        const bw = random.range(70, 120);
        const bh = random.range(70, 120);
        const bx = block.x + random.range(0, Math.max(1, block.w - bw));
        const by = block.y + random.range(0, Math.max(1, block.h - bh));
        buildings.push({
          x: bx, y: by, w: bw, h: bh,
          roof: random.pick(PALETTE.buildingRoof),
          height: random.range(8, 26),
          windows: random.int(2, 4),
        });
      }
    }
  }

  // Harbour docks: piers and crates along the east strip past the last road.
  const dockX = lines.vertical[lines.vertical.length - 1] + WORLD.roadWidth / 2 + 20;
  for (let p = 0; p < 3; p += 1) {
    const py = 300 + p * 520;
    for (let i = 0; i < 5; i += 1) {
      crates.push({ x: dockX + random.range(0, 90), y: py + random.range(0, 180), w: 26, h: 26 });
    }
  }

  return {
    lines, buildings, trees, crates,
    park: blockRect(parkBlock.col, parkBlock.row),
    plaza: blockRect(plazaBlock.col, plazaBlock.row),
    docks: { x: dockX, y: 240, w: WORLD.width - dockX, h: 1900 },
    beach: { y: WORLD.beachY },
    water: { y: WORLD.waterY },
  };
}

export function isWater(city, x, y) {
  return y >= city.water.y;
}

export function isBeach(city, x, y) {
  return y >= city.beach.y && y < city.water.y;
}

export function pointInBuilding(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

/** True when a circle of radius r at (x, y) overlaps a building, crate or the map edge. */
export function circleHitsSolid(city, x, y, r) {
  if (x < r || y < r || x > WORLD.width - r || y > WORLD.height - r) return true;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r) return true;
  }
  for (const c of city.crates) {
    const cx = Math.max(c.x, Math.min(x, c.x + c.w));
    const cy = Math.max(c.y, Math.min(y, c.y + c.h));
    if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r) return true;
  }
  return false;
}

/** Move a circle out of solid geometry along the axis it came from; returns corrected x,y. */
export function slideOutOfSolid(city, x, y, r, prevX, prevY) {
  let nx = x;
  let ny = y;
  if (circleHitsSolid(city, nx, prevY, r)) nx = prevX;
  if (circleHitsSolid(city, nx, ny, r)) ny = prevY;
  if (circleHitsSolid(city, nx, ny, r)) { nx = prevX; ny = prevY; }
  return { x: nx, y: ny };
}

function nearestLine(lines, value) {
  let best = lines[0];
  for (const line of lines) if (Math.abs(line - value) < Math.abs(best - value)) best = line;
  return best;
}

/** Snap a point onto the nearest road centre line, keeping the other coordinate. */
export function nearestRoadPoint(city, x, y) {
  const vx = nearestLine(city.lines.vertical, x);
  const hy = nearestLine(city.lines.horizontal, y);
  if (Math.abs(vx - x) <= Math.abs(hy - y)) return { x: vx, y, axis: 'v', line: vx };
  return { x, y: hy, axis: 'h', line: hy };
}

export function randomRoadPoint(city, random) {
  if (random.chance(0.5)) {
    return { x: random.pick(city.lines.vertical), y: random.range(120, WORLD.beachY - 120), axis: 'v' };
  }
  return { x: random.range(120, WORLD.width - 120), y: random.pick(city.lines.horizontal), axis: 'h' };
}

/** A point on a sidewalk beside a random road, where pedestrians walk. */
export function randomSidewalkPoint(city, random) {
  const p = randomRoadPoint(city, random);
  const off = WORLD.roadWidth / 2 + 14;
  if (p.axis === 'v') return { x: p.x + (random.chance(0.5) ? off : -off), y: p.y };
  return { x: p.x, y: p.y + (random.chance(0.5) ? off : -off) };
}

export function createPedestrians(city, random, count = PED_COUNT) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const p = randomRoadPoint(city, random);
    // Remember which road the pedestrian walks along, so they stroll down one
    // sidewalk instead of cutting across traffic to a faraway point. They walk
    // a step past the sidewalk's edge, so a car turning a corner cannot clip them.
    const off = WORLD.roadWidth / 2 + 26;
    const side = random.chance(0.5) ? 1 : -1;
    const pos = p.axis === 'v'
      ? { x: p.x + side * off, y: p.y }
      : { x: p.x, y: p.y + side * off };
    peds.push({
      x: pos.x, y: pos.y,
      tx: pos.x, ty: pos.y,
      axis: p.axis,
      line: p.axis === 'v' ? p.x : p.y,
      side,
      speed: random.range(45, 85),
      color: random.pick(PALETTE.ped),
      walkPhase: random.range(0, Math.PI * 2),
      down: false,
    });
  }
  return peds;
}

function pickPedTarget(city, random, ped) {
  // A new point further along the same sidewalk, never across a road.
  const off = WORLD.roadWidth / 2 + 26;
  const span = ped.axis === 'v' ? { min: 140, max: WORLD.beachY - 140 } : { min: 140, max: WORLD.width - 140 };
  const along = random.range(span.min, span.max);
  if (ped.axis === 'v') {
    ped.tx = ped.line + ped.side * off;
    ped.ty = along;
  } else {
    ped.tx = along;
    ped.ty = ped.line + ped.side * off;
  }
}

/** Pedestrians stroll between sidewalk points; returns EVENT_PED_HIT when the
 * PLAYER's car runs one over (traffic accidents are not the player's crime). */
export function updatePedestrians(city, peds, playerCar, dt, random) {
  let events = 0;
  for (const ped of peds) {
    if (ped.down) continue;
    const dx = ped.tx - ped.x;
    const dy = ped.ty - ped.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 12) {
      pickPedTarget(city, random, ped);
      continue;
    }
    ped.x += (dx / dist) * ped.speed * dt;
    ped.y += (dy / dist) * ped.speed * dt;
    ped.walkPhase += dt * 8;
    const car = playerCar;
    if (car && car.active && Math.abs(car.speed) >= 60) {
      const lx = Math.cos(-car.angle) * (ped.x - car.x) - Math.sin(-car.angle) * (ped.y - car.y);
      const ly = Math.sin(-car.angle) * (ped.x - car.x) + Math.cos(-car.angle) * (ped.y - car.y);
      if (Math.abs(lx) < 30 && Math.abs(ly) < 18) {
        ped.down = true;
        events |= EVENT_PED_HIT;
      }
    }
  }
  return events;
}

/** Floating dust / smoke / spark particles, kept in state.particles. */
export function spawnParticle(state, x, y, vx, vy, life, color, size) {
  state.particles.push({ x, y, vx, vy, life, maxLife: life, color, size });
}

export function updateParticles(state, dt) {
  const list = state.particles;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const p = list[i];
    p.life -= dt;
    if (p.life <= 0) {
      list.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
  }
  if (state.skid.length > 400) state.skid.splice(0, state.skid.length - 400);
}

/** Format the in-game clock (minutes since midnight) as HH:MM. */
export function formatClock(minutes) {
  const total = Math.floor(minutes) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
