// Solmar Heat — every tuning number and colour in one place.
// The world is a fixed-size coastal city; the renderer shows a camera window of it.

export const STEP = 1 / 60;

export const WORLD = {
  width: 3600,
  height: 2600,
  roadSpacing: 400,
  roadWidth: 96,
  blockMargin: 24,
  beachY: 2280,
  waterY: 2460,
};

export const PLAYER = {
  radius: 14,
  walkSpeed: 230,
  runSpeed: 330,
  health: 100,
};

export const CAR = {
  length: 54,
  width: 26,
  accel: 420,
  brake: 700,
  reverseAccel: 260,
  maxSpeed: 520,
  maxReverse: 160,
  steer: 3.6,
  grip: 6.5,
  handbrakeGrip: 2.2,
};

export const TRAFFIC_COUNT = 14;
export const PED_COUNT = 26;
export const PARKED_COUNT = 10;

export const WANTED_MAX = 5;

export const MISSION_REWARD = 250;

export const PALETTE = {
  backdrop: '#0d1520',
  grass: '#4d7a44',
  parkGrass: '#5d8f4e',
  sand: '#d9c184',
  water: '#1f6f8f',
  waterDeep: '#155a75',
  road: '#33373d',
  roadEdge: '#565c66',
  lane: '#c8b45a',
  sidewalk: '#8a8f96',
  plaza: '#b9a98a',
  dockWood: '#7a5c38',
  buildingRoof: ['#b0563f', '#4f7a9e', '#8a6f4d', '#5f8a5a', '#9e5f7a', '#6b5f9e', '#c08a3f'],
  buildingWall: '#e8ddc8',
  buildingShadow: 'rgba(0,0,0,0.35)',
  player: '#ffd23f',
  playerOutline: '#1a1a1a',
  ped: ['#e5534b', '#4fc3f7', '#f2c94c', '#9b7ede', '#7ed491', '#f28bb1'],
  copCar: '#2f6fd0',
  copLightRed: '#ff2d2d',
  copLightBlue: '#2d7bff',
  marker: '#ffcf3f',
  hudPanel: 'rgba(10,16,24,0.72)',
  hudText: '#f2f0e6',
  hudMuted: '#aab4bd',
  hudGreen: '#7ed491',
  hudRed: '#ff5a4e',
  hudGold: '#ffcf3f',
  titleSky: '#ff9e5e',
  titleSun: '#ffd23f',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const SAVE_KEY = 'solmar-heat.save.v1';

export const DISTRICTS = [
  { name: 'Old Town', x: 0, y: 0, w: 1200, h: 800 },
  { name: 'Marina District', x: 1200, y: 0, w: 1200, h: 800 },
  { name: 'Downtown', x: 2400, y: 0, w: 1200, h: 800 },
  { name: 'Palm Heights', x: 0, y: 800, w: 1200, h: 800 },
  { name: 'Central Plaza', x: 1200, y: 800, w: 1200, h: 800 },
  { name: 'Harbor Docks', x: 2400, y: 800, w: 1200, h: 1480 },
  { name: 'Sunset Beach', x: 0, y: 1600, w: 2400, h: 1000 },
];
