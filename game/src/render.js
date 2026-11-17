// Drawing only: the world and the screens, pixels out. A camera follows the player
// (or their car) through Puerto Solmar; the 1280x720 view is scaled to the window.
// Buildings get offset shadows, cars get headlights and flashing light bars, the
// mission marker pulses, and a warm tint follows the in-game clock.

import { FONT, PALETTE, WORLD } from './config.js';
import { drawCombat } from './combat.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const VIEW_W = 1280;
const VIEW_H = 720;

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const camera = { x: 640, y: 620 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW_W, height / VIEW_H);
    view.x = (width - VIEW_W * view.scale) / 2;
    view.y = (height - VIEW_H * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align = 'left', baseline = 'alphabetic') {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = baseline;
    context.fillText(value, x, y);
  }

  function focusPoint(state) {
    if (state.player.inCar) return { x: state.player.inCar.x, y: state.player.inCar.y };
    return { x: state.player.x, y: state.player.y };
  }

  function updateCamera(state) {
    const focus = focusPoint(state);
    camera.x += (focus.x - camera.x) * 0.12;
    camera.y += (focus.y - camera.y) * 0.12;
    camera.x = Math.max(VIEW_W / 2, Math.min(WORLD.width - VIEW_W / 2, camera.x));
    camera.y = Math.max(VIEW_H / 2, Math.min(WORLD.height - VIEW_H / 2, camera.y));
  }

  /** Jump the camera straight onto the focus point (screenshot scenes, game start). */
  function snapCamera(state) {
    const focus = focusPoint(state);
    camera.x = Math.max(VIEW_W / 2, Math.min(WORLD.width - VIEW_W / 2, focus.x));
    camera.y = Math.max(VIEW_H / 2, Math.min(WORLD.height - VIEW_H / 2, focus.y));
  }

  function drawGround(state) {
    const city = state.city;
    context.fillStyle = PALETTE.grass;
    context.fillRect(0, 0, WORLD.width, WORLD.height);
    // Beach and water along the south edge.
    context.fillStyle = PALETTE.sand;
    context.fillRect(0, city.beach.y, WORLD.width, city.water.y - city.beach.y);
    context.fillStyle = PALETTE.water;
    context.fillRect(0, city.water.y, WORLD.width, WORLD.height - city.water.y);
    context.fillStyle = PALETTE.waterDeep;
    for (let x = 40; x < WORLD.width; x += 260) {
      context.fillRect(x, city.water.y + 30 + ((x / 260) % 2) * 24, 120, 5);
    }
    // Park and plaza ground.
    context.fillStyle = PALETTE.parkGrass;
    context.fillRect(city.park.x, city.park.y, city.park.w, city.park.h);
    context.fillStyle = PALETTE.plaza;
    context.fillRect(city.plaza.x, city.plaza.y, city.plaza.w, city.plaza.h);
    context.fillStyle = '#c8b88a';
    context.beginPath();
    context.arc(city.plaza.x + city.plaza.w / 2, city.plaza.y + city.plaza.h / 2, 26, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.water;
    context.beginPath();
    context.arc(city.plaza.x + city.plaza.w / 2, city.plaza.y + city.plaza.h / 2, 18, 0, Math.PI * 2);
    context.fill();
    // Docks: wooden piers into the east strip.
    context.fillStyle = PALETTE.dockWood;
    for (let p = 0; p < 3; p += 1) {
      context.fillRect(city.docks.x, 300 + p * 520, 130, 200);
    }
  }

  function drawRoads(state) {
    const city = state.city;
    const hw = WORLD.roadWidth / 2;
    context.fillStyle = PALETTE.sidewalk;
    for (const x of city.lines.vertical) context.fillRect(x - hw - 10, 0, WORLD.roadWidth + 20, city.beach.y);
    for (const y of city.lines.horizontal) context.fillRect(0, y - hw - 10, WORLD.width, WORLD.roadWidth + 20);
    context.fillStyle = PALETTE.road;
    for (const x of city.lines.vertical) context.fillRect(x - hw, 0, WORLD.roadWidth, city.beach.y);
    for (const y of city.lines.horizontal) context.fillRect(0, y - hw, WORLD.width, WORLD.roadWidth);
    // Dashed centre lines.
    context.fillStyle = PALETTE.lane;
    for (const x of city.lines.vertical) {
      for (let y = 20; y < city.beach.y; y += 56) context.fillRect(x - 3, y, 6, 28);
    }
    for (const y of city.lines.horizontal) {
      for (let x = 20; x < WORLD.width; x += 56) context.fillRect(x, y - 3, 28, 6);
    }
    // Street names on the two main avenues.
    context.save();
    context.fillStyle = 'rgba(255,255,255,0.5)';
    context.font = `16px ${FONT}`;
    context.textAlign = 'left';
    context.fillText('AVENIDA DEL SOL', 240, 196);
    context.fillText('CALLE PALMERA', 1240, 596);
    context.restore();
  }

  function drawBuildings(state) {
    const city = state.city;
    for (const b of city.buildings) {
      context.fillStyle = PALETTE.buildingShadow;
      context.fillRect(b.x + b.height * 0.45, b.y + b.height * 0.45, b.w, b.h);
      context.fillStyle = PALETTE.buildingWall;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = b.roof;
      context.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
      context.fillStyle = 'rgba(255,255,255,0.75)';
      const cols = Math.max(1, Math.floor((b.w - 16) / 22));
      const rows = Math.max(1, Math.floor((b.h - 16) / 22));
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          context.fillRect(b.x + 10 + i * 22, b.y + 10 + j * 22, 10, 8);
        }
      }
    }
    for (const t of city.trees) {
      context.fillStyle = 'rgba(0,0,0,0.3)';
      context.beginPath();
      context.arc(t.x + 4, t.y + 5, t.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#2f6b2f';
      context.beginPath();
      context.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#4d8f4d';
      context.beginPath();
      context.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = '#8a6a3f';
    for (const c of city.crates) context.fillRect(c.x, c.y, c.w, c.h);
  }

  function drawMissionMarker(state) {
    const stage = state.mission.status === 'active' ? state.mission.stages[state.mission.stageIndex] : null;
    if (!stage || stage.kind === 'evade') return;
    const pulse = 1 + 0.18 * Math.sin(state.elapsed * 5);
    context.save();
    context.strokeStyle = PALETTE.marker;
    context.lineWidth = 4;
    context.globalAlpha = 0.9;
    context.beginPath();
    context.arc(stage.x, stage.y, stage.radius * pulse, 0, Math.PI * 2);
    context.stroke();
    context.globalAlpha = 0.25;
    context.fillStyle = PALETTE.marker;
    context.beginPath();
    context.arc(stage.x, stage.y, stage.radius * pulse, 0, Math.PI * 2);
    context.fill();
    // A light beam so the marker reads from far away.
    context.globalAlpha = 0.16;
    context.fillRect(stage.x - 6, stage.y - 320, 12, 320);
    context.restore();
    context.save();
    context.translate(stage.x, stage.y);
    context.rotate(Math.PI / 4);
    context.fillStyle = PALETTE.marker;
    context.fillRect(-11, -11, 22, 22);
    context.restore();
  }

  function drawCarShape(car, state) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    context.fillStyle = 'rgba(0,0,0,0.35)';
    context.fillRect(-28, -12, 56, 28);
    context.fillStyle = car.isPolice ? PALETTE.copCar : car.color;
    context.beginPath();
    context.roundRect(-27, -13, 54, 26, 7);
    context.fill();
    context.fillStyle = 'rgba(20,30,40,0.85)';
    context.fillRect(-6, -11, 16, 22);
    context.fillStyle = 'rgba(255,255,255,0.85)';
    context.fillRect(20, -10, 4, 4);
    context.fillRect(20, 6, 4, 4);
    context.fillStyle = '#ff5a4e';
    context.fillRect(-27, -10, 3, 4);
    context.fillRect(-27, 6, 3, 4);
    if (car.isPolice) {
      const flash = Math.floor(state.police.sirenPhase) % 2 === 0;
      context.fillStyle = flash ? PALETTE.copLightRed : PALETTE.copLightBlue;
      context.fillRect(-2, -13, 8, 26);
    }
    context.restore();
    if (car.isPolice) {
      // The POLICE label stays upright whatever way the patrol car faces.
      context.fillStyle = '#ffffff';
      context.font = `bold 9px ${FONT}`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('POLICE', car.x, car.y);
    }
  }

  function drawSkidAndParticles(state) {
    context.save();
    for (const s of state.skid) {
      context.globalAlpha = Math.min(0.5, s.life / 6 * 0.5);
      context.strokeStyle = '#1a1a1a';
      context.lineWidth = 5;
      context.beginPath();
      context.moveTo(s.x - Math.cos(s.angle) * 14, s.y - Math.sin(s.angle) * 14);
      context.lineTo(s.x + Math.cos(s.angle) * 14, s.y + Math.sin(s.angle) * 14);
      context.stroke();
    }
    context.restore();
    for (const p of state.particles) {
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawPedsAndPlayer(state) {
    for (const ped of state.peds) {
      context.save();
      context.translate(ped.x, ped.y);
      if (ped.down) {
        context.fillStyle = '#5a5a5a';
        context.beginPath();
        context.ellipse(0, 0, 14, 8, 0, 0, Math.PI * 2);
        context.fill();
      } else {
        const bob = Math.sin(ped.walkPhase) * 2;
        context.fillStyle = 'rgba(0,0,0,0.3)';
        context.beginPath();
        context.arc(2, 3, 10, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = ped.color;
        context.beginPath();
        context.arc(0, bob * 0.4, 10, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#f2c9a0';
        context.beginPath();
        context.arc(0, bob * 0.4 - 1, 5, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
    }
    const player = state.player;
    if (!player.inCar) {
      const bob = player.moving ? Math.sin(player.walkPhase) * 2 : 0;
      context.save();
      context.translate(player.x, player.y + bob * 0.3);
      context.fillStyle = 'rgba(0,0,0,0.35)';
      context.beginPath();
      context.arc(2, 4, 13, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.player;
      context.strokeStyle = PALETTE.playerOutline;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(0, 0, 13, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.fillStyle = '#1a1a1a';
      context.beginPath();
      context.arc(Math.cos(player.angle) * 7, Math.sin(player.angle) * 7, 4, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }

  function drawDaylight(state) {
    // Warm morning, bright midday, golden evening — a thin tint over the view.
    const minutes = state.clockMinutes;
    let color = null;
    let alpha = 0;
    if (minutes < 600) { color = '#ffb36b'; alpha = 0.10; }
    else if (minutes >= 1020 && minutes < 1140) { color = '#ff9e5e'; alpha = 0.12; }
    else if (minutes >= 1140) { color = '#5a6fd0'; alpha = 0.14; }
    if (!color) return;
    context.fillStyle = color;
    context.globalAlpha = alpha;
    context.fillRect(camera.x - VIEW_W / 2, camera.y - VIEW_H / 2, VIEW_W, VIEW_H);
    context.globalAlpha = 1;
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const height = 150 + lines.length * 34 + 60;
    const x = (VIEW_W - width) / 2;
    const y = (VIEW_H - height) / 2;
    context.fillStyle = 'rgba(10,16,24,0.82)';
    context.fillRect(x, y, width, height);
    context.strokeStyle = accent || PALETTE.hudGold;
    context.lineWidth = 3;
    context.strokeRect(x, y, width, height);
    text(title, VIEW_W / 2, y + 74, 46, PALETTE.hudText, 'center');
    lines.forEach((line, i) => {
      text(line, VIEW_W / 2, y + 128 + i * 34, 20, PALETTE.hudMuted, 'center');
    });
    text(prompt, VIEW_W / 2, y + height - 30, 22, PALETTE.hudGold, 'center');
  }

  /** Paint one frame of the world, then the screen panel for the current screen. */
  function draw(state, screen) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    updateCamera(state);
    const scale = view.scale;
    context.setTransform(scale, 0, 0, scale, view.x - camera.x * scale + (VIEW_W / 2) * scale, view.y - camera.y * scale + (VIEW_H / 2) * scale);
    drawGround(state);
    drawRoads(state);
    drawBuildings(state);
    drawMissionMarker(state);
    drawSkidAndParticles(state);
    for (const car of state.cars) if (car.active) drawCarShape(car, state);
    drawPedsAndPlayer(state);
    drawCombat(context, state);
    drawDaylight(state);

    // HUD and panels draw in screen space.
    context.setTransform(scale, 0, 0, scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      drawPanel('SOLMAR HEAT', [
        'Puerto Solmar — a sun-soaked open-world crime game.',
        'Steal a car with E, drive with W A S D, brake with Space.',
        'Take the delivery job with M. Watch the wanted stars.',
        `Best haul so far: $${state.bestCash}`,
      ], 'Press Enter to start — C to continue your save', PALETTE.hudGold);
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The city waits for you.'], 'Press P to keep driving', PALETTE.hudMuted);
    } else if (screen === SCREEN_OVER) {
      const busted = state.wanted > 0;
      drawPanel(busted ? 'BUSTED' : 'WASTED', [
        busted ? 'The Solmar police finally caught up with you.' : 'That one hurt too much to walk away from.',
        `You banked $${state.cash} this run.`,
      ], 'Press Enter to start over', PALETTE.hudRed);
    }
    return { context, view, camera };
  }

  /**
   * Convert a pointer position in client (CSS) pixels to world coordinates,
   * for mouse aim. Uses the canvas's own box so devicePixelRatio is handled.
   */
  function worldFromScreen(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const deviceX = (clientX - rect.left) * (canvas.width / Math.max(1, rect.width));
    const deviceY = (clientY - rect.top) * (canvas.height / Math.max(1, rect.height));
    return {
      x: camera.x - VIEW_W / 2 + (deviceX - view.x) / view.scale,
      y: camera.y - VIEW_H / 2 + (deviceY - view.y) / view.scale,
    };
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, snapCamera, worldFromScreen };
}
