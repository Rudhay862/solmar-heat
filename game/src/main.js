// Solmar Heat — boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there. The game
// moves between four screens: title, play, paused and game over.
//
// ?seed=N fixes the city. ?shot=start|play|mission|chase (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady.
// ?debug=1 exposes the live state as window.__solmar for headless play-testing.

import { DISTRICTS, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  buildCity, createPedestrians, formatClock, isWater, updateParticles, updatePedestrians,
  EVENT_PED_HIT,
} from './world.js';
import {
  ACTION_CONFIRM, ACTION_ENTER_EXIT, ACTION_MISSION, ACTION_PAUSE, createInput,
} from './input.js';
import { createPlayer, exitCar, stepPlayer } from './player.js';
import {
  createCar, resolveCarCollisions, spawnParkedCars, spawnTraffic, starterCarSpot,
  stepDrivenCar, stepTrafficCar,
} from './vehicles.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { drawHud } from './hud.js';
import { createMissionState, ARC_MISSIONS, missionObjectiveText, startMissionById, startNextMission, stepMission } from './missions.js';
import { createPoliceState, raiseWanted, stepPolice, stepWanted } from './police.js';
import { PISTOL_MAX_AMMO, createCombatState, spawnAmmoCrates, stepCombat } from './combat.js';
import { createAudio } from './audio.js';
import { clearSave, readBestCash, readSave, writeSave } from './save.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const SAVE_EVERY = 10;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1337;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();

/** Build a fresh game state: city, player, traffic, parked cars, pedestrians. */
export function createGameState(fixedSeed) {
  const random = createRandom(fixedSeed);
  const city = buildCity(random);
  const spot = starterCarSpot(city);
  const player = createPlayer(620, 600);
  const cars = [];
  cars.push(...spawnTraffic(city, random));
  cars.push(...spawnParkedCars(city, random));
  // The player's first ride: a red sedan waiting on the avenue.
  const starter = createCar(spot.x, spot.y, spot.angle, '#d94f3d', { owned: true, parked: true });
  cars.push(starter);
  const state = {
    random,
    city,
    player,
    cars,
    peds: createPedestrians(city, random),
    police: createPoliceState(),
    mission: createMissionState(),
    combat: createCombatState(),
    hasPistol: false,
    cash: 0,
    bestCash: readBestCash(),
    wanted: 0,
    wantedTimer: 0,
    clockMinutes: 480,
    elapsed: 0,
    feed: ['Welcome to Puerto Solmar. Press M for your first job.'],
    particles: [],
    skid: [],
    districtName: 'Old Town',
    saveTimer: SAVE_EVERY,
    starterCar: starter,
  };
  spawnAmmoCrates(state);
  return state;
}

function districtAt(state, x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.name;
  }
  return 'Puerto Solmar';
}

function pushFeed(state, line) {
  state.feed.push(line);
  if (state.feed.length > 12) state.feed.splice(0, state.feed.length - 12);
}

