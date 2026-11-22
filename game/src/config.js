// SHADOW PROTOCOL — configuration and tuning.
// Every magic number for the game lives here so the other modules stay small.
export const TILE = 40;
export const COLS = 32;
export const ROWS = 20;
export const VIEW_W = 1280;
export const VIEW_H = 800;
export const SS = 2; // 2x supersampling: backing store 2560x1600, CSS 1280x800

export const PLAYER_RADIUS = 13;
export const PLAYER_RUN_SPEED = 168;
export const PLAYER_SNEAK_SPEED = 86;
export const GUARD_PATROL_SPEED = 72;
export const GUARD_SUSPICIOUS_SPEED = 98;
export const GUARD_CHASE_SPEED = 138;
export const DOG_PATROL_SPEED = 118;
export const DOG_CHASE_SPEED = 140;
export const CAMERA_SWEEP_SPEED = 0.55;

export const CONE_RANGE = 232;
export const CONE_HALF_ANGLE = 0.62;
export const CAMERA_RANGE = 244;
export const CAMERA_HALF_ANGLE = 0.52;
export const DOG_RANGE = 150;
export const DOG_HALF_ANGLE = 0.72;
export const DOG_BARK_ALERT_RADIUS = 200;
export const HIDDEN_SPOT_RADIUS = 48; // guards can spot a hidden player only this close
export const SUSPICION_FILL_TIME = 0.9; // seconds of being seen before a guard alerts
export const CAMERA_FILL_TIME = 1.2; // seconds of being seen before a camera raises the alarm
export const LOSE_SIGHT_TIME = 2.5; // seconds without sight before a chasing guard gives up
export const INVESTIGATE_GIVE_UP = 8; // seconds before a guard abandons an unreachable noise
export const COIN_HEAR_RADIUS = 285;
export const RUN_HEAR_RADIUS = 145;
export const SONAR_HEAR_RADIUS = 150;
export const SONAR_CHARGES = 2;
export const SONAR_REVEAL_TIME = 3.5;
export const COINS_PER_LEVEL = 6;
export const CAUGHT_ALARM = 30;
export const CAMERA_ALARM = 10;
export const ALARM_MAX = 100;
export const CATCH_DISTANCE = 26;
export const ITEM_PICKUP_DISTANCE = 26;
export const DARKNESS_ALPHA = 0.44;
export const LAMP_RADIUS = 150;
export const PLAYER_LIGHT_RADIUS = 72;

// Colour palettes, one per level. Floor tiles alternate floor/floorAlt in a
// checkerboard hashed by tile, walls get a top edge highlight.
export const PALETTES = {
  museum: {
    name: 'Museum After Dark',
    floor: '#3a2f26', floorAlt: '#352b22', wall: '#241a12', wallTop: '#5a4632',
    shadowTile: '#1c140e', lamp: '#ffb347', lampCore: '#ffe9b0', accent: '#d8a24a',
    grass: ['#2f6b2f', '#3f8a35', '#57a047'], grassBed: '#14240f',
    bush: '#2c5a26', bushLight: '#4c8a3a', crate: '#6b4a26', crateEdge: '#8a6234',
    closet: '#4a3220', closetEdge: '#7a5a38', cone: '255,176,66', text: '#f2e3c8',
  },
  office: {
    name: 'The Office Tower',
    floor: '#232c38', floorAlt: '#202834', wall: '#12161d', wallTop: '#3d4c60',
    shadowTile: '#0f141b', lamp: '#9fd8ff', lampCore: '#e8f6ff', accent: '#5aa2d8',
    grass: ['#2f6b4a', '#3f8a5f', '#57a06e'], grassBed: '#0f241a',
    bush: '#265a44', bushLight: '#3a8a5f', crate: '#4a5566', crateEdge: '#6b7a8f',
    closet: '#2c3644', closetEdge: '#55657c', cone: '140,200,255', text: '#d8e8f8',
  },
  vault: {
    name: 'The Vault Core',
    floor: '#33232a', floorAlt: '#2e2026', wall: '#1a1014', wallTop: '#5c3438',
    shadowTile: '#140c0f', lamp: '#ff9a5a', lampCore: '#ffd9b0', accent: '#c85a3a',
    grass: ['#4a6b2f', '#5f8a35', '#7aa047'], grassBed: '#1a2410',
    bush: '#3a5a26', bushLight: '#5a8a3a', crate: '#5c4030', crateEdge: '#7d5a40',
    closet: '#402828', closetEdge: '#6b4040', cone: '255,120,80', text: '#f8ddd2',
  },
  garden: {
    name: 'The Rooftop Garden',
    floor: '#24382a', floorAlt: '#213426', wall: '#101a12', wallTop: '#3a5238',
    shadowTile: '#0e1a10', lamp: '#c8ffb0', lampCore: '#f0ffe0', accent: '#7ac85a',
    grass: ['#2f7a2f', '#449a38', '#5cb84a'], grassBed: '#0e200c',
    bush: '#2a6b2a', bushLight: '#4a9a42', crate: '#5a4a2c', crateEdge: '#7a683e',
    closet: '#33402a', closetEdge: '#5a6b42', cone: '170,255,140', text: '#e0f2d8',
  },
  keep: {
    name: "The Duke's Keep",
    floor: '#2e2438', floorAlt: '#2a2134', wall: '#150f1c', wallTop: '#4c3a5e',
    shadowTile: '#100a16', lamp: '#e8b0ff', lampCore: '#ffe9ff', accent: '#b07ad8',
    grass: ['#3a6b5a', '#4a8a6f', '#5fa887'], grassBed: '#0f2018',
    bush: '#2c5a4a', bushLight: '#428a68', crate: '#5c4626', crateEdge: '#7d6234',
    closet: '#3c2c4a', closetEdge: '#64487a', cone: '220,150,255', text: '#eee0f8',
  },
};

// Deterministic hash of tile coordinates: the only "randomness" in rendering.
// Returns a float in [0, 1). Never use Math.random() for anything visible.
export function hash2(c, r, seed = 0) {
  let h = (c * 374761393 + r * 668265263 + seed * 974634781) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >> 16)) >>> 0;
  return h / 4294967296;
}

export function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

export function dist(x0, y0, x1, y1) {
  return Math.hypot(x1 - x0, y1 - y0);
}

export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
