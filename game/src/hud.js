// The HUD: health, cash, wanted stars, clock, speed, the mission objective, a
// scrolling feed of what just happened, and the minimap — a live top-down sketch
// of Puerto Solmar with roads, the player, police and the mission marker.

import { FONT, PALETTE, WORLD } from './config.js';
import { PISTOL_MAX_AMMO } from './combat.js';
import { formatClock } from './world.js';
import { missionObjectiveText } from './missions.js';

const VIEW_W = 1280;
const VIEW_H = 720;
const MAP_W = 220;
const MAP_H = 158;

function drawStars(context, wanted) {
  for (let i = 0; i < 5; i += 1) {
    const x = 24 + i * 34;
    const y = 66;
    context.font = `26px ${FONT}`;
    context.textAlign = 'left';
    context.textBaseline = 'middle';
    context.fillStyle = i < wanted ? PALETTE.hudGold : 'rgba(255,255,255,0.25)';
    context.fillText('★', x, y);
  }
}

function drawMinimap(context, state) {
  const x0 = VIEW_W - MAP_W - 16;
  const y0 = VIEW_H - MAP_H - 16;
  const sx = MAP_W / WORLD.width;
  const sy = MAP_H / WORLD.height;
  context.fillStyle = 'rgba(10,16,24,0.78)';
  context.fillRect(x0 - 4, y0 - 4, MAP_W + 8, MAP_H + 8);
  context.strokeStyle = 'rgba(255,255,255,0.35)';
  context.lineWidth = 1;
  context.strokeRect(x0 - 4, y0 - 4, MAP_W + 8, MAP_H + 8);
  // Water and sand at the bottom.
  context.fillStyle = '#1f6f8f';
  context.fillRect(x0, y0 + 2280 * sy, MAP_W, MAP_H - 2280 * sy);
  context.fillStyle = '#d9c184';
  context.fillRect(x0, y0 + 2280 * sy - 6, MAP_W, 6);
  // Roads.
  context.strokeStyle = '#9aa0a8';
  context.lineWidth = 2;
  for (const x of state.city.lines.vertical) {
    context.beginPath();
    context.moveTo(x0 + x * sx, y0);
    context.lineTo(x0 + x * sx, y0 + 2280 * sy);
    context.stroke();
  }
  for (const y of state.city.lines.horizontal) {
    context.beginPath();
    context.moveTo(x0, y0 + y * sy);
    context.lineTo(x0 + MAP_W, y0 + y * sy);
    context.stroke();
  }
  // Mission marker (evade stages have no marker — the job is to lay low).
  if (state.mission.status === 'active') {
    const stage = state.mission.stages[state.mission.stageIndex];
    if (stage && stage.kind !== 'evade') {
      const pulse = 4 + Math.sin(state.elapsed * 5) * 2;
      context.fillStyle = PALETTE.marker;
      context.beginPath();
      context.arc(x0 + stage.x * sx, y0 + stage.y * sy, pulse, 0, Math.PI * 2);
      context.fill();
    }
  }
  // Police: the patrol cars and the roadblock.
  context.fillStyle = '#2d7bff';
  const policeDots = [];
  if (state.police.car && state.police.car.active) policeDots.push(state.police.car);
  if (state.police.extra && state.police.extra.active) policeDots.push(state.police.extra);
  if (state.police.roadblock) {
    for (const car of state.police.roadblock) if (car.active) policeDots.push(car);
  }
  for (const car of policeDots) {
    context.beginPath();
    context.arc(x0 + car.x * sx, y0 + car.y * sy, 4, 0, Math.PI * 2);
    context.fill();
  }
  // Player.
  const px = state.player.inCar ? state.player.inCar.x : state.player.x;
  const py = state.player.inCar ? state.player.inCar.y : state.player.y;
  context.fillStyle = '#ffffff';
  context.beginPath();
  context.arc(x0 + px * sx, y0 + py * sy, 5, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = PALETTE.player;
  context.beginPath();
  context.arc(x0 + px * sx, y0 + py * sy, 3.5, 0, Math.PI * 2);
  context.fill();
  context.font = `11px ${FONT}`;
  context.fillStyle = PALETTE.hudMuted;
  context.textAlign = 'right';
  context.fillText('PUERTO SOLMAR', x0 + MAP_W, y0 - 8);
}

/** Draw the whole HUD in screen space (1280x720 logical) on the given context. */
export function drawHud(context, state) {
  context.save();
  context.textBaseline = 'alphabetic';
  // Top-left: cash, health, wanted stars.
  context.fillStyle = PALETTE.hudPanel;
  context.fillRect(12, 12, 300, 96);
  context.font = `bold 26px ${FONT}`;
  context.fillStyle = PALETTE.hudGreen;
  context.textAlign = 'left';
  context.fillText(`$${state.cash}`, 24, 44);
  context.font = `15px ${FONT}`;
  context.fillStyle = PALETTE.hudMuted;
  context.fillText('CASH', 110, 42);
  // Health bar.
  context.fillStyle = 'rgba(255,255,255,0.18)';
  context.fillRect(24, 54, 160, 12);
  context.fillStyle = state.player.health > 40 ? PALETTE.hudGreen : PALETTE.hudRed;
  context.fillRect(24, 54, 160 * Math.max(0, state.player.health / 100), 12);
  context.font = `13px ${FONT}`;
  context.fillStyle = PALETTE.hudText;
  context.fillText(`HEALTH ${Math.round(state.player.health)}`, 192, 65);
  if (state.hasPistol) {
    context.fillStyle = state.combat.ammo > 0 ? PALETTE.hudGold : PALETTE.hudRed;
    context.fillText(`PISTOL ${state.combat.ammo}/${PISTOL_MAX_AMMO}`, 24, 90);
  }
  drawStars(context, state.wanted);

  // Top-right: clock and district.
  context.fillStyle = PALETTE.hudPanel;
  context.fillRect(VIEW_W - 212, 12, 200, 52);
  context.font = `bold 24px ${FONT}`;
  context.fillStyle = PALETTE.hudText;
  context.textAlign = 'right';
  context.fillText(formatClock(state.clockMinutes), VIEW_W - 24, 40);
  context.font = `13px ${FONT}`;
  context.fillStyle = PALETTE.hudMuted;
  context.fillText(state.districtName || 'Puerto Solmar', VIEW_W - 24, 58);

  // Objective line under the clock.
  const objective = missionObjectiveText(state);
  context.font = `16px ${FONT}`;
  const ow = context.measureText(objective).width + 24;
  context.fillStyle = 'rgba(10,16,24,0.72)';
  context.fillRect(VIEW_W - ow - 12, 72, ow, 30);
  context.fillStyle = state.mission.status === 'active' ? PALETTE.hudGold : PALETTE.hudMuted;
  context.textAlign = 'right';
  context.fillText(objective, VIEW_W - 24, 93);

  // Bottom-left: speed + feed.
  const speed = state.player.inCar ? Math.abs(Math.round(state.player.inCar.speed * 0.28)) : 0;
  context.font = `bold 34px ${FONT}`;
  context.fillStyle = PALETTE.hudText;
  context.textAlign = 'left';
  context.fillText(`${speed}`, 24, VIEW_H - 24);
  context.font = `14px ${FONT}`;
  context.fillStyle = PALETTE.hudMuted;
  const footHint = state.hasPistol
    ? 'ON FOOT — E near a car to get in · F punch · click/J shoot'
    : 'ON FOOT — E near a car to get in';
  context.fillText(state.player.inCar ? 'KM/H — SPACE handbrake, E to get out' : footHint, 84, VIEW_H - 26);
  // Feed: last three events.
  context.font = `15px ${FONT}`;
  const feed = state.feed.slice(-3);
  feed.forEach((line, i) => {
    context.fillStyle = `rgba(242,240,230,${0.95 - i * 0.25})`;
    context.fillText(line, 24, VIEW_H - 84 - (feed.length - 1 - i) * 22);
  });

  drawMinimap(context, state);
  context.restore();
}