/** One fixed step of the whole game. Returns nothing; events land in state.feed. */
function stepGame(state, dt, input, actions, mouse = { x: 0, y: 0, clicked: false }) {
  state.elapsed += dt;
  state.clockMinutes += dt * 1;
  if (state.clockMinutes >= 24 * 60) state.clockMinutes -= 24 * 60;

  const focusX = state.player.inCar ? state.player.inCar.x : state.player.x;
  const focusY = state.player.inCar ? state.player.inCar.y : state.player.y;
  state.districtName = districtAt(state, focusX, focusY);

  // Player: drive, walk, get in and out of cars.
  if (state.player.inCar) {
    if (actions & ACTION_ENTER_EXIT) {
      const result = exitCar(state.player, state.city);
      if (result === 'exited-car') pushFeed(state, 'You got out of the car.');
    } else {
      stepDrivenCar(state.player.inCar, input, state.city, dt, state);
    }
  } else {
    const event = stepPlayer(state.player, input, state.cars, state.city, dt, () => {
      raiseWanted(state, 1);
      pushFeed(state, 'You stole a car — the police are coming!');
      audio.crash();
    }, actions);
    if (event === 'entered-car') pushFeed(state, 'You got in the car. W A S D to drive.');
  }

  // Traffic and police.
  for (const car of state.cars) stepTrafficCar(car, state.city, state.random, state.cars, dt);
  const rammed = stepPolice(state, dt, state.random);
  if (rammed === 'rammed') {
    pushFeed(state, 'Police rammed you!');
    audio.crash();
  }
  stepWanted(state, dt);

  // Pedestrians: running one over is a crime.
  const pedEvents = updatePedestrians(state.city, state.peds, state.player.inCar, dt, state.random);
  if (pedEvents & EVENT_PED_HIT) {
    raiseWanted(state, 1);
    pushFeed(state, 'You hit a pedestrian! Wanted level up.');
    audio.crash();
  }

  resolveCarCollisions(state.cars, state);

  // Combat on foot: punches, the pistol, ammo crates, police return fire.
  const combatEvent = stepCombat(state, dt, input, actions, mouse);
  if (combatEvent === 'punched') pushFeed(state, 'You decked someone!');
  else if (combatEvent === 'no-ammo') pushFeed(state, 'Out of ammo — find a green AMMO crate.');
  else if (combatEvent === 'ammo') pushFeed(state, 'Ammo restocked.');
  else if (combatEvent === 'shot-ped') {
    pushFeed(state, 'You shot a pedestrian! Wanted level up.');
    audio.crash();
  } else if (combatEvent === 'shot-cop') {
    pushFeed(state, 'You shot a patrol car! Wanted level up.');
    audio.crash();
  } else if (combatEvent === 'police-shot-hit') {
    pushFeed(state, 'Police shot you!');
    audio.crash();
  }

  // Missions.
  const missionEvent = stepMission(state, dt);
  if (missionEvent === 'stage') {
    pushFeed(state, `Objective updated: ${missionObjectiveText(state)}`);
    audio.pickup();
  } else if (missionEvent === 'complete') {
    pushFeed(state, `Job complete — $${state.mission.reward} in your pocket.`);
    if (state.mission.id === 'first-delivery' && !state.hasPistol) {
      state.hasPistol = true;
      state.combat.ammo = PISTOL_MAX_AMMO;
      pushFeed(state, 'Marisol gave you a pistol — click or J to fire, F to punch.');
    }
    audio.mission();
  } else if (missionEvent === 'failed') {
    pushFeed(state, 'Job failed — too slow. Press M to retry.');
    audio.crash();
  }

  // Skid marks fade; particles drift.
  for (let i = state.skid.length - 1; i >= 0; i -= 1) {
    state.skid[i].life -= dt;
    if (state.skid[i].life <= 0) state.skid.splice(i, 1);
  }
  updateParticles(state, dt);

  // Sound follows the car and the sirens.
  const driving = state.player.inCar;
  audio.setEngine(driving ? state.player.inCar.speed : 0, driving);
  audio.setSiren(state.wanted >= 1 && state.police.car !== null);

  // Autosave while playing.
  state.saveTimer -= dt;
  if (state.saveTimer <= 0) {
    state.saveTimer = SAVE_EVERY;
    writeSave(state);
  }
}

function applySave(state, save) {
  state.cash = save.cash ?? 0;
  state.player.health = save.health ?? 100;
  state.player.x = save.x ?? 620;
  state.player.y = save.y ?? 600;
  state.wanted = save.wanted ?? 0;
  state.wantedTimer = state.wanted > 0 ? 25 : 0;
  state.clockMinutes = save.clockMinutes ?? 480;
  if (save.missionStatus === 'active' && save.missionId) {
    if (startMissionById(state, save.missionId)) {
      state.mission.stageIndex = Math.min(save.missionStage ?? 0, state.mission.stages.length - 1);
    }
  }
  if (typeof save.missionCompleted === 'number') {
    state.mission.completedIds = ARC_MISSIONS.slice(0, Math.max(0, Math.min(ARC_MISSIONS.length, save.missionCompleted)));
  }
}

function runShot(name) {
  try {
    const state = createGameState(seed);
    // ?debug=1 exposes the staged state for headless determinism checks.
    if (params.get('debug') === '1') {
      window.__solmar = { get state() { return state; } };
    }
    const renderer = createRenderer(canvas);
    const scene = stageShot(name, state, (dt, input) => stepGame(state, dt, input, 0, { x: 0, y: 0, clicked: false }));
    renderer.snapCamera(state);
    let painted = 0;
    function paint() {
      const drawn = renderer.draw(state, scene.screen);
      if (scene.screen === SCREEN_PLAY) drawHud(drawn.context, state);
      painted += 1;
      if (painted < 2) requestAnimationFrame(paint);
      else window.__shotReady = true;
    }
    requestAnimationFrame(paint);
  } catch (error) {
    window.__shotError = String(error && error.message ? error.message : error);
  }
}

function runGame() {
  const input = createInput(canvas);
  const renderer = createRenderer(canvas);
  let state = createGameState(seed);
  let screen = SCREEN_TITLE;
  let continueRequested = false;

  // ?debug=1 exposes the live state for headless play-testing (never used by the game itself).
  if (params.get('debug') === '1') {
    window.__solmar = { get state() { return state; } };
  }

  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyC' && !event.repeat) continueRequested = true;
    if (event.code === 'Enter' || event.code === 'Space') audio.unlock();
  });
  canvas.addEventListener('pointerdown', () => audio.unlock());

  function announce(message) {
    status.textContent = message;
  }

  function startNewGame() {
    clearSave();
    input.takeMouse(); // drain any click that started the game, so it never fires the pistol
    state = createGameState(Math.floor(Math.random() * 4294967296));
    renderer.snapCamera(state);
    screen = SCREEN_PLAY;
    announce('Playing. Steal a car, take a job with M.');
  }

  function continueGame() {
    const save = readSave();
    input.takeMouse();
    state = createGameState(seed);
    if (save) {
      applySave(state, save);
      pushFeed(state, 'Welcome back to Puerto Solmar.');
    }
    renderer.snapCamera(state);
    screen = SCREEN_PLAY;
    announce('Continuing your save.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (state.cash > state.bestCash) state.bestCash = state.cash;
    writeSave(state);
    announce(`Game over. You banked $${state.cash}.`);
  }

  let accumulator = 0;
  let last = performance.now();

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();

    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startNewGame();
      else if (continueRequested) { continueRequested = false; continueGame(); }
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        writeSave(state);
        announce('Paused.');
      } else if (actions & ACTION_MISSION) {
        const msg = startNextMission(state);
        if (msg) {
          pushFeed(state, msg);
          audio.mission();
        }
      }
      // Mouse aim: the pistol points at the cursor in world space.
      const mouse = input.takeMouse();
      if ((mouse.x !== 0 || mouse.y !== 0) && !state.player.inCar) {
        const focusX = state.player.x;
        const focusY = state.player.y;
        const world = renderer.worldFromScreen(mouse.x, mouse.y);
        state.combat.aimAngle = Math.atan2(world.y - focusY, world.x - focusX);
      }
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        stepGame(state, STEP, input, actions, mouse);
        accumulator -= STEP;
        if (state.player.health <= 0) { endGame(); break; }
      }
      if (screen !== SCREEN_PLAY) accumulator = 0;
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      accumulator = 0;
    } else if (screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) startNewGame();
      accumulator = 0;
    }

    if (screen === SCREEN_TITLE) {
      // The city idles behind the menu.
      while (accumulator >= STEP) {
        stepGame(state, STEP, input, 0);
        accumulator -= STEP;
      }
    }

    const drawn = renderer.draw(state, screen);
    if (screen === SCREEN_PLAY) drawHud(drawn.context, state);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      writeSave(state);
      announce('Paused.');
    }
  });

  announce('Solmar Heat. Press Enter to start, C to continue your save.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
